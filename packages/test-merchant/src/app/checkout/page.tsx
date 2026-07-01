"use client";

import Link from "next/link";
import { parseUsdc } from "@stellarpay/sdk";

// Placeholder — this page will be split into /checkout/hosted, /checkout/embedded,
// and /checkout/headless in phases 3c, 3d, and 3e respectively.

const AMOUNT = parseUsdc("5.00");
void AMOUNT; // used by future tab implementations

export default function CheckoutPage() {
  return (
    <CheckoutShell>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 0, minHeight: 480 }}>

        {/* Left: order summary */}
        <div style={{ padding: "40px 36px", borderRight: "1px solid #e7e5e4", background: "#fafaf9" }}>
          <p style={{ fontSize: 12, color: "#a8a29e", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 24, fontWeight: 600 }}>
            Order summary
          </p>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 32 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 10,
              background: "linear-gradient(135deg, #fef3c7, #fde68a)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0,
            }}>
              ☕
            </div>
            <div>
              <p style={{ fontWeight: 600, fontSize: 15, margin: "0 0 4px" }}>Premium Coffee Bundle</p>
              <p style={{ color: "#78716c", fontSize: 13, margin: 0 }}>250g · Ethiopian Yirgacheffe · Single origin</p>
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
              ✓ Powered by StellarPay — non-custodial, wallet-to-wallet settlement on Stellar.
            </p>
          </div>
        </div>

        {/* Right: payment UI (filled in per mode in 3c / 3d / 3e) */}
        <div style={{ padding: "40px 36px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", color: "#a8a29e" }}>
            <p style={{ fontSize: 14, marginBottom: 8 }}>Payment UI</p>
            <p style={{ fontSize: 12 }}>Implemented per mode in phases 3c / 3d / 3e</p>
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
          <span style={{ fontSize: 18 }}>☕</span>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 15, letterSpacing: "-0.01em" }}>Stellar Roast</span>
        </div>
        <span style={{ color: "#57534e", margin: "0 12px", fontSize: 16 }}>›</span>
        <span style={{ color: "#a8a29e", fontSize: 14 }}>Checkout</span>
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
