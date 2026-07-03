"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StellarPayButton } from "@stellarpay/sdk/react";
import { TESTNET, parseUsdc } from "@stellarpay/sdk";
import { DEMO_CUSTOMER, DemoCustomerCard } from "@/lib/demo-customer";

const API_BASE = process.env.NEXT_PUBLIC_STELLARPAY_API_BASE ?? "http://localhost:3000";
const MERCHANT = process.env.NEXT_PUBLIC_MERCHANT_ADDRESS ?? "";
// Pre-provisioned link (numericId) from the seed — see scripts/seed-test-merchant.mjs.
const LINK_NUMERIC_ID = process.env.NEXT_PUBLIC_DEMO_CHECKOUT_EMBEDDED ?? "";

const AMOUNT = parseUsdc("5.00");
const AMOUNT_STR = AMOUNT.toString();

type PageState = "loading" | "ready" | "success" | "error";

export default function EmbeddedCheckoutPage() {
  const [pageState, setPageState] = useState<PageState>("loading");
  const [linkNumericId, setLinkNumericId] = useState<bigint | null>(null);
  const [txHash, setTxHash] = useState("");
  const [loadError, setLoadError] = useState("");
  const [payError, setPayError] = useState("");

  useEffect(() => {
    // The merchant already provisioned this link; reference it, don't create one.
    if (!LINK_NUMERIC_ID) {
      setLoadError("Demo catalog not configured — set NEXT_PUBLIC_DEMO_CHECKOUT_EMBEDDED (run scripts/seed-test-merchant.mjs).");
      setPageState("error");
      return;
    }
    setLinkNumericId(BigInt(LINK_NUMERIC_ID));
    setPageState("ready");
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#fafaf9" }}>
      {/* Nav */}
      <nav style={{ background: "#1c1917", padding: "0 32px", display: "flex", alignItems: "center", height: 56 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>☕</span>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 15, letterSpacing: "-0.01em" }}>Stellar Roast</span>
        </div>
        <span style={{ color: "#57534e", margin: "0 12px", fontSize: 16 }}>›</span>
        <span style={{ color: "#a8a29e", fontSize: 14 }}>Checkout</span>
      </nav>

      {/* Checkout card */}
      <div style={{ maxWidth: 860, margin: "48px auto", background: "#fff", borderRadius: 16, border: "1px solid #e7e5e4", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "16px 36px", borderBottom: "1px solid #e7e5e4", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ fontSize: 13, color: "#78716c", textDecoration: "none" }}>← Back to shop</Link>
          <p style={{ fontSize: 12, color: "#a8a29e", margin: 0 }}>Secured by StellarPay</p>
        </div>

        {pageState === "success" ? (
          // ── Success ────────────────────────────────────────────────────────
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 460, textAlign: "center", gap: 16, padding: 40 }}>
            <div style={{ fontSize: 64 }}>☕</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Payment confirmed!</h2>
            <p style={{ color: "#78716c", margin: 0 }}>Your Premium Coffee Bundle is on its way.</p>
            {txHash && (
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                target="_blank" rel="noreferrer"
                style={{ fontSize: 13, color: "#d97706" }}
              >
                View transaction on Stellar Expert ↗
              </a>
            )}
            <Link
              href="/"
              style={{ marginTop: 8, padding: "10px 24px", borderRadius: 8, border: "1px solid #e7e5e4", background: "transparent", fontSize: 14, color: "#78716c", textDecoration: "none" }}
            >
              ← Back to shop
            </Link>
          </div>
        ) : (
          // ── Two-column layout ───────────────────────────────────────────────
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", minHeight: 460 }}>

            {/* Left: order summary */}
            <div style={{ padding: "40px 36px", borderRight: "1px solid #e7e5e4", background: "#fafaf9" }}>
              <p style={{ fontSize: 12, color: "#a8a29e", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 24, fontWeight: 600 }}>
                Order summary
              </p>
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 32 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 10, flexShrink: 0,
                  background: "linear-gradient(135deg, #fef3c7, #fde68a)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26,
                }}>
                  ☕
                </div>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 15, margin: "0 0 4px" }}>Premium Coffee Bundle</p>
                  <p style={{ color: "#78716c", fontSize: 13, margin: 0 }}>250g · Ethiopian Yirgacheffe</p>
                </div>
              </div>
              <div style={{ borderTop: "1px solid #e7e5e4", paddingTop: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ color: "#78716c", fontSize: 14 }}>Subtotal</span>
                  <span style={{ fontSize: 14 }}>5.00 USDC</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ color: "#78716c", fontSize: 14 }}>Network fee</span>
                  <span style={{ fontSize: 14, color: "#059669" }}>~0.00 XLM</span>
                </div>
                <div style={{ borderTop: "1px solid #e7e5e4", marginTop: 16, paddingTop: 16, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>Total</span>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>5.00 USDC</span>
                </div>
              </div>
              <div style={{ marginTop: 32, padding: "12px 16px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0" }}>
                <p style={{ fontSize: 12, color: "#15803d", margin: 0, lineHeight: 1.5 }}>
                  ✓ Non-custodial · Wallet-to-wallet settlement on Stellar.
                </p>
              </div>
            </div>

            {/* Right: payment */}
            <div style={{ padding: "40px 36px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <p style={{ fontSize: 12, color: "#a8a29e", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 28, fontWeight: 600 }}>
                Pay with Freighter
              </p>

              {pageState === "loading" && (
                <p style={{ color: "#a8a29e", fontSize: 14 }}>Preparing checkout…</p>
              )}

              {pageState === "error" && (
                <div>
                  <p style={{ color: "#dc2626", fontSize: 14, marginBottom: 8 }}>Could not load checkout.</p>
                  <p style={{ color: "#a8a29e", fontSize: 12 }}>{loadError}</p>
                </div>
              )}

              {pageState === "ready" && linkNumericId !== null && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <p style={{ color: "#57534e", fontSize: 14, margin: 0, lineHeight: 1.6 }}>
                    Click below to connect your Freighter wallet and complete the payment. No extra steps — the button handles everything.
                  </p>

                  <DemoCustomerCard />

                  {/* payerName/payerEmail props (2k): the button records the
                      payment.settled event with the platform itself — no
                      separate event post from this page. */}
                  <StellarPayButton
                    config={{ ...TESTNET, apiBase: API_BASE }}
                    merchant={MERCHANT}
                    amount={AMOUNT}
                    linkId={linkNumericId}
                    payerName={DEMO_CUSTOMER.name}
                    payerEmail={DEMO_CUSTOMER.email}
                    onSuccess={(hash) => {
                      setTxHash(hash);
                      setPageState("success");
                    }}
                    onError={(e) => setPayError(e.message)}
                    style={{
                      width: "100%", padding: "15px",
                      borderRadius: 10, border: "none",
                      cursor: "pointer", fontWeight: 600, fontSize: 15,
                      background: "#d97706", color: "#fff",
                    }}
                  />

                  {payError && <p style={{ fontSize: 12, color: "#dc2626", margin: 0 }}>{payError}</p>}

                  <p style={{ fontSize: 11, color: "#a8a29e", margin: 0, lineHeight: 1.5 }}>
                    Requires Freighter browser extension. Funds settle on Stellar testnet.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
