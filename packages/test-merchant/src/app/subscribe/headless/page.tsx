"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { isConnected, requestAccess, signTransaction } from "@stellar/freighter-api";
import {
  StellarPayClient,
  TESTNET,
  parseUsdc,
  minIntervalSeconds,
  firstNextChargeAt,
  toUnixSeconds,
  type Interval,
} from "@stellarpay/sdk";
import { DEMO_CUSTOMER, DemoCustomerCard } from "@/lib/demo-customer";

const API_BASE = process.env.NEXT_PUBLIC_STELLARPAY_API_BASE ?? "http://localhost:3000";
const MERCHANT_ADDRESS = process.env.NEXT_PUBLIC_MERCHANT_ADDRESS ?? "";
const INTERVAL: Interval = { unit: "minute", count: 5 };
const INTERVAL_LABEL = "Demo (every 5 minutes)";

const AMOUNT = parseUsdc("3.00");
const AMOUNT_STR = AMOUNT.toString();

type Step =
  | "idle"
  | "connecting"
  | "setup"
  | "plan"
  | "approving"
  | "subscribing"
  | "registering"
  | "success"
  | "error";

type PlanLookup = {
  planId: string | null;
  existing: boolean;
  error?: string;
};

async function sign(xdr: string, address: string): Promise<string> {
  const result = await signTransaction(xdr, {
    networkPassphrase: TESTNET.networkPassphrase,
    address,
  });
  if ("error" in result) throw new Error(result.error);
  return result.signedTxXdr;
}

function client() {
  return new StellarPayClient({ ...TESTNET, apiBase: API_BASE });
}

