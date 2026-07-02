"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { parseUsdc } from "@stellarpay/sdk";

const API_BASE = process.env.NEXT_PUBLIC_STELLARPAY_API_BASE ?? "http://localhost:3000";
const MERCHANT_ADDRESS = process.env.NEXT_PUBLIC_MERCHANT_ADDRESS ?? "";
const AMOUNT = parseUsdc("1.00");
const INTERVAL_LABEL = "Monthly (demo: 4 min)";

type State = "finding" | "redirecting" | "error";

export default function HostedSubscribePage() {
  const [state, setState] = useState<State>("finding");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: AMOUNT.toString(),
        intervalLabel: INTERVAL_LABEL,
        merchant: MERCHANT_ADDRESS,
      }),
    })
      .then((res) => res.json())
      .then((data: { planId?: string | null; error?: string }) => {
        if (!data.planId) {
          throw new Error(data.error ?? "No hosted subscription plan found for 1.00 USDC");
        }
        if (!mounted) return;
        setState("redirecting");
        window.location.assign(`${API_BASE}/subscribe/${data.planId}`);
      })
      .catch((e: unknown) => {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : String(e));
        setState("error");
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <HostedShell>
      <div style={{ minHeight: 360, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 40, textAlign: "center" }}>
        <p style={{ color: "#a8a29e", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", margin: 0, textTransform: "uppercase" }}>
          Hosted subscription
        </p>
        <h1 style={{ fontSize: 24, margin: 0 }}>Monthly Coffee Club</h1>
        <p style={{ color: "#57534e", fontSize: 14, margin: 0 }}>
          {state === "finding" && "Finding the StellarPay hosted plan for 1.00 USDC/mo..."}
          {state === "redirecting" && "Redirecting to StellarPay..."}
          {state === "error" && "Could not open hosted subscription checkout."}
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
        <span style={{ color: "#a8a29e", fontSize: 14 }}>Hosted subscription</span>
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
