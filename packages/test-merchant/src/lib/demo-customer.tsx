"use client";

// Demo customer persona used across every test-merchant flow. Editable via the
// /settings page and persisted in localStorage (no auth — this is a demo).
// Defaults to "Jerry Rig" so a fresh browser still shows a consistent identity.
import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "sr_demo_customer";
const DEFAULT: DemoCustomer = { name: "Jerry Rig", email: "jerryrig@gmail.com" };

export type DemoCustomer = { name: string; email: string };

/** Read the current profile synchronously (for use inside event handlers). */
export function getDemoCustomer(): DemoCustomer {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<DemoCustomer>;
    return { name: parsed.name?.trim() || DEFAULT.name, email: parsed.email?.trim() || DEFAULT.email };
  } catch {
    return DEFAULT;
  }
}

/** Persist the profile and notify any mounted `useDemoCustomer` consumers. */
export function setDemoCustomer(next: DemoCustomer): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("demo-customer-change"));
}

/** Reactive profile for components (re-renders when it changes or in another tab). */
export function useDemoCustomer(): DemoCustomer {
  const [customer, setCustomer] = useState<DemoCustomer>(DEFAULT);
  useEffect(() => {
    const sync = () => setCustomer(getDemoCustomer());
    sync();
    window.addEventListener("demo-customer-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("demo-customer-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return customer;
}

/** "Customer" card rendered on checkout/subscribe pages; links to /settings. */
export function DemoCustomerCard() {
  const customer = useDemoCustomer();
  return (
    <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, padding: "12px 14px", background: "#fafaf9" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontSize: 11, color: "#a8a29e", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px", fontWeight: 600 }}>
          Customer
        </p>
        <Link href="/settings" style={{ fontSize: 11, color: "#059669", textDecoration: "none", fontWeight: 600 }}>
          Edit
        </Link>
      </div>
      <p style={{ fontSize: 14, color: "#1c1917", margin: 0, fontWeight: 600 }}>{customer.name}</p>
      <p style={{ fontSize: 13, color: "#78716c", margin: "2px 0 0" }}>{customer.email}</p>
    </div>
  );
}
