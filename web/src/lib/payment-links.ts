export interface PaymentLink {
  id: string;          // Snowflake u64 string — used as link_id in the contract
  extId?: string;      // plink_ + ULID — external handle (3.2); absent on localStorage-only rows
  merchant: string;    // Stellar address
  amount: string;      // stroops as string (BigInt serialised)
  productName?: string;
  description: string;
  archivedAt?: string | null;
  createdAt: number;
  url: string;
}

const STORAGE_KEY = "stellarpay_payment_links";

// Legacy decoder — kept only so old self-contained base64 blob links (shared
// before the ids change) still resolve on /pay. New links are plain numericIds.
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
