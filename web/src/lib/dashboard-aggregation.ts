const DAY_MS = 86_400_000;

export const DASHBOARD_ACTIVITY_TYPES = [
  "payment.settled",
  "subscription.created",
  "subscription.charged",
  "subscription.past_due",
  "subscription.canceled",
  "subscription.needs_reauthorization",
] as const;

const SUCCESS_TYPES = new Set([
  "payment.settled",
  "subscription.created",
  "subscription.charged",
]);

type JsonRecord = Record<string, unknown>;

export interface DashboardEventInput {
  extId: string;
  type: string;
  txHash: string;
  createdAt: Date;
  data: unknown;
  paymentLink: {
    numericId: string;
    productName: string;
    amount: string;
  } | null;
  subscription: {
    onChainId: string;
    amount: string;
    subscriber: string;
    payerName: string | null;
    payerEmail: string | null;
    plan: {
      onChainId: string;
      productName: string;
    };
  } | null;
}

export interface PeriodMetrics {
  volumeReceived: string;
  oneTimeVolume: string;
  recurringVolume: string;
  successfulPayments: number;
  oneTimePayments: number;
  recurringCharges: number;
}

export interface TopProduct {
  key: string;
  kind: "payment_link" | "plan";
  productName: string;
  volumeReceived: string;
  payments: number;
  customers: number;
  href: string | null;
}

export interface RecentSale {
  extId: string;
  txHash: string;
  createdAt: string;
  eventType: string;
  paymentType: "one_time" | "recurring";
  status: "succeeded" | "past_due" | "canceled" | "needs_reauthorization";
  productName: string;
  customerName: string | null;
  customerEmail: string | null;
  amount: string | null;
  href: string | null;
}

export interface DashboardComparison {
  text: string;
  tone: "positive" | "negative" | "muted";
}

