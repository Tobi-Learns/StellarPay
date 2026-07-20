"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand";
import { useWallet } from "@/lib/wallet-context";

type BusinessSummary = { id: string; name: string };

export function OnboardingClient({
  initialBusiness,
  suggestedName,
}: {
  initialBusiness: BusinessSummary | null;
  suggestedName: string;
}) {
  const router = useRouter();
  const { address, isConnecting, connect, signAuthChallenge } = useWallet();
  const [business, setBusiness] = useState(initialBusiness);
  const [name, setName] = useState(suggestedName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createBusiness() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to create Business");
      setBusiness({ id: data.id ?? data.business?.id, name: data.name ?? name });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create Business");
    } finally {
      setBusy(false);
    }
  }

  async function proveWallet(purpose: "attach" | "claim") {
    if (!address) return;
    setBusy(true);
    setError(null);
    try {
      const challengeResponse = await fetch("/api/wallet-challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, purpose }),
      });
      const challenge = await challengeResponse.json();
      if (!challengeResponse.ok) throw new Error(challenge.error ?? "Unable to create wallet challenge");
      const signedXdr = await signAuthChallenge(challenge.xdr, challenge.networkPassphrase);
      const verifyResponse = await fetch("/api/wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: challenge.id, signedXdr }),
      });
      const verified = await verifyResponse.json();
      if (!verifyResponse.ok) throw new Error(verified.error ?? "Wallet verification failed");
      router.replace("/app");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Wallet verification failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[var(--sp-paper)] px-5 py-12">
      <div className="mx-auto max-w-xl rounded-2xl border border-[var(--sp-border)] bg-white p-7 shadow-[0_18px_60px_rgba(7,19,17,0.08)] sm:p-9">
        <BrandLogo href="/" showDescriptor />
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sp-green)]">Business setup</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--sp-ink)]">Connect your account to settlement</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--sp-muted)]">
          Google secures Platform access. Your Stellar wallet remains the self-custodied address that receives payments and signs plan creation.
        </p>

        {!business ? (
          <div className="mt-7 space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--sp-ink)]" htmlFor="business-name">Business name</label>
              <input id="business-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} className="w-full rounded-xl border border-[var(--sp-border)] px-3 py-2.5 text-sm outline-none focus:border-[var(--sp-green)]" />
            </div>
            <button onClick={createBusiness} disabled={busy || !name.trim()} className="w-full rounded-xl bg-[var(--sp-ink)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? "Creating…" : "Create new Business"}
            </button>
            <div className="flex items-center gap-3 text-xs text-[var(--sp-muted)]"><span className="h-px flex-1 bg-[var(--sp-border)]" />or recover existing data<span className="h-px flex-1 bg-[var(--sp-border)]" /></div>
            {!address ? (
              <button onClick={connect} disabled={isConnecting || busy} className="w-full rounded-xl border border-[var(--sp-border)] px-4 py-3 text-sm font-semibold text-[var(--sp-ink)] disabled:opacity-50">
                {isConnecting ? "Connecting…" : "Connect legacy settlement wallet"}
              </button>
            ) : (
              <button onClick={() => proveWallet("claim")} disabled={busy} className="w-full rounded-xl border border-[var(--sp-green)] px-4 py-3 text-sm font-semibold text-[var(--sp-green)] disabled:opacity-50">Claim Business for {address.slice(0, 6)}…{address.slice(-4)}</button>
            )}
          </div>
        ) : (
          <div className="mt-7 rounded-xl border border-[var(--sp-border)] bg-[var(--sp-mist)]/40 p-5">
            <p className="text-sm font-semibold text-[var(--sp-ink)]">{business.name}</p>
            <p className="mt-1 text-xs leading-5 text-[var(--sp-muted)]">Attach the first verified settlement wallet. StellarPay will not receive its secret key.</p>
            {!address ? (
              <button onClick={connect} disabled={isConnecting || busy} className="mt-5 w-full rounded-xl bg-[var(--sp-ink)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{isConnecting ? "Connecting…" : "Connect settlement wallet"}</button>
            ) : (
              <button onClick={() => proveWallet("attach")} disabled={busy} className="mt-5 w-full rounded-xl bg-[var(--sp-ink)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Waiting for signature…" : `Verify ${address.slice(0, 6)}…${address.slice(-4)}`}</button>
            )}
          </div>
        )}
        {error && <p className="mt-5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>
    </div>
  );
}
