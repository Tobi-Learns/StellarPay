// Durable delivery for post-settlement DB writes (payment.settled events,
// subscription registration, subscription.created events).
//
// Why this exists (open bug B2): a payment/subscription settles on-chain in one
// leg and is recorded in the platform DB in a separate leg. The recording leg
// used to be an unawaited, error-swallowing `fetch(...).catch(() => {})` fired
// immediately before navigating away — so any transient failure (network blip,
// serverless cold-path error, the request being deprioritized/aborted as the
// page navigated) dropped the record permanently. Nothing retried it, surfaced
// it, or reconciled it against the chain.
//
// This module makes that leg durable:
//   1. `recordDurable` retries the write a few times (awaited) before the caller
//      navigates, closing the common transient-failure window.
//   2. If it still fails, the write is persisted to a localStorage outbox and
//      `flushOutbox` re-attempts delivery on every app load — so a failure that
//      outlives the checkout page still self-heals the next time the customer is
//      in the app (e.g. lands on the receipt/portal, or returns later).
//
// All target endpoints are idempotent, so re-delivery is always safe:
//   - POST /api/events upserts by txHash (a duplicate returns 2xx).
//   - POST /api/subscriptions upserts by onChainId; a duplicate *active* sub on
//     the same plan returns 409 — which, for our purposes, also means "already
//     recorded", so we treat it as delivered.

const STORAGE_KEY = "stellarpay.settlement_outbox.v1";
const MAX_ENTRIES = 50;

export interface OutboxEntry {
  /** Stable de-dup key (e.g. `event:<txHash>` or `sub:<onChainId>`). */
  key: string;
  /** Same-origin API path, e.g. "/api/events". */
  url: string;
  /** JSON body to POST. */
  body: unknown;
  /** When first queued (ms epoch) — for ordering + pruning. */
  queuedAt: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function readOutbox(): OutboxEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OutboxEntry[]) : [];
  } catch {
    return [];
  }
}

function writeOutbox(entries: OutboxEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    // Keep the newest MAX_ENTRIES so a long-broken backend can't grow this
    // unbounded; oldest pending writes are dropped first.
    const trimmed = entries.slice(-MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* storage full / disabled — nothing we can durably do */
  }
}

function enqueue(entry: Omit<OutboxEntry, "queuedAt">): void {
  const entries = readOutbox().filter((e) => e.key !== entry.key);
  entries.push({ ...entry, queuedAt: Date.now() });
  writeOutbox(entries);
}

function dequeue(key: string): void {
  writeOutbox(readOutbox().filter((e) => e.key !== key));
}

/**
 * Deliver one write. Resolves true when the record is known to be persisted.
 * A 409 counts as delivered (duplicate active subscription = already recorded).
 * Network errors and 5xx/4xx (other than 409) resolve false so the caller can
 * retry or persist for later.
 */
async function deliverOnce(url: string, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true, // let the request outlive a client-side navigation
    });
    return res.ok || res.status === 409;
  } catch {
    return false;
  }
}

/**
 * Record a settlement write durably. Retries a few times before returning; on
 * final failure, persists to the outbox for `flushOutbox` to retry on next load.
 * Always resolves (never throws) — the on-chain action already succeeded, so the
 * caller should proceed regardless of recording latency.
 *
 * @returns true if the record was confirmed delivered before returning.
 */
export async function recordDurable(entry: Omit<OutboxEntry, "queuedAt">): Promise<boolean> {
  const backoffs = [0, 500, 1500]; // 3 attempts, ~2s worst case before we give up inline
  for (let i = 0; i < backoffs.length; i++) {
    if (backoffs[i]) await sleep(backoffs[i]);
    if (await deliverOnce(entry.url, entry.body)) {
      dequeue(entry.key); // clear any prior persisted copy
      return true;
    }
  }
  enqueue(entry); // persist for later self-healing
  return false;
}

/**
 * Attempt to deliver every persisted outbox entry once. Safe to call on every
 * app load; delivered entries are removed, the rest stay for the next attempt.
 * Runs sequentially (oldest first) and never throws.
 */
export async function flushOutbox(): Promise<void> {
  const entries = readOutbox().sort((a, b) => a.queuedAt - b.queuedAt);
  for (const entry of entries) {
    if (await deliverOnce(entry.url, entry.body)) dequeue(entry.key);
  }
}
