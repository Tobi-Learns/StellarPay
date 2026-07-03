"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_STELLARPAY_API_BASE ?? "http://localhost:3000";
// Pre-provisioned link id (numericId) from the seed — see scripts/seed-test-merchant.mjs.
const LINK_ID = process.env.NEXT_PUBLIC_DEMO_CHECKOUT_HOSTED ?? "";

type State = "redirecting" | "error";

export default function HostedCheckoutPage() {
  const [state, setState] = useState<State>("redirecting");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!LINK_ID) {
      setError("Demo catalog not configured — set NEXT_PUBLIC_DEMO_CHECKOUT_HOSTED (run scripts/seed-test-merchant.mjs).");
      setState("error");
      return;
    }
    // The merchant already provisioned this link; hand off to hosted checkout by id.
    window.location.assign(`${API_BASE}/pay/${LINK_ID}`);
  }, []);

  return (
    <HostedShell>
      <div style={{ minHeight: 360, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 40, textAlign: "center" }}>
        <p style={{ color: "#a8a29e", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", margin: 0, textTransform: "uppercase" }}>
          Hosted checkout
        </p>
        <h1 style={{ fontSize: 24, margin: 0 }}>Premium Coffee Bundle</h1>
        <p style={{ color: "#57534e", fontSize: 14, margin: 0 }}>
          {state === "redirecting" && "Redirecting to StellarPay hosted checkout..."}
          {state === "error" && "Could not open hosted checkout."}
        </p>
        {state === "error" && <p style={{ color: "#dc2626", fontSize: 12, margin: 0 }}>{error}</p>}
      </div>
    </HostedShell>
  );
}

function HostedShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#fafaf9" }}>
      <nav style={{ background: "#1c1917", padding: "0 32px", display: "flex", alignItems: "center", height: 56 }}>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Stellar Roast</span>
        <span style={{ color: "#57534e", margin: "0 12px", fontSize: 16 }}>/</span>
        <span style={{ color: "#a8a29e", fontSize: 14 }}>Hosted checkout</span>
      </nav>
      <div style={{ maxWidth: 640, margin: "64px auto", background: "#fff", borderRadius: 16, border: "1px solid #e7e5e4", overflow: "hidden" }}>
        <div style={{ padding: "16px 28px", borderBottom: "1px solid #e7e5e4", display: "flex", justifyContent: "space-between" }}>
          <Link href="/" style={{ fontSize: 13, color: "#78716c", textDecoration: "none" }}>Back to shop</Link>
          <p style={{ fontSize: 12, color: "#a8a29e", margin: 0 }}>Redirects to StellarPay</p>
        </div>
        {children}
      </div>
    </div>
  );
}
