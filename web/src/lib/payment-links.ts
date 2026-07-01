export interface PaymentLink {
  id: string;          // timestamp string — used as u64 in the contract
  merchant: string;    // Stellar address
  amount: string;      // stroops as string (BigInt serialised)
  description: string;
  createdAt: number;
  url: string;
}

const STORAGE_KEY = "stellarpay_payment_links";

export function encodeLink(data: Omit<PaymentLink, "url">): string {
  const json = JSON.stringify(data);
  // URL-safe base64 (no padding)
  return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function decodeLink(encoded: string): Omit<PaymentLink, "url"> {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return JSON.parse(atob(padded));
}

export function saveLink(link: PaymentLink): void {
  const existing = loadLinks();
  existing.unshift(link);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

export function loadLinks(): PaymentLink[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}
