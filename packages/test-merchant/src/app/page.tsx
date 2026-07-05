"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { WebhookEntry } from "@/lib/webhook-log";

type Tab = "hosted" | "embedded" | "headless";

const TAB_META: Record<Tab, { label: string; badge: string; desc: string }> = {
  hosted: {
    label: "Hosted Link",
    badge: "Simplest",
    desc: "Server creates a checkout link via API key. Customer is redirected to StellarPay's hosted page — zero payment code on your site.",
  },
  embedded: {
    label: "Embedded Widget",
    badge: "Drop-in",
    desc: "A <StellarPayButton> component handles the full payment inline. Wallet connection and signing are built into the button.",
  },
  headless: {
    label: "Headless / Custom",
    badge: "Full control",
    desc: "Build your own checkout UI using raw SDK methods. Total control over UX — no component needed.",
  },
};

// Checkout routes per mode (checkout pages implemented in 3c / 3d / 3e)
const CHECKOUT_HREF: Record<Tab, string> = {
  hosted: "/checkout/hosted",
  embedded: "/checkout/embedded",
  headless: "/checkout/headless",
};

const SUBSCRIBE_HREF: Record<Tab, string> = {
  hosted: "/subscribe/hosted",
  embedded: "/subscribe/embedded",
  headless: "/subscribe/headless",
};

const TAB_PRICES: Record<Tab, { oneTime: string; subscription: string }> = {
  hosted: { oneTime: "4", subscription: "1" },
  embedded: { oneTime: "5", subscription: "2" },
  headless: { oneTime: "7", subscription: "3" },
};

