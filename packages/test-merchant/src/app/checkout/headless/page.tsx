"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { isConnected, requestAccess, signTransaction } from "@stellar/freighter-api";
import { StellarPayClient, TESTNET, parseUsdc } from "@stellarpay/sdk";
import { getDemoCustomer, DemoCustomerCard } from "@/lib/demo-customer";

const API_BASE = process.env.NEXT_PUBLIC_STELLARPAY_API_BASE ?? "http://localhost:3000";
const MERCHANT_ADDRESS = process.env.NEXT_PUBLIC_MERCHANT_ADDRESS ?? "";
// Pre-provisioned link (numericId) from the seed — see scripts/seed-test-merchant.mjs.
const LINK_NUMERIC_ID = process.env.NEXT_PUBLIC_DEMO_CHECKOUT_HEADLESS ?? "";

const AMOUNT = parseUsdc("7.00");
const AMOUNT_STR = AMOUNT.toString();

type Step = "preparing" | "ready" | "connecting" | "setup" | "signing" | "submitting" | "success" | "error";

type CheckoutLink = {
  numericId: string;
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

export default function HeadlessCheckoutPage() {
  const [step, setStep] = useState<Step>("preparing");
  const [link, setLink] = useState<CheckoutLink | null>(null);
  const [payer, setPayer] = useState("");
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");

  const stepLabel = useMemo(() => {
    switch (step) {
      case "preparing":
        return "Preparing checkout...";
      case "connecting":
        return "Connecting wallet...";
      case "setup":
        return "Checking USDC setup...";
      case "signing":
        return "Waiting for Freighter signature...";
      case "submitting":
        return "Submitting payment...";
      case "success":
        return "Payment complete";
      case "error":
        return "Ready to retry";
      default:
        return "Ready";
    }
  }, [step]);

  useEffect(() => {
    // The merchant already provisioned this link; reference it, don't create one.
    if (!LINK_NUMERIC_ID) {
      setError("Demo catalog not configured — set NEXT_PUBLIC_DEMO_CHECKOUT_HEADLESS (run scripts/seed-test-merchant.mjs).");
      setStep("error");
      return;
    }
    setLink({ numericId: LINK_NUMERIC_ID });
    setStep("ready");
  }, []);

  async function handlePay() {
    if (!link) return;

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
      setPayer(access.address);

      const c = client();

      setStep("setup");
      const trustlineXdr = await c.buildTrustlineXdr(access.address);
      if (trustlineXdr) {
        const trustlineSigned = await sign(trustlineXdr, access.address);
        await c.submitAndWait(trustlineSigned);
      }

      setStep("signing");
      const payXdr = await c.buildPayXdr(
        access.address,
        MERCHANT_ADDRESS,
        AMOUNT,
        BigInt(link.numericId),
      );
      const signedPayXdr = await sign(payXdr, access.address);

      setStep("submitting");
      const hash = await c.submitAndWait(signedPayXdr);
      // Headless pattern (2k): record the settled payment via the SDK —
      // /api/events sends CORS headers, so no server-side proxy is needed.
      c.recordPaymentSettled({
        txHash: hash,
        merchant: MERCHANT_ADDRESS,
        amount: AMOUNT_STR,
        linkId: link.numericId,
        payerName: getDemoCustomer().name,
        payerEmail: getDemoCustomer().email,
        payerWallet: access.address,
      }).catch(() => {});
      setTxHash(hash);
      setStep("success");
    } catch (e) {
      setError(String(e));
      setStep("error");
    }
  }

  const isWorking = step === "preparing" || step === "connecting" || step === "setup" || step === "signing" || step === "submitting";
  const canPay = (step === "ready" || step === "error") && Boolean(link);

  if (step === "success") {
    return (
      <CheckoutShell>
        <div style={{ minHeight: 480, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 64 }}>OK</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Payment confirmed</h1>
          <p style={{ color: "#78716c", margin: 0 }}>Your Premium Coffee Bundle is on its way.</p>
          {payer && (
            <p style={{ color: "#a8a29e", fontSize: 12, margin: 0, maxWidth: 420, overflowWrap: "anywhere" }}>
              Paid from {payer}
            </p>
          )}
          {txHash && (
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: "#d97706", fontSize: 13 }}
            >
              View transaction
            </a>
          )}
          <Link
            href="/"
            style={{ marginTop: 8, padding: "10px 24px", borderRadius: 8, border: "1px solid #e7e5e4", background: "transparent", fontSize: 14, color: "#78716c", textDecoration: "none" }}
          >
            Back to shop
          </Link>
        </div>
      </CheckoutShell>
    );
  }

  return (
    <CheckoutShell>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", minHeight: 480 }}>
        <div style={{ padding: "40px 36px", borderRight: "1px solid #e7e5e4", background: "#fafaf9" }}>
          <p style={{ fontSize: 12, color: "#a8a29e", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 24, fontWeight: 600 }}>
            Order summary
          </p>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 32 }}>
            <div style={{ width: 56, height: 56, borderRadius: 10, flexShrink: 0, background: "linear-gradient(135deg, #fef3c7, #fde68a)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "#92400e" }}>
              SR
            </div>
            <div>
              <p style={{ fontWeight: 600, fontSize: 15, margin: "0 0 4px" }}>Premium Coffee Bundle</p>
              <p style={{ color: "#78716c", fontSize: 13, margin: 0 }}>250g single-origin Ethiopian Yirgacheffe</p>
            </div>
          </div>
          <div style={{ borderTop: "1px solid #e7e5e4", paddingTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: "#78716c", fontSize: 14 }}>Subtotal</span>
              <span style={{ fontSize: 14 }}>7.00 USDC</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: "#78716c", fontSize: 14 }}>Network fee</span>
              <span style={{ fontSize: 14, color: "#059669" }}>~0.00 XLM</span>
            </div>
            <div style={{ borderTop: "1px solid #e7e5e4", marginTop: 16, paddingTop: 16, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Total</span>
              <span style={{ fontWeight: 700, fontSize: 15 }}>7.00 USDC</span>
            </div>
          </div>
          <div style={{ marginTop: 32, padding: "12px 16px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0" }}>
            <p style={{ fontSize: 12, color: "#15803d", margin: 0, lineHeight: 1.5 }}>
              Wallet-to-wallet settlement on Stellar testnet.
            </p>
          </div>
        </div>

        <div style={{ padding: "40px 36px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <p style={{ fontSize: 12, color: "#a8a29e", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 28, fontWeight: 600 }}>
            Custom checkout
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <DemoCustomerCard />

            <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, padding: 16, background: "#fafaf9" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <p style={{ color: "#57534e", fontSize: 14, fontWeight: 600, margin: 0 }}>{stepLabel}</p>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: isWorking ? "#d97706" : step === "error" ? "#dc2626" : "#059669", flexShrink: 0 }} />
              </div>
              {link && (
                <p style={{ color: "#a8a29e", fontSize: 12, margin: "8px 0 0", overflowWrap: "anywhere" }}>
                  Checkout #{link.numericId}
                </p>
              )}
            </div>

            <button
              onClick={canPay ? handlePay : undefined}
              disabled={!canPay}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: 10,
                border: "none",
                cursor: canPay ? "pointer" : "default",
                fontWeight: 600,
                fontSize: 15,
                background: canPay ? "#1c1917" : "#e7e5e4",
                color: canPay ? "#fff" : "#a8a29e",
              }}
            >
              {step === "error" ? "Try again" : isWorking ? "Working..." : "Pay 7 USDC"}
            </button>

            {error && <p style={{ fontSize: 12, color: "#dc2626", margin: 0 }}>{error}</p>}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 4 }}>
              {[
                { label: "Wallet", active: step === "connecting" || step === "setup" || step === "signing" || step === "submitting" },
                { label: "Sign", active: step === "signing" || step === "submitting" },
                { label: "Settle", active: step === "submitting" },
              ].map(({ label, active }) => (
                <div key={label} style={{ borderRadius: 8, padding: "10px 8px", textAlign: "center", fontSize: 12, fontWeight: 600, background: active ? "#1c1917" : "#f5f5f4", color: active ? "#fff" : "#a8a29e" }}>
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </CheckoutShell>
  );
}

function CheckoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#fafaf9" }}>
      <nav style={{ background: "#1c1917", padding: "0 32px", display: "flex", alignItems: "center", height: 56 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18, color: "#d97706", fontWeight: 700 }}>SR</span>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 15, letterSpacing: 0 }}>Stellar Roast</span>
        </div>
        <span style={{ color: "#57534e", margin: "0 12px", fontSize: 16 }}>/</span>
        <span style={{ color: "#a8a29e", fontSize: 14 }}>Checkout</span>
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
