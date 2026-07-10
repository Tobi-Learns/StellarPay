// Durable delivery for settlement records posted from the browser (the SDK's
// recordPaymentSettled). Mirrors the platform's settlement outbox.
//
// Why: a payment settles on-chain in one leg and is recorded via a separate
// POST /api/events. Callers fire that record-and-forget, so a transient failure
// (network blip, cross-origin hiccup, the tab moving to a success screen) drops
// a real, settled payment with nothing to retry it. This persists a failed
// record to localStorage and re-delivers it on the next client init.
//
// The target endpoint is idempotent (events upsert by txHash), so re-delivery
// is always safe. Browser-only and dependency-free; a no-op without localStorage.

const STORAGE_KEY = "stellarpay.record_outbox.v1";
const MAX_ENTRIES = 50;

export interface RecordEntry {
  /** Stable de-dup key, e.g. `event:<txHash>`. */
  key: string;
  /** Absolute endpoint URL to POST to (apiBase + path). */
  url: string;
  /** JSON body. */
  body: unknown;
  /** When first queued (ms epoch). */
  queuedAt: number;
}

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

function read(): RecordEntry[] {
  const s = storage();
  if (!s) return [];
  try {
    const raw = s.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as RecordEntry[]) : [];
  } catch {
    return [];
  }
}

function write(entries: RecordEntry[]): boolean {
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
    return true;
  } catch {
    return false;
  }
}

/** Persist a failed record for later re-delivery. Returns false if no storage. */
export function queueRecord(entry: Omit<RecordEntry, "queuedAt">): boolean {
  const entries = read().filter((e) => e.key !== entry.key);
  entries.push({ ...entry, queuedAt: Date.now() });
  return write(entries);
}

function dequeue(key: string): void {
  write(read().filter((e) => e.key !== key));
}

/**
 * POST once. Resolves true when the record is known persisted — `res.ok` or a
 * 409 (idempotent duplicate = already recorded). Network/other errors → false.
 */
export async function deliverRecord(url: string, body: unknown): Promise<boolean> {
  // Collapse accidental double slashes in the path (e.g. from a trailing-slash
  // apiBase) — `//api/events` 308-redirects, which fails a CORS preflight. This
  // also heals records queued before the apiBase normalization landed.
  const cleanUrl = url.replace(/([^:])\/{2,}/g, "$1/");
  try {
    const res = await fetch(cleanUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true, // survive a client-side navigation (e.g. success screen)
    });
    return res.ok || res.status === 409;
  } catch {
    return false;
  }
}

/**
 * Re-attempt every persisted record once, oldest first; drop the delivered
 * ones. Safe to call on every client construction. Never throws.
 */
export async function flushRecords(): Promise<void> {
  const entries = read().sort((a, b) => a.queuedAt - b.queuedAt);
  for (const entry of entries) {
    if (await deliverRecord(entry.url, entry.body)) dequeue(entry.key);
  }
}
