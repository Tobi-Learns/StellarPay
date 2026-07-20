"use client";

import { useEffect, useMemo, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useWallet } from "@/lib/wallet-context";
import { truncateAddress } from "@/lib/stellar";

type Wallet = {
  id: string;
  address: string;
  status: string;
  isDefault: boolean;
  verifiedAt: string;
  legacyAt: string | null;
};

type BusinessResponse = {
  user: { name: string | null; email: string | null; image: string | null };
  business: { id: string; name: string; logoUrl: string | null; wallets: Wallet[] };
};

type RotationPreview = {
  paymentLinks: Array<{ id: string; numericId: string; productName: string; merchant: string }>;
  recurringPlans: Array<{ id: string; onChainId: string; productName: string; merchant: string; activeSubscriptions: number }>;
};

export default function SettingsPage() {
  const { data: session } = useSession();
  const { address, isConnecting, connect, signAuthChallenge } = useWallet();
  const [data, setData] = useState<BusinessResponse | null>(null);
  const [preview, setPreview] = useState<RotationPreview | null>(null);
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [selectedLinks, setSelectedLinks] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "rotating" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [renderedAt] = useState(() => Math.floor(Date.now() / 1000));

  async function load() {
    const [businessResponse, previewResponse] = await Promise.all([
      fetch("/api/business"),
      fetch("/api/wallets/rotation-preview"),
    ]);
    const businessData = await businessResponse.json();
    const previewData = await previewResponse.json();
    if (businessResponse.ok) {
      setData(businessData);
      setName(businessData.business?.name ?? "");
      setLogoUrl(businessData.business?.logoUrl ?? "");
    }
    if (previewResponse.ok) {
      setPreview(previewData);
      setSelectedLinks(previewData.paymentLinks.map((link: { id: string }) => link.id));
    }
  }

  useEffect(() => {
    let canceled = false;
    Promise.all([fetch("/api/business"), fetch("/api/wallets/rotation-preview")])
      .then(async ([businessResponse, previewResponse]) => {
        const [businessData, previewData] = await Promise.all([
          businessResponse.json(),
          previewResponse.json(),
        ]);
        if (canceled) return;
        if (businessResponse.ok) {
          setData(businessData);
          setName(businessData.business?.name ?? "");
          setLogoUrl(businessData.business?.logoUrl ?? "");
        }
        if (previewResponse.ok) {
          setPreview(previewData);
          setSelectedLinks(previewData.paymentLinks.map((link: { id: string }) => link.id));
        }
      });
    return () => { canceled = true; };
  }, []);

  const currentWallet = useMemo(
    () => data?.business.wallets.find((wallet) => wallet.isDefault) ?? null,
    [data]
  );
  const sessionFresh = Boolean(session?.authenticatedAt && renderedAt - session.authenticatedAt <= 10 * 60);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setStatus("saving");
    setMessage(null);
    const response = await fetch("/api/business", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, logoUrl }),
    });
    const result = await response.json();
    if (!response.ok) {
      setStatus("error");
      setMessage(result.error ?? "Save failed");
      return;
    }
    setStatus("saved");
    setMessage("Business profile saved.");
    await load();
  }

  async function rotateWallet() {
    if (!address) return;
    if (address === currentWallet?.address) {
      setStatus("error");
      setMessage("Connect a different wallet to rotate settlement.");
      return;
    }
    setStatus("rotating");
    setMessage(null);
    try {
      const challengeResponse = await fetch("/api/wallet-challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, purpose: "rotate" }),
      });
      const challenge = await challengeResponse.json();
      if (challengeResponse.status === 403 && challenge.code === "STEP_UP_REQUIRED") {
        setStatus("idle");
        setMessage(challenge.error);
        return;
      }
      if (!challengeResponse.ok) throw new Error(challenge.error ?? "Unable to start rotation");
      const signedXdr = await signAuthChallenge(challenge.xdr, challenge.networkPassphrase);
      const response = await fetch("/api/wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: challenge.id, signedXdr, paymentLinkIds: selectedLinks }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Rotation failed");
      setStatus("saved");
      setMessage("Settlement wallet rotated. Existing recurring plans still settle to the legacy wallet.");
      await load();
    } catch (cause) {
      setStatus("error");
      setMessage(cause instanceof Error ? cause.message : "Rotation failed");
    }
  }

  if (!data) return <p className="text-sm text-[var(--sp-muted)]">Loading Business settings…</p>;

  return (
    <div className="max-w-3xl space-y-7">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--sp-green)]">Account & Business</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--sp-ink)]">Business settings</h1>
        <p className="mt-1 text-sm text-[var(--sp-muted)]">Platform identity and settlement are deliberately separate.</p>
      </div>

      <section className="rounded-2xl border border-[var(--sp-border)] bg-white p-6">
        <h2 className="font-semibold text-[var(--sp-ink)]">Google account</h2>
        <p className="mt-3 text-sm text-[var(--sp-ink)]">{data.user.name ?? "Account owner"}</p>
        <p className="text-sm text-[var(--sp-muted)]">{data.user.email}</p>
        <p className="mt-3 text-xs text-[var(--sp-muted)]">Verified Google identity · owner access</p>
      </section>

      <form onSubmit={saveProfile} className="rounded-2xl border border-[var(--sp-border)] bg-white p-6">
        <h2 className="font-semibold text-[var(--sp-ink)]">Business profile</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-[var(--sp-ink)]">Business name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} className="mt-1.5 w-full rounded-lg border border-[var(--sp-border)] px-3 py-2 text-sm" /></label>
          <label className="text-sm font-medium text-[var(--sp-ink)]">Logo URL<input value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} type="url" className="mt-1.5 w-full rounded-lg border border-[var(--sp-border)] px-3 py-2 text-sm" /></label>
        </div>
        <button disabled={status === "saving"} className="mt-4 rounded-lg bg-[var(--sp-ink)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{status === "saving" ? "Saving…" : "Save profile"}</button>
      </form>

      <section className="rounded-2xl border border-[var(--sp-border)] bg-white p-6">
        <h2 className="font-semibold text-[var(--sp-ink)]">Settlement wallets</h2>
        <div className="mt-4 space-y-3">
          {data.business.wallets.map((wallet) => (
            <div key={wallet.id} className="flex flex-col gap-2 rounded-xl border border-[var(--sp-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-mono text-sm text-[var(--sp-ink)]">{truncateAddress(wallet.address)}</p><p className="mt-1 text-xs text-[var(--sp-muted)]">Verified {new Date(wallet.verifiedAt).toLocaleString()}{wallet.legacyAt ? ` · legacy since ${new Date(wallet.legacyAt).toLocaleString()}` : ""}</p></div>
              <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${wallet.isDefault ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{wallet.isDefault ? "Current" : "Legacy receiving wallet"}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          Rotation cannot redirect existing recurring plans. They remain bound to their original on-chain wallet until they wind down or customers approve replacement plans. If that old key is lost, signing into the Platform does not recover or redirect it.
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--sp-border)] bg-white p-6">
        <h2 className="font-semibold text-[var(--sp-ink)]">Rotate settlement wallet</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--sp-muted)]">The new wallet becomes the default for new links and plans. Choose which active one-time links should switch now.</p>
        {preview?.paymentLinks.length ? (
          <div className="mt-4 space-y-2">{preview.paymentLinks.map((link) => <label key={link.id} className="flex items-center gap-3 rounded-lg border border-[var(--sp-border)] px-3 py-2 text-sm"><input type="checkbox" checked={selectedLinks.includes(link.id)} onChange={(event) => setSelectedLinks((current) => event.target.checked ? [...current, link.id] : current.filter((id) => id !== link.id))} />{link.productName}</label>)}</div>
        ) : <p className="mt-4 text-sm text-[var(--sp-muted)]">No active one-time links need a migration choice.</p>}
        {preview?.recurringPlans.length ? <p className="mt-4 text-sm font-medium text-amber-800">{preview.recurringPlans.length} recurring plan(s), with {preview.recurringPlans.reduce((sum, plan) => sum + plan.activeSubscriptions, 0)} active subscription(s), will stay on the legacy wallet.</p> : null}
        {!sessionFresh && <button onClick={() => signIn("google", { callbackUrl: "/app/settings" })} className="mt-5 rounded-lg border border-[var(--sp-border)] px-4 py-2 text-sm font-semibold text-[var(--sp-ink)]">Reauthenticate with Google</button>}
        {sessionFresh && !address && <button onClick={connect} disabled={isConnecting} className="mt-5 rounded-lg border border-[var(--sp-border)] px-4 py-2 text-sm font-semibold text-[var(--sp-ink)] disabled:opacity-50">{isConnecting ? "Connecting…" : "Connect new wallet"}</button>}
        {sessionFresh && address && <button onClick={rotateWallet} disabled={status === "rotating"} className="mt-5 rounded-lg bg-[var(--sp-ink)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{status === "rotating" ? "Waiting for signature…" : `Verify and rotate to ${truncateAddress(address)}`}</button>}
      </section>

      {message && <p className={`rounded-xl px-4 py-3 text-sm ${status === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{message}</p>}
    </div>
  );
}
