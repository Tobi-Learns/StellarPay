"use client";

import { useState } from "react";
import Link from "next/link";
import { isConnected, requestAccess, signTransaction } from "@stellar/freighter-api";
import {
  StellarPayClient,
  TESTNET,
  formatUsdc,
  firstNextChargeAt,
  toUnixSeconds,
  snowflakeU64,
  type Interval,
  type SubscriptionRecord,
} from "@stellarpay/sdk";
import { getDemoCustomer } from "@/lib/demo-customer";

const API_BASE = process.env.NEXT_PUBLIC_STELLARPAY_API_BASE ?? "http://localhost:3000";
const MERCHANT_ADDRESS = process.env.NEXT_PUBLIC_MERCHANT_ADDRESS ?? "";

// The proxy returns the platform record joined with plan metadata.
type SubRow = SubscriptionRecord & {
  plan?: { productName?: string; intervalUnit?: string; intervalCount?: number; intervalLabel?: string };
};

function client() {
  return new StellarPayClient({ ...TESTNET, apiBase: API_BASE });
}

async function sign(xdr: string, address: string): Promise<string> {
  const result = await signTransaction(xdr, { networkPassphrase: TESTNET.networkPassphrase, address });
  if ("error" in result) throw new Error(result.error);
  return result.signedTxXdr;
}

type Kind = "active" | "needs_reauth" | "past_due" | "canceled";
function kindOf(s: SubRow): Kind {
  if (s.status === "Canceled") return "canceled";
  if (s.status === "PastDue") return "past_due";
  if (s.needsReauthorization) return "needs_reauth";
  return "active";
}

const PILL: Record<Kind, { label: string; bg: string; fg: string }> = {
  active: { label: "Active", bg: "#ecfdf5", fg: "#047857" },
  needs_reauth: { label: "Needs re-auth", bg: "#eff6ff", fg: "#1d4ed8" },
  past_due: { label: "Past due", bg: "#fffbeb", fg: "#b45309" },
  canceled: { label: "Canceled", bg: "#f5f5f4", fg: "#78716c" },
};

