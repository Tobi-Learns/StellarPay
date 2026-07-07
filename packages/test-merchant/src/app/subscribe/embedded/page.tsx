"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  StellarPayClient,
  MobileWalletConnect,
  TESTNET,
  parseUsdc,
  firstNextChargeAt,
  toUnixSeconds,
  snowflakeU64,
  type Interval,
} from "@stellarpay/sdk";
import { MobileWalletQr } from "@stellarpay/sdk/react";
import { isConnected, requestAccess, signTransaction } from "@stellar/freighter-api";
import { getDemoCustomer, DemoCustomerCard } from "@/lib/demo-customer";

const API_BASE = process.env.NEXT_PUBLIC_STELLARPAY_API_BASE ?? "http://localhost:3000";
const MERCHANT_ADDRESS = process.env.NEXT_PUBLIC_MERCHANT_ADDRESS!;
const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";
// Pre-provisioned plan (onChainId) from the seed — see scripts/seed-test-merchant.mjs.
// INTERVAL must match the seeded plan's cadence so firstNextChargeAt clears the
// contract's subscribe floor check.
const PLAN_ID = process.env.NEXT_PUBLIC_DEMO_PLAN_EMBEDDED ?? "";
const INTERVAL: Interval = { unit: "minute", count: 5 };

const AMOUNT = parseUsdc("2.00");
const AMOUNT_STR = AMOUNT.toString();

async function sign(xdr: string, address: string): Promise<string> {
  const result = await signTransaction(xdr, { networkPassphrase: TESTNET.networkPassphrase, address });
  if ("error" in result) throw new Error(result.error);
  return result.signedTxXdr;
}

type Step = "idle" | "connecting" | "setup" | "approving" | "subscribing" | "success" | "error";

function sdkClient() {
  return new StellarPayClient({ ...TESTNET, apiBase: API_BASE });
}