export default function Page() {
  const [tab, setTab] = useState<Tab>("hosted");
  const meta = TAB_META[tab];
  const prices = TAB_PRICES[tab];
  const oneTimePrice = `$${prices.oneTime}.00`;
  const subscriptionPrice = `$${prices.subscription}.00`;
  const oneTimeButtonLabel = tab === "hosted"
    ? "Checkout via StellarPay →"
    : `Buy Now — ${prices.oneTime} USDC`;
  const subscriptionButtonLabel = tab === "hosted"
    ? "Subscribe via StellarPay →"
    : `Subscribe — ${prices.subscription} USDC/mo`;

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Nav */}
      <nav style={{ background: "#1c1917", padding: "0 32px", display: "flex", alignItems: "center", height: 60 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>☕</span>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 16, letterSpacing: "-0.01em" }}>Stellar Roast</span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 20 }}>
          <a href="/account" style={{ color: "#a8a29e", fontSize: 14, textDecoration: "none" }}>My subscriptions</a>
          <a href="/settings" style={{ color: "#a8a29e", fontSize: 14, textDecoration: "none" }}>Settings</a>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #292524 0%, #1c1917 100%)", padding: "80px 32px", textAlign: "center" }}>
        <p style={{ color: "#d97706", fontSize: 13, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
          Specialty Coffee on Stellar
        </p>
        <h1 style={{ color: "#fff", fontSize: 42, fontWeight: 700, margin: "0 0 16px", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
          The finest beans,<br />settled on-chain.
        </h1>
        <p style={{ color: "#a8a29e", fontSize: 16, maxWidth: 440, margin: "0 auto" }}>
          Pay once or subscribe monthly. All payments processed via StellarPay — instant, borderless, non-custodial.
        </p>
      </div>

      {/* Integration pattern tabs */}
      <div style={{ borderBottom: "1px solid #e7e5e4", background: "#fff" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 32px", display: "flex", gap: 0 }}>
          {(Object.keys(TAB_META) as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "16px 24px", border: "none", cursor: "pointer", background: "none",
                fontSize: 13, fontWeight: tab === t ? 600 : 400,
                color: tab === t ? "#1c1917" : "#78716c",
                borderBottom: tab === t ? "2px solid #d97706" : "2px solid transparent",
                transition: "color 0.15s",
              }}
            >
              {TAB_META[t].label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab description bar */}
      <div style={{ background: "#fafaf9", borderBottom: "1px solid #e7e5e4", padding: "14px 32px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{
            padding: "2px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600,
            background: "#1c1917", color: "#fff",
          }}>
            {meta.badge}
          </span>
          <span style={{ fontSize: 13, color: "#57534e" }}>{meta.desc}</span>
        </div>
      </div>

      {/* Products */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "48px 32px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

        {/* One-time product */}
        <div style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 16, overflow: "hidden" }}>
          <div style={{ background: "linear-gradient(135deg, #fef3c7, #fde68a)", height: 200, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 64 }}>
            ☕
          </div>
          <div style={{ padding: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Premium Coffee Bundle</h2>
              <span style={{ fontSize: 20, fontWeight: 700, color: "#d97706" }}>{oneTimePrice}</span>
            </div>
            <p style={{ color: "#78716c", fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
              250g of single-origin Ethiopian Yirgacheffe, freshly roasted. Bright, floral, and full of life.
            </p>
            <div style={{ fontSize: 12, color: "#a8a29e", marginBottom: 20 }}>
              ✓ One-time payment &nbsp;·&nbsp; ✓ Instant settlement &nbsp;·&nbsp; ✓ Non-custodial
            </div>
            <Link
              href={CHECKOUT_HREF[tab]}
              style={{
                display: "block", textAlign: "center",
                padding: "14px", borderRadius: 10,
                fontWeight: 600, fontSize: 15,
                background: "#1c1917", color: "#fff",
                textDecoration: "none",
              }}
            >
              {oneTimeButtonLabel}
            </Link>
          </div>
        </div>

        {/* Subscription product */}
        <div style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 16, overflow: "hidden" }}>
          <div style={{ background: "linear-gradient(135deg, #ecfdf5, #a7f3d0)", height: 200, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 64 }}>
            🌱
          </div>
          <div style={{ padding: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Monthly Coffee Club</h2>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: "#059669" }}>{subscriptionPrice}</span>
                <span style={{ fontSize: 12, color: "#78716c" }}>/mo</span>
              </div>
            </div>
            <p style={{ color: "#78716c", fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
              A rotating selection of seasonal single-origins delivered monthly. Approve once — we charge automatically.
            </p>
            <div style={{ fontSize: 12, color: "#a8a29e", marginBottom: 20 }}>
              ✓ Recurring billing &nbsp;·&nbsp; ✓ Cancel anytime &nbsp;·&nbsp; ✓ SAC allowance model
            </div>
            <Link
              href={SUBSCRIBE_HREF[tab]}
              style={{
                display: "block", textAlign: "center",
                padding: "14px", borderRadius: 10,
                fontWeight: 600, fontSize: 15,
                background: "#059669", color: "#fff",
                textDecoration: "none",
              }}
            >
              {subscriptionButtonLabel}
            </Link>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div style={{ background: "#fff", borderTop: "1px solid #e7e5e4", padding: "64px 32px", textAlign: "center" }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Powered by StellarPay</h2>
        <p style={{ color: "#78716c", fontSize: 14, marginBottom: 48 }}>No custodians. No intermediaries. Settle directly on Stellar.</p>
        <div style={{ display: "flex", justifyContent: "center", gap: 48, flexWrap: "wrap" }}>
          {[
            { n: "01", title: "Connect", desc: "Link your Freighter wallet" },
            { n: "02", title: "Sign", desc: "Approve the transaction in Freighter" },
            { n: "03", title: "Settled", desc: "Funds arrive instantly on-chain" },
          ].map(({ n, title, desc }) => (
            <div key={n} style={{ maxWidth: 180 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#d97706", marginBottom: 8 }}>{n}</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: 13, color: "#78716c" }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      <WebhookFeed />

      <footer style={{ background: "#1c1917", color: "#78716c", fontSize: 12, textAlign: "center", padding: "24px 32px" }}>
        Stellar Roast is a demo merchant built with{" "}
        <a
          href={process.env.NEXT_PUBLIC_STELLARPAY_API_BASE ?? "http://localhost:3000"}
          target="_blank" rel="noreferrer"
          style={{ color: "#d97706" }}
        >
          StellarPay
        </a>. Testnet only.
      </footer>
    </div>
  );
}

function WebhookFeed() {
  const [events, setEvents] = useState<WebhookEntry[]>([]);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/webhook");
        setEvents(await res.json() as WebhookEntry[]);
      } catch { /* ignore */ }
    };
    poll();
    ref.current = setInterval(poll, 4000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, []);

  if (events.length === 0) return null;

  return (
    <div style={{ background: "#1c1917", padding: "32px", borderTop: "1px solid #292524" }}>
      <p style={{ color: "#78716c", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
        ⚡ Webhook events received
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {events.slice(0, 5).map((e, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: "#292524", borderRadius: 8, padding: "10px 14px" }}>
            <span style={{
              padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600,
              background: e.verified ? "#064e3b" : "#450a0a",
              color: e.verified ? "#34d399" : "#f87171",
            }}>
              {e.verified ? "✓ verified" : "✗ unverified"}
            </span>
            <span style={{ fontFamily: "monospace", fontSize: 12, color: "#d6d3d1" }}>{e.type}</span>
            <span style={{ fontSize: 11, color: "#57534e", marginLeft: "auto" }}>{new Date(e.ts).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
