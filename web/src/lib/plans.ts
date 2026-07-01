export const INTERVALS = [
  { label: "Demo (50 ledgers ≈ 4 min)", value: 50 },
  { label: "Daily (17,280 ledgers)", value: 17280 },
  { label: "Weekly (120,960 ledgers)", value: 120960 },
  { label: "Monthly (518,400 ledgers)", value: 518400 },
];

export interface StoredPlan {
  onChainId: string;    // u64 as string
  merchant: string;
  amount: string;       // stroops
  interval: number;     // ledgers
  intervalLabel: string;
  createdAt: number;
}

export interface StoredSubscription {
  onChainId: string;    // sub ID u64 as string
  planId: string;       // plan ID u64 as string
  subscriber: string;
  merchant: string;
  amount: string;       // stroops (plan amount)
  interval: number;
  intervalLabel: string;
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
