"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDemoCustomer, setDemoCustomer } from "@/lib/demo-customer";

// 3.3a — simple demo customer profile (no auth). Name + email persist in
// localStorage and flow into every checkout/subscribe as payerName/payerEmail.
export default function SettingsPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const c = getDemoCustomer();
    setName(c.name);
    setEmail(c.email);
  }, []);

  function save(e: React.FormEvent) {
    e.preventDefault();
    setDemoCustomer({ name: name.trim(), email: email.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "11px 13px", borderRadius: 8, border: "1px solid #e7e5e4",
    fontSize: 14, color: "#1c1917", background: "#fff", outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12, color: "#78716c", fontWeight: 600, marginBottom: 6, display: "block",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#fafaf9" }}>
      <nav style={{ background: "#1c1917", padding: "0 32px", display: "flex", alignItems: "center", height: 56 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18, color: "#059669", fontWeight: 800 }}>SR</span>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Stellar Roast</span>
        </div>
        <span style={{ color: "#57534e", margin: "0 12px", fontSize: 16 }}>/</span>
        <span style={{ color: "#a8a29e", fontSize: 14 }}>Settings</span>
      </nav>

      <div style={{ maxWidth: 520, margin: "48px auto", background: "#fff", borderRadius: 16, border: "1px solid #e7e5e4", overflow: "hidden" }}>
        <div style={{ padding: "16px 28px", borderBottom: "1px solid #e7e5e4", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ fontSize: 13, color: "#78716c", textDecoration: "none" }}>
            Back to shop
          </Link>
          <p style={{ fontSize: 12, color: "#a8a29e", margin: 0 }}>Demo profile</p>
        </div>

        <form onSubmit={save} style={{ padding: "28px" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>Customer profile</h1>
          <p style={{ fontSize: 13, color: "#78716c", margin: "0 0 24px", lineHeight: 1.5 }}>
            Used as the payer identity across every checkout and subscription in this demo. No account or sign-in — saved in your browser.
          </p>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle} htmlFor="name">Name</label>
            <input id="name" style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Jerry Rig" />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle} htmlFor="email">Email</label>
            <input id="email" type="email" style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jerryrig@gmail.com" />
          </div>

          <button
            type="submit"
            style={{
              width: "100%", padding: "13px", borderRadius: 10, border: "none", cursor: "pointer",
              fontWeight: 600, fontSize: 15, background: "#059669", color: "#fff",
            }}
          >
            {saved ? "Saved ✓" : "Save profile"}
          </button>
        </form>
      </div>
    </div>
  );
}