export default function HeadlessSubscribePage() {
  const [step, setStep] = useState<Step>("idle");
  const [subscriber, setSubscriber] = useState("");
  const [planId, setPlanId] = useState<bigint | null>(null);
  const [subId, setSubId] = useState<bigint | null>(null);
  const [error, setError] = useState("");

  const statusLabel = useMemo(() => {
    switch (step) {
      case "connecting":
        return "Connecting wallet...";
      case "setup":
        return "Checking USDC trustline...";
      case "plan":
        return "Finding subscription plan...";
      case "approving":
        return "Approving spending cap...";
      case "subscribing":
        return "Creating subscription...";
      case "registering":
        return "Registering subscription...";
      case "success":
        return "Subscription active";
      case "error":
        return "Ready to retry";
      default:
        return "Ready";
    }
  }, [step]);

  const approveDone = step === "subscribing" || step === "registering" || step === "success";
  const subscribeDone = step === "registering" || step === "success";
  const isWorking = step !== "idle" && step !== "error" && step !== "success";
  const canSubscribe = step === "idle" || step === "error";

  async function lookupOrCreatePlan(c: StellarPayClient, address: string): Promise<bigint> {
    setStep("plan");

    const res = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: AMOUNT_STR,
        intervalLabel: INTERVAL_LABEL,
        merchant: MERCHANT_ADDRESS,
      }),
    });
    const data = await res.json() as PlanLookup;
    if (!res.ok) throw new Error(data.error ?? "Could not look up plan");

    if (data.planId) {
      return BigInt(data.planId);
    }

    if (address !== MERCHANT_ADDRESS) {
      throw new Error("No plan found. The merchant needs to create the Monthly Coffee Club plan first.");
    }

    const createXdr = await c.buildCreatePlanXdr(address, AMOUNT, minIntervalSeconds(INTERVAL));
    const signedCreateXdr = await sign(createXdr, address);
    const { returnValue } = await c.submitAndWaitWithResult(signedCreateXdr);
    const createdPlanId = returnValue as bigint;

    const registerPlanRes = await fetch("/api/subscribe", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        onChainId: String(createdPlanId),
        merchant: MERCHANT_ADDRESS,
        amount: AMOUNT_STR,
        interval: minIntervalSeconds(INTERVAL),
        intervalLabel: INTERVAL_LABEL,
        intervalUnit: INTERVAL.unit,
        intervalCount: INTERVAL.count,
      }),
    });

    if (!registerPlanRes.ok) {
      const body = await registerPlanRes.json() as { error?: string };
      throw new Error(body.error ?? "Failed to register plan");
    }

    return createdPlanId;
  }

  async function handleSubscribe() {
    setError("");
    setStep("connecting");

    try {
      if (!MERCHANT_ADDRESS) {
        throw new Error("Missing NEXT_PUBLIC_MERCHANT_ADDRESS");
      }

      const conn = await isConnected();
      if ("error" in conn || !conn.isConnected) {
        throw new Error("Freighter is not installed");
      }

      const access = await requestAccess();
      if ("error" in access) throw new Error(access.error);
      const address = access.address;
      setSubscriber(address);

      const c = client();

      setStep("setup");
      const trustlineXdr = await c.buildTrustlineXdr(address);
      if (trustlineXdr) {
        const signedTrustlineXdr = await sign(trustlineXdr, address);
        await c.submitAndWait(signedTrustlineXdr);
      }

      const resolvedPlanId = await lookupOrCreatePlan(c, address);
      setPlanId(resolvedPlanId);

      setStep("approving");
      const ledger = await c.getCurrentLedger();
      const approveXdr = await c.buildApproveXdr(address, AMOUNT * 1000n, ledger + 535_680);
      const signedApproveXdr = await sign(approveXdr, address);
      await c.submitAndWait(signedApproveXdr);

      setStep("subscribing");
      const anchor = new Date();
      const nextChargeAt = toUnixSeconds(firstNextChargeAt(anchor, INTERVAL));
      const subscribeXdr = await c.buildSubscribeXdr(address, resolvedPlanId, nextChargeAt);
      const signedSubscribeXdr = await sign(subscribeXdr, address);
      const { returnValue } = await c.submitAndWaitWithResult(signedSubscribeXdr);
      const createdSubId = returnValue as bigint;
      setSubId(createdSubId);

      setStep("registering");
      const registerSubRes = await fetch("/api/subscribe", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          onChainId: String(createdSubId),
          planOnChainId: String(resolvedPlanId),
          subscriber: address,
          merchant: MERCHANT_ADDRESS,
          amount: AMOUNT_STR,
          anchorAt: anchor.toISOString(),
          payerName: DEMO_CUSTOMER.name,
          payerEmail: DEMO_CUSTOMER.email,
        }),
      });

      if (!registerSubRes.ok) {
        const body = await registerSubRes.json() as { error?: string };
        throw new Error(body.error ?? "Failed to register subscription");
      }

      setStep("success");
    } catch (e) {
      setError(String(e));
      setStep("error");
    }
  }

  if (step === "success") {
    return (
      <SubscribeShell>
        <div style={{ minHeight: 480, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#059669" }}>ACTIVE</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Subscription confirmed</h1>
          <p style={{ color: "#78716c", margin: 0 }}>
            Sub #{subId?.toString()} is active. The first charge is complete.
          </p>
          {planId && (
            <p style={{ color: "#a8a29e", fontSize: 12, margin: 0 }}>
              Plan #{planId.toString()} charges 3.00 USDC every demo cycle.
            </p>
          )}
          {subscriber && (
            <p style={{ color: "#a8a29e", fontSize: 12, margin: 0, maxWidth: 440, overflowWrap: "anywhere" }}>
              Subscriber {subscriber}
            </p>
          )}
          <Link
            href="/"
            style={{ marginTop: 8, padding: "10px 24px", borderRadius: 8, border: "1px solid #e7e5e4", background: "transparent", fontSize: 14, color: "#78716c", textDecoration: "none" }}
          >
            Back to shop
          </Link>
        </div>
      </SubscribeShell>
    );
  }

  return (
    <SubscribeShell>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", minHeight: 480 }}>
        <div style={{ padding: "40px 36px", borderRight: "1px solid #e7e5e4", background: "#fafaf9" }}>
          <p style={{ fontSize: 12, color: "#a8a29e", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 24, fontWeight: 600 }}>
            Subscription summary
          </p>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 32 }}>
            <div style={{ width: 56, height: 56, borderRadius: 10, background: "linear-gradient(135deg, #ecfdf5, #a7f3d0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "#047857", flexShrink: 0 }}>
              MC
            </div>
            <div>
              <p style={{ fontWeight: 600, fontSize: 15, margin: "0 0 4px" }}>Monthly Coffee Club</p>
              <p style={{ color: "#78716c", fontSize: 13, margin: 0 }}>Seasonal single-origins. Demo cycle: about 4 min.</p>
            </div>
          </div>
          <div style={{ borderTop: "1px solid #e7e5e4", paddingTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: "#78716c", fontSize: 14 }}>First charge</span>
              <span style={{ fontSize: 14 }}>Today</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: "#78716c", fontSize: 14 }}>Future charges</span>
              <span style={{ fontSize: 14 }}>Automatic</span>
            </div>
            <div style={{ borderTop: "1px solid #e7e5e4", marginTop: 16, paddingTop: 16, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Per cycle</span>
              <span style={{ fontWeight: 700, fontSize: 15, color: "#059669" }}>3.00 USDC</span>
            </div>
          </div>
          <div style={{ marginTop: 32, padding: "12px 16px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0" }}>
            <p style={{ fontSize: 12, color: "#15803d", margin: 0, lineHeight: 1.5 }}>
              Approve a capped allowance once. StellarPay charges future cycles without a new signature.
            </p>
          </div>
        </div>

        <div style={{ padding: "40px 36px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <p style={{ fontSize: 12, color: "#a8a29e", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 28, fontWeight: 600 }}>
            Custom subscription flow
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <DemoCustomerCard />

            <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, padding: 16, background: "#fafaf9" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <p style={{ color: "#57534e", fontSize: 14, fontWeight: 600, margin: 0 }}>{statusLabel}</p>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: isWorking ? "#d97706" : step === "error" ? "#dc2626" : "#059669", flexShrink: 0 }} />
              </div>
              {planId && (
                <p style={{ color: "#a8a29e", fontSize: 12, margin: "8px 0 0" }}>
                  Plan #{planId.toString()}
                </p>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {[
                { label: "Plan", active: step === "plan" || step === "approving" || step === "subscribing" || step === "registering", done: Boolean(planId) },
                { label: "Approve", active: step === "approving", done: approveDone },
                { label: "Subscribe", active: step === "subscribing" || step === "registering", done: subscribeDone },
              ].map(({ label, active, done }) => (
                <div key={label} style={{ borderRadius: 8, padding: "10px 8px", textAlign: "center", fontSize: 12, fontWeight: 600, background: done ? "#059669" : active ? "#1c1917" : "#f5f5f4", color: done || active ? "#fff" : "#a8a29e" }}>
                  {label}
                </div>
              ))}
            </div>

            <button
              onClick={canSubscribe ? handleSubscribe : undefined}
              disabled={!canSubscribe}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: 10,
                border: "none",
                cursor: canSubscribe ? "pointer" : "default",
                fontWeight: 600,
                fontSize: 15,
                background: step === "error" ? "#fef2f2" : canSubscribe ? "#059669" : "#e7e5e4",
                color: step === "error" ? "#dc2626" : canSubscribe ? "#fff" : "#a8a29e",
              }}
            >
              {step === "error" ? "Try again" : isWorking ? "Working..." : "Subscribe - 3 USDC/mo"}
            </button>

            {error && <p style={{ fontSize: 12, color: "#dc2626", margin: 0 }}>{error}</p>}

            <p style={{ fontSize: 11, color: "#a8a29e", margin: 0, lineHeight: 1.5 }}>
              This page uses raw SDK builders and Freighter signing directly; no hosted checkout and no embedded widget.
            </p>
          </div>
        </div>
      </div>
    </SubscribeShell>
  );
}

function SubscribeShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#fafaf9" }}>
      <nav style={{ background: "#1c1917", padding: "0 32px", display: "flex", alignItems: "center", height: 56 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18, color: "#059669", fontWeight: 800 }}>SR</span>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 15, letterSpacing: 0 }}>Stellar Roast</span>
        </div>
        <span style={{ color: "#57534e", margin: "0 12px", fontSize: 16 }}>/</span>
        <span style={{ color: "#a8a29e", fontSize: 14 }}>Subscribe</span>
      </nav>
      <div style={{ maxWidth: 860, margin: "48px auto", background: "#fff", borderRadius: 16, border: "1px solid #e7e5e4", overflow: "hidden" }}>
        <div style={{ padding: "16px 36px", borderBottom: "1px solid #e7e5e4", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ fontSize: 13, color: "#78716c", textDecoration: "none" }}>
            Back to shop
          </Link>
          <p style={{ fontSize: 12, color: "#a8a29e", margin: 0 }}>Secured by StellarPay</p>
        </div>
        {children}
      </div>
    </div>
  );
}