export default function SubscribeEmbeddedPage() {
  const [step, setStep] = useState<Step>("idle");
  const [subId, setSubId] = useState<bigint | null>(null);
  const [error, setError] = useState("");

  // Mobile QR (3.5b via 2.6): displayed by default; one WalletConnect session
  // per page visit — approve + subscribe arrive as sequential phone prompts.
  const connectorRef = useRef<MobileWalletConnect | null>(null);
  if (WC_PROJECT_ID && !connectorRef.current) {
    connectorRef.current = new MobileWalletConnect({
      projectId: WC_PROJECT_ID,
      networkPassphrase: TESTNET.networkPassphrase,
    });
  }

  // Browser and mobile run the same subscribe chain; only the signer differs.
  async function runSubscribe(address: string, signXdr: (xdr: string) => Promise<string>) {
    // 3.3d — duplicate-subscription guard: a second Active sub on this plan
    // would double-charge. Cross-origin, so check via the server proxy.
    const existing = (await (await fetch(`/api/subscribe?subscriber=${encodeURIComponent(address)}`)).json()) as { planOnChainId: string; status: string }[];
    if (Array.isArray(existing) && existing.some((s) => s.planOnChainId === PLAN_ID && s.status === "Active")) {
      throw new Error("You already have an active subscription to this plan — manage it under My subscriptions.");
    }

    // Auto-setup trustline if wallet doesn't have one — must happen before any SAC call.
    setStep("setup");
    const c = sdkClient();
    const trustlineXdr = await c.buildTrustlineXdr(address);
    if (trustlineXdr) {
      const tlSigned = await signXdr(trustlineXdr);
      await c.submitAndWait(tlSigned);
    }

    // Reference the merchant's pre-provisioned plan — no lookup, no create.
    const planId = BigInt(PLAN_ID);

    // Step 1: Approve SAC spending cap
    setStep("approving");
    const ledger = await c.getCurrentLedger();
    const approveXdr = await c.buildApproveXdr(address, AMOUNT * 1000n, ledger + 535_680);
    await c.submitAndWait(await signXdr(approveXdr));

    // Step 2: Subscribe — first charge runs immediately on-chain.
    // Caller-supplied non-sequential sub id (Snowflake); contract asserts uniqueness (3.2e).
    setStep("subscribing");
    const anchor = new Date();
    const nextChargeAt = toUnixSeconds(firstNextChargeAt(anchor, INTERVAL));
    const id = snowflakeU64();
    const subscribeXdr = await c.buildSubscribeXdr(address, planId, nextChargeAt, id);
    await c.submitAndWait(await signXdr(subscribeXdr));
    setSubId(id);

    const regRes = await fetch("/api/subscribe", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        onChainId: String(id),
        planOnChainId: String(planId),
        subscriber: address,
        merchant: MERCHANT_ADDRESS,
        amount: AMOUNT_STR,
        anchorAt: anchor.toISOString(),
        payerName: getDemoCustomer().name,
        payerEmail: getDemoCustomer().email,
      }),
    });
    if (!regRes.ok) {
      const { error } = await regRes.json() as { error?: string };
      throw new Error(error ?? "Failed to register subscription");
    }

    setStep("success");
  }

  function assertConfigured() {
    if (!PLAN_ID) {
      throw new Error("Demo catalog not configured — set NEXT_PUBLIC_DEMO_PLAN_EMBEDDED (run scripts/seed-test-merchant.mjs).");
    }
  }

  async function handleSubscribe() {
    setStep("connecting");
    setError("");

    try {
      assertConfigured();

      const conn = await isConnected();
      if ("error" in conn || !conn.isConnected) throw new Error("Freighter is not installed");
      const access = await requestAccess();
      if ("error" in access) throw new Error(access.error);
      const address = access.address;

      await runSubscribe(address, (xdr) => sign(xdr, address));
    } catch (e) {
      setError(String(e));
      setStep("error");
    }
  }

  async function handleMobileConnected(address: string) {
    setStep("connecting");
    setError("");

    try {
      assertConfigured();
      await runSubscribe(address, (xdr) => connectorRef.current!.signXdr(xdr));
    } catch (e) {
      setError(String(e));
      setStep("error");
    }
  }

  // Pre-compute step flags before early returns so TypeScript doesn't narrow them away
  const step1Active = step === "connecting" || step === "setup" || step === "approving";
  const step1Done = step === "subscribing" || step === "success";
  const step2Active = step === "subscribing";
  const step2Done = step === "success";

  // ── Success ──────────────────────────────────────────────────────────────────
  if (step === "success") {
    return (
      <SubscribeShell>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 480, textAlign: "center", gap: 16 }}>
          <div style={{ fontSize: 64 }}>🌱</div>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>You&apos;re subscribed!</h2>
          <p style={{ color: "#78716c", margin: 0 }}>
            Sub #{subId?.toString()} · First charge complete.
          </p>
          <p style={{ color: "#a8a29e", fontSize: 13, margin: 0 }}>
            Next charge in ~4 min (testnet demo). We&apos;ll pull automatically — no re-signing needed.
          </p>
          <Link
            href="/"
            style={{
              marginTop: 8, padding: "10px 24px", borderRadius: 8,
              border: "1px solid #e7e5e4", background: "transparent",
              fontSize: 14, color: "#78716c", textDecoration: "none",
            }}
          >
            ← Back to shop
          </Link>
        </div>
      </SubscribeShell>
    );
  }

  // ── Checkout layout ──────────────────────────────────────────────────────────
  const isActive = step !== "idle" && step !== "error";

  const stepConfig = {
    connecting:  { n: 1, label: "Connecting your wallet…" },
    setup:       { n: 1, label: "Sign in Freighter to add USDC (one-time)…" },
    approving:   { n: 1, label: "Sign in Freighter to approve…" },
    subscribing: { n: 2, label: "Sign in Freighter to subscribe…" },
  } as const;

  return (
    <SubscribeShell>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 0, minHeight: 480 }}>

        {/* Left: plan summary */}
        <div style={{ padding: "40px 36px", borderRight: "1px solid #e7e5e4", background: "#fafaf9" }}>
          <p style={{ fontSize: 12, color: "#a8a29e", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 24, fontWeight: 600 }}>
            Subscription summary
          </p>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 32 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 10,
              background: "linear-gradient(135deg, #ecfdf5, #a7f3d0)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0,
            }}>
              🌱
            </div>
            <div>
              <p style={{ fontWeight: 600, fontSize: 15, margin: "0 0 4px" }}>Monthly Coffee Club</p>
              <p style={{ color: "#78716c", fontSize: 13, margin: 0 }}>Seasonal single-origins · Monthly</p>
            </div>
          </div>
          <div style={{ borderTop: "1px solid #e7e5e4", paddingTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: "#78716c", fontSize: 14 }}>Billing cycle</span>
              <span style={{ fontSize: 14 }}>Monthly</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: "#78716c", fontSize: 14 }}>First charge</span>
              <span style={{ fontSize: 14 }}>Today</span>
            </div>
            <div style={{ borderTop: "1px solid #e7e5e4", marginTop: 16, paddingTop: 16, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Per month</span>
              <span style={{ fontWeight: 700, fontSize: 15, color: "#059669" }}>2.00 USDC</span>
            </div>
          </div>
          <div style={{ marginTop: 24, padding: "12px 16px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0" }}>
            <p style={{ fontSize: 12, color: "#15803d", margin: 0, lineHeight: 1.5 }}>
              ✓ Approve once — future charges pull automatically. Cancel anytime from your portal.
            </p>
          </div>
        </div>

        {/* Right: subscription flow */}
        <div style={{ padding: "40px 36px" }}>
          <p style={{ fontSize: 12, color: "#a8a29e", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 28, fontWeight: 600 }}>
            Authorize subscription
          </p>

          <div style={{ marginBottom: 24 }}>
            <DemoCustomerCard />
          </div>

          {/* Steps */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 36 }}>
            {[
              {
                n: 1,
                title: "Approve spending cap",
                desc: "Grant the contract permission to charge your wallet each cycle. You sign this once — no re-signing for future charges.",
                active: step1Active,
                done: step1Done,
              },
              {
                n: 2,
                title: "Subscribe",
                desc: "Enroll in the plan. The first charge runs immediately on-chain.",
                active: step2Active,
                done: step2Done,
              },
            ].map(({ n, title, desc, active, done }) => (
              <div key={n} style={{ display: "flex", gap: 14 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700,
                  background: done ? "#059669" : active ? "#1c1917" : "#f5f5f4",
                  color: done || active ? "#fff" : "#a8a29e",
                  transition: "background 0.2s",
                }}>
                  {done ? "✓" : n}
                </div>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14, margin: "3px 0 4px", color: active ? "#1c1917" : done ? "#059669" : "#a8a29e" }}>
                    {title}
                  </p>
                  <p style={{ color: "#78716c", fontSize: 13, margin: 0, lineHeight: 1.5 }}>{desc}</p>
                  {active && step in stepConfig && (
                    <p style={{ fontSize: 12, color: "#d97706", marginTop: 6, fontWeight: 500 }}>
                      {stepConfig[step as keyof typeof stepConfig].label}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Mobile QR displayed by default (3.5b) */}
          {connectorRef.current && (
            <>
              <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, padding: 16, background: "#fff", marginBottom: 16 }}>
                <MobileWalletQr
                  connector={connectorRef.current}
                  onConnected={handleMobileConnected}
                  title="Scan to subscribe from your phone"
                  description="Scan with Freighter mobile, approve the connection, then confirm both prompts on your phone."
                  connectedLabel="Connected — confirm both prompts on your phone"
                  size={180}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <span style={{ flex: 1, height: 1, background: "#e7e5e4" }} />
                <span style={{ fontSize: 11, color: "#a8a29e" }}>or subscribe in this browser</span>
                <span style={{ flex: 1, height: 1, background: "#e7e5e4" }} />
              </div>
            </>
          )}

          <button
            onClick={step === "idle" || step === "error" ? handleSubscribe : undefined}
            disabled={isActive}
            style={{
              width: "100%", padding: "14px", borderRadius: 10, border: "none",
              cursor: isActive ? "default" : "pointer",
              fontWeight: 600, fontSize: 15,
              background: step === "error" ? "#fef2f2" : isActive ? "#e7e5e4" : "#059669",
              color: step === "error" ? "#dc2626" : isActive ? "#a8a29e" : "#fff",
              transition: "background 0.15s",
            }}
          >
            {step === "idle" ? "Subscribe — 2 USDC/mo" :
             step === "error" ? "Try again" :
             "Working…"}
          </button>
          {error && <p style={{ fontSize: 12, color: "#dc2626", marginTop: 10 }}>{error}</p>}
        </div>
      </div>
    </SubscribeShell>
  );
}

// ── Shared shell ─────────────────────────────────────────────────────────────

function SubscribeShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#fafaf9" }}>
      <nav style={{ background: "#1c1917", padding: "0 32px", display: "flex", alignItems: "center", height: 56 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>☕</span>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 15, letterSpacing: "-0.01em" }}>Stellar Roast</span>
        </div>
        <span style={{ color: "#57534e", margin: "0 12px", fontSize: 16 }}>›</span>
        <span style={{ color: "#a8a29e", fontSize: 14 }}>Subscribe</span>
      </nav>
      <div style={{ maxWidth: 860, margin: "48px auto", background: "#fff", borderRadius: 16, border: "1px solid #e7e5e4", overflow: "hidden" }}>
        <div style={{ padding: "16px 36px", borderBottom: "1px solid #e7e5e4", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ fontSize: 13, color: "#78716c", textDecoration: "none" }}>
            ← Back to shop
          </Link>
          <p style={{ fontSize: 12, color: "#a8a29e", margin: 0 }}>Secured by StellarPay</p>
        </div>
        {children}
      </div>
    </div>
  );
}
