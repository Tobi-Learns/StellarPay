import type { Interval, IntervalUnit } from "./billing-schedule";

/** Billing interval options for the create-plan form. Real calendar units (2.1). */
export const INTERVALS: { label: string; unit: IntervalUnit; count: number }[] = [
  { label: "Demo (every 5 minutes)", unit: "minute", count: 5 },
  { label: "Daily", unit: "day", count: 1 },
  { label: "Weekly", unit: "week", count: 1 },
  { label: "Monthly", unit: "month", count: 1 },
  { label: "Quarterly", unit: "month", count: 3 },
  { label: "Yearly", unit: "year", count: 1 },
];

export function intervalOf(p: { intervalUnit: IntervalUnit; intervalCount: number }): Interval {
  return { unit: p.intervalUnit, count: p.intervalCount };
}

export interface StoredPlan {
  onChainId: string;    // u64 as string — on-chain id, used for routing/contract
  extId?: string;       // plan_ + ULID — external handle shown in the dashboard (3.2); absent on localStorage-only rows
  merchant: string;
  amount: string;       // stroops
  interval: number;     // min_interval_secs — the on-chain cadence floor
  intervalLabel: string;
  // Optional: present when written by the create-plan form; the list views that
  // hydrate from the API only need the label.
  intervalUnit?: IntervalUnit;
  intervalCount?: number;
  createdAt: number;
}

export interface StoredSubscription {
  onChainId: string;    // sub ID u64 as string — on-chain id, used for routing/contract
  extId?: string;       // sub_ + ULID — external handle shown in the dashboard (3.2); absent on localStorage-only rows
  planId: string;       // plan ID u64 as string
  planExtId?: string;   // plan_ + ULID of the plan this sub is on — cross-reference display (3.2f)
  subscriber: string;
  merchant: string;
  amount: string;       // stroops (plan amount)
  interval: number;     // min_interval_secs
  intervalLabel: string;
  // Optional: interval details live on the plan, so subscription rows hydrated
  // from the API won't carry them — only the localStorage write-through does.
  intervalUnit?: IntervalUnit;
  intervalCount?: number;
  anchorAt?: string;    // ISO subscribe date
  periodsCharged?: number;
  createdAt: number;
}

const PLANS_KEY = "stellarpay_plans";
const SUBS_KEY = "stellarpay_subscriptions";

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(key) ?? "[]"); } catch { return []; }
}

function write<T>(key: string, items: T[]): void {
  localStorage.setItem(key, JSON.stringify(items));
}

export function savePlan(plan: StoredPlan): void {
  const existing = read<StoredPlan>(PLANS_KEY);
  existing.unshift(plan);
  write(PLANS_KEY, existing);
}

export function loadPlans(): StoredPlan[] {
  return read<StoredPlan>(PLANS_KEY);
}

export function saveSubscription(sub: StoredSubscription): void {
  const existing = read<StoredSubscription>(SUBS_KEY);
  existing.unshift(sub);
  write(SUBS_KEY, existing);
}

export function loadSubscriptions(): StoredSubscription[] {
  return read<StoredSubscription>(SUBS_KEY);
}

export function findSubscription(onChainId: string): StoredSubscription | undefined {
  return loadSubscriptions().find((s) => s.onChainId === onChainId);
}