export default function AccountPage() {
  const [address, setAddress] = useState("");
  const [subs, setSubs] = useState<SubRow[] | null>(null);
  const [busy, setBusy] = useState(""); // onChainId currently being acted on
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadSubs(addr: string) {
    const res = await fetch(`/api/subscribe?subscriber=${encodeURIComponent(addr)}`);
    const data = await res.json();
    setSubs(Array.isArray(data) ? data : []);
  }

  async function connect() {
    setError("");
    try {
      const conn = await isConnected();
      if ("error" in conn || !conn.isConnected) throw new Error("Freighter is not installed");
      const access = await requestAccess();
      if ("error" in access) throw new Error(access.error);
      setAddress(access.address);
      await loadSubs(access.address);
    } catch (e) {
      setError(String(e));
    }
  }

  // 3.3b — cancel on-chain (subscriber signs), then reflect in the DB.
  async function cancel(sub: SubRow) {
    setError(""); setNotice(""); setBusy(sub.onChainId);
    try {
      const c = client();
      const signed = await sign(await c.buildCancelXdr(address, BigInt(sub.onChainId)), address);
      await c.submitAndWait(signed);
      await fetch("/api/subscribe", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onChainId: sub.onChainId, status: "Canceled" }),
      });
      setNotice("Subscription canceled.");
      await loadSubs(address);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy("");
    }
  }

  // 3.3f — re-authorize: re-approve a fresh capped allowance. The cron clears the
  // needs-reauth flag on the next successful charge.
  async function reauthorize(sub: SubRow) {
    setError(""); setNotice(""); setBusy(sub.onChainId);
    try {
      const c = client();
      const ledger = await c.getCurrentLedger();
      const cap = BigInt(sub.amount) * 1000n; // generous default (2.4g will make this product-sane)
      const signed = await sign(await c.buildApproveXdr(address, cap, ledger + 535_680), address);
      await c.submitAndWait(signed);
      setNotice("Allowance restored — billing resumes on the next cycle (the flag clears after the next charge).");
      await loadSubs(address);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy("");
    }
  }

  // 3.3e — resubscribe a canceled plan: approve + subscribe again (fresh sub id),
  // guarded so it can't run while an Active sub exists.
  async function resubscribe(sub: SubRow) {
    setError(""); setNotice(""); setBusy(sub.onChainId);
    try {
      if (!sub.plan?.intervalUnit || !sub.plan.intervalCount) throw new Error("Missing plan interval");
      const c = client();

      // Pre-check via the proxy (cross-origin): refuse if already Active on this plan.
      const current: SubRow[] = await (await fetch(`/api/subscribe?subscriber=${encodeURIComponent(address)}`)).json();
      if (current.some((s) => s.planOnChainId === sub.planOnChainId && s.status === "Active")) {
        throw new Error("You already have an active subscription to this plan.");
      }

      const trustlineXdr = await c.buildTrustlineXdr(address);
      if (trustlineXdr) await c.submitAndWait(await sign(trustlineXdr, address));

      const ledger = await c.getCurrentLedger();
      await c.submitAndWait(await sign(await c.buildApproveXdr(address, BigInt(sub.amount) * 1000n, ledger + 535_680), address));

      const interval: Interval = { unit: sub.plan.intervalUnit as Interval["unit"], count: sub.plan.intervalCount };
      const anchor = new Date();
      const nextChargeAt = toUnixSeconds(firstNextChargeAt(anchor, interval));
      const newSubId = snowflakeU64();
      await c.submitAndWait(await sign(await c.buildSubscribeXdr(address, BigInt(sub.planOnChainId), nextChargeAt, newSubId), address));

      const customer = getDemoCustomer();
      const res = await fetch("/api/subscribe", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          onChainId: String(newSubId),
          planOnChainId: sub.planOnChainId,
          subscriber: address,
          merchant: MERCHANT_ADDRESS,
          amount: sub.amount,
          anchorAt: anchor.toISOString(),
          payerName: customer.name,
          payerEmail: customer.email,
        }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? "Failed to register");

      setNotice("Resubscribed — first charge complete.");
      await loadSubs(address);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy("");
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#fafaf9" }}>
      <nav style={{ background: "#1c1917", padding: "0 32px", display: "flex", alignItems: "center", height: 56 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18, color: "#059669", fontWeight: 800 }}>SR</span>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Stellar Roast</span>
        </div>
        <span style={{ color: "#57534e", margin: "0 12px", fontSize: 16 }}>/</span>
        <span style={{ color: "#a8a29e", fontSize: 14 }}>My subscriptions</span>
        <Link href="/" style={{ marginLeft: "auto", color: "#a8a29e", fontSize: 14, textDecoration: "none" }}>Back to shop</Link>
      </nav>

      <div style={{ maxWidth: 720, margin: "48px auto", padding: "0 20px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>My subscriptions</h1>
        <p style={{ fontSize: 13, color: "#78716c", margin: "0 0 24px", lineHeight: 1.5 }}>
          Manage the subscriptions on your connected wallet. Each action is a live SDK call signed with Freighter.
        </p>

        {!address ? (
          <button onClick={connect} style={{ padding: "13px 22px", borderRadius: 10, border: "none", background: "#1c1917", color: "#fff", fontWeight: 600, fontSize: 15, cursor: "pointer" }}>
            Connect wallet
          </button>
        ) : (
          <>
            {notice && <p style={{ background: "#ecfdf5", color: "#047857", padding: "10px 14px", borderRadius: 8, fontSize: 13, margin: "0 0 16px" }}>{notice}</p>}
            {error && <p style={{ background: "#fef2f2", color: "#dc2626", padding: "10px 14px", borderRadius: 8, fontSize: 13, margin: "0 0 16px" }}>{error}</p>}

            {subs === null ? (
              <p style={{ color: "#a8a29e", fontSize: 14 }}>Loading…</p>
            ) : subs.length === 0 ? (
              <div style={{ border: "1px solid #e7e5e4", borderRadius: 12, padding: 32, textAlign: "center", background: "#fff" }}>
                <p style={{ color: "#78716c", fontSize: 14, margin: "0 0 12px" }}>No subscriptions on this wallet yet.</p>
                <Link href="/" style={{ color: "#059669", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>Browse subscription plans →</Link>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {subs.map((sub) => {
                  const kind = kindOf(sub);
                  const pill = PILL[kind];
                  const acting = busy === sub.onChainId;
                  // A cancelled sub is history once the wallet holds a live sub
                  // (Active/PastDue/needs-reauth) on the same plan — resubscribe
                  // would just hit the duplicate guard, so hide it.
                  const replacedByActive = kind === "canceled" && subs.some(
                    (s) => s.planOnChainId === sub.planOnChainId && s.status !== "Canceled"
                  );
                  return (
                    <div key={sub.onChainId} style={{ border: "1px solid #e7e5e4", borderRadius: 12, padding: "16px 18px", background: "#fff", opacity: replacedByActive ? 0.6 : 1 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <div>
                          <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 2px" }}>{sub.plan?.productName ?? "Subscription"}</p>
                          <p style={{ fontSize: 13, color: "#78716c", margin: 0 }}>
                            {formatUsdc(BigInt(sub.amount))} USDC{sub.plan?.intervalLabel ? ` · ${sub.plan.intervalLabel}` : ""}
                          </p>
                        </div>
                        <span style={{ background: pill.bg, color: pill.fg, borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{pill.label}</span>
                      </div>

                      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                        {kind === "needs_reauth" && (
                          <ActionButton primary label={acting ? "Signing…" : "Re-authorize"} disabled={acting} onClick={() => reauthorize(sub)} />
                        )}
                        {kind === "canceled" ? (
                          replacedByActive ? (
                            <span style={{ fontSize: 12, color: "#a8a29e", alignSelf: "center" }}>Replaced by an active subscription</span>
                          ) : (
                            <ActionButton primary label={acting ? "Working…" : "Resubscribe"} disabled={acting} onClick={() => resubscribe(sub)} />
                          )
                        ) : (
                          <ActionButton label={acting ? "Signing…" : "Cancel"} disabled={acting} danger onClick={() => cancel(sub)} />
                        )}
                      </div>

                      {kind === "needs_reauth" && (
                        <p style={{ fontSize: 12, color: "#1d4ed8", margin: "10px 0 0", lineHeight: 1.5 }}>
                          Your spending allowance ran out. Re-authorize to resume — your balance was never charged.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ActionButton({ label, onClick, disabled, primary, danger }: { label: string; onClick: () => void; disabled?: boolean; primary?: boolean; danger?: boolean }) {
  const base: React.CSSProperties = { padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: disabled ? "default" : "pointer", border: "1px solid #e7e5e4", background: "#fff", color: "#57534e" };
  const style = primary
    ? { ...base, background: "#059669", color: "#fff", border: "none" }
    : danger
      ? { ...base, color: "#dc2626", borderColor: "#fecaca" }
      : base;
  return <button onClick={disabled ? undefined : onClick} disabled={disabled} style={{ ...style, opacity: disabled ? 0.6 : 1 }}>{label}</button>;
}