function dataOf(event: DashboardEventInput): JsonRecord {
  return event.data && typeof event.data === "object" && !Array.isArray(event.data)
    ? (event.data as JsonRecord)
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function periodsOf(event: DashboardEventInput): bigint {
  if (event.type !== "subscription.charged") return BigInt(1);
  const periods = dataOf(event).periods;
  return typeof periods === "number" && Number.isInteger(periods) && periods > 0
    ? BigInt(periods)
    : BigInt(1);
}

export function amountForDashboardEvent(event: DashboardEventInput): bigint | null {
  if (!SUCCESS_TYPES.has(event.type)) return null;
  if (event.type === "payment.settled") {
    const raw = stringValue(dataOf(event).amount) ?? event.paymentLink?.amount ?? null;
    return raw ? BigInt(raw) : null;
  }
  return event.subscription
    ? BigInt(event.subscription.amount) * periodsOf(event)
    : null;
}

export function dashboardWindow(now: Date) {
  const currentEnd = new Date(now);
  const currentStart = new Date(now.getTime() - 7 * DAY_MS);
  const previousStart = new Date(now.getTime() - 14 * DAY_MS);
  return { currentStart, currentEnd, previousStart };
}

export function compareDashboardPeriods(
  currentValue: string | number,
  previousValue: string | number,
): DashboardComparison {
  const current = BigInt(currentValue);
  const previous = BigInt(previousValue);
  if (current === BigInt(0) && previous === BigInt(0)) {
    return { text: "No activity in either period", tone: "muted" };
  }
  if (previous === BigInt(0)) {
    return { text: "New activity this period", tone: "positive" };
  }
  const tenths = Number(((current - previous) * BigInt(1000)) / previous) / 10;
  if (tenths === 0) return { text: "Flat vs previous 7 days", tone: "muted" };
  return {
    text: `${tenths > 0 ? "+" : ""}${tenths.toFixed(1)}% vs previous 7 days`,
    tone: tenths > 0 ? "positive" : "negative",
  };
}

export function splitDashboardPeriods(events: DashboardEventInput[], now: Date) {
  const window = dashboardWindow(now);
  return {
    ...window,
    currentEvents: events.filter(
      (event) => event.createdAt >= window.currentStart && event.createdAt < window.currentEnd,
    ),
    previousEvents: events.filter(
      (event) => event.createdAt >= window.previousStart && event.createdAt < window.currentStart,
    ),
  };
}

export function summarizePeriod(events: DashboardEventInput[]): PeriodMetrics {
  let oneTimeVolume = BigInt(0);
  let recurringVolume = BigInt(0);
  let oneTimePayments = 0;
  let recurringCharges = 0;

  for (const event of events) {
    const amount = amountForDashboardEvent(event);
    if (amount === null) continue;
    if (event.type === "payment.settled") {
      oneTimeVolume += amount;
      oneTimePayments += 1;
    } else {
      recurringVolume += amount;
      recurringCharges += 1;
    }
  }

  return {
    volumeReceived: (oneTimeVolume + recurringVolume).toString(),
    oneTimeVolume: oneTimeVolume.toString(),
    recurringVolume: recurringVolume.toString(),
    successfulPayments: oneTimePayments + recurringCharges,
    oneTimePayments,
    recurringCharges,
  };
}

function productForEvent(event: DashboardEventInput) {
  const data = dataOf(event);
  if (event.type === "payment.settled") {
    const id = event.paymentLink?.numericId ?? stringValue(data.linkId);
    return {
      key: `payment_link:${id ?? stringValue(data.productName) ?? event.txHash}`,
      kind: "payment_link" as const,
      productName: event.paymentLink?.productName ?? stringValue(data.productName) ?? "Payment",
      href: id ? `/app/payments/${id}` : null,
    };
  }
  const id = event.subscription?.plan.onChainId ?? stringValue(data.planId);
  return {
    key: `plan:${id ?? stringValue(data.productName) ?? event.txHash}`,
    kind: "plan" as const,
    productName: event.subscription?.plan.productName ?? stringValue(data.productName) ?? "Subscription",
    href: id ? `/app/billing/plans/${id}` : null,
  };
}

function customerKey(event: DashboardEventInput): string {
  const data = dataOf(event);
  return (
    stringValue(data.payerEmail)?.toLowerCase() ??
    stringValue(data.payerWallet) ??
    event.subscription?.payerEmail?.toLowerCase() ??
    event.subscription?.subscriber ??
    stringValue(data.payerName)?.toLowerCase() ??
    event.txHash
  );
}

export function rankTopProducts(events: DashboardEventInput[], limit = 5): TopProduct[] {
  const products = new Map<
    string,
    Omit<TopProduct, "volumeReceived" | "customers"> & { volume: bigint; customerKeys: Set<string> }
  >();

  for (const event of events) {
    const amount = amountForDashboardEvent(event);
    if (amount === null) continue;
    const product = productForEvent(event);
    const current = products.get(product.key) ?? {
      ...product,
      volume: BigInt(0),
      payments: 0,
      customerKeys: new Set<string>(),
    };
    current.volume += amount;
    current.payments += 1;
    current.customerKeys.add(customerKey(event));
    products.set(product.key, current);
  }

  return [...products.values()]
    .sort((a, b) => {
      if (a.volume !== b.volume) return a.volume > b.volume ? -1 : 1;
      if (a.payments !== b.payments) return b.payments - a.payments;
      return a.productName.localeCompare(b.productName);
    })
    .slice(0, limit)
    .map(({ volume, customerKeys, ...product }) => ({
      ...product,
      volumeReceived: volume.toString(),
      customers: customerKeys.size,
    }));
}

function recentStatus(type: string): RecentSale["status"] {
  if (type === "subscription.past_due") return "past_due";
  if (type === "subscription.canceled") return "canceled";
  if (type === "subscription.needs_reauthorization") return "needs_reauthorization";
  return "succeeded";
}

export function toRecentSale(event: DashboardEventInput): RecentSale {
  const data = dataOf(event);
  const recurring = event.type.startsWith("subscription.");
  const product = productForEvent(event);
  return {
    extId: event.extId,
    txHash: event.txHash,
    createdAt: event.createdAt.toISOString(),
    eventType: event.type,
    paymentType: recurring ? "recurring" : "one_time",
    status: recentStatus(event.type),
    productName: product.productName,
    customerName: stringValue(data.payerName) ?? event.subscription?.payerName ?? null,
    customerEmail: stringValue(data.payerEmail) ?? event.subscription?.payerEmail ?? null,
    amount: amountForDashboardEvent(event)?.toString() ?? null,
    href:
      event.type === "payment.settled"
        ? `/app/payments/received/${event.txHash}`
        : event.subscription
          ? `/app/billing/subscriptions/${event.subscription.onChainId}`
          : null,
  };
}
