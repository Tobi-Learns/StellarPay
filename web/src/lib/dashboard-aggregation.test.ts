import assert from "node:assert/strict";
import test from "node:test";
import {
  amountForDashboardEvent,
  bucketDashboardEvents,
  compareDashboardPeriods,
  dashboardWindow,
  parseDashboardRange,
  rankTopProducts,
  splitDashboardPeriods,
  summarizeSubscriptionHealth,
  summarizePeriod,
  toRecentSale,
  type DashboardEventInput,
} from "./dashboard-aggregation.ts";

const NOW = new Date("2026-07-19T12:00:00.000Z");

function event(
  type: string,
  createdAt: string,
  overrides: Partial<DashboardEventInput> = {},
): DashboardEventInput {
  return {
    extId: `evt_${type}_${createdAt}`,
    type,
    txHash: `${type}_${createdAt}`,
    createdAt: new Date(createdAt),
    data: {},
    paymentLink: null,
    subscription: null,
    ...overrides,
  };
}

function payment(createdAt: string, amount: string, product = "Consultation", payer = "a@example.com", linkId = "101") {
  return event("payment.settled", createdAt, {
    data: { amount, payerEmail: payer },
    paymentLink: { numericId: linkId, productName: product, amount },
  });
}

function recurring(createdAt: string, periods = 1, product = "Membership", payer = "b@example.com") {
  return event("subscription.charged", createdAt, {
    data: { periods },
    subscription: {
      onChainId: "202",
      amount: "20000000",
      subscriber: "GABC",
      payerName: "Bea",
      payerEmail: payer,
      plan: { onChainId: "303", productName: product },
    },
  });
}

test("dashboard window defaults to two adjacent thirty-day rolling periods", () => {
  const window = dashboardWindow(NOW);
  assert.equal(window.currentStart.toISOString(), "2026-06-19T12:00:00.000Z");
  assert.equal(window.previousStart.toISOString(), "2026-05-20T12:00:00.000Z");
  assert.equal(window.currentEnd.toISOString(), NOW.toISOString());
});

test("dashboard range accepts only 7, 30, or 90 days and otherwise defaults to 30", () => {
  assert.equal(parseDashboardRange("7"), 7);
  assert.equal(parseDashboardRange("30"), 30);
  assert.equal(parseDashboardRange("90"), 90);
  assert.equal(parseDashboardRange("14"), 30);
  assert.equal(parseDashboardRange(null), 30);
});

test("period comparisons handle empty, new, lost, flat, and growing activity", () => {
  assert.deepEqual(compareDashboardPeriods("0", "0"), {
    text: "No activity in either period",
    tone: "muted",
  });
  assert.deepEqual(compareDashboardPeriods("10", "0"), {
    text: "New activity this period",
    tone: "positive",
  });
  assert.deepEqual(compareDashboardPeriods("0", "10", 7), {
    text: "-100.0% vs previous 7 days",
    tone: "negative",
  });
  assert.deepEqual(compareDashboardPeriods("10", "10", 7), {
    text: "Flat vs previous 7 days",
    tone: "muted",
  });
  assert.deepEqual(compareDashboardPeriods("15", "10", 7), {
    text: "+50.0% vs previous 7 days",
    tone: "positive",
  });
});

test("period boundaries are start-inclusive and end-exclusive", () => {
  const { currentStart, currentEnd, previousStart } = dashboardWindow(NOW, 7);
  const beforeAll = payment(new Date(previousStart.getTime() - 1).toISOString(), "10000000");
  const atPreviousStart = payment(previousStart.toISOString(), "20000000");
  const atCurrentStart = payment(currentStart.toISOString(), "30000000");
  const beforeCurrentEnd = payment(new Date(currentEnd.getTime() - 1).toISOString(), "40000000");
  const atCurrentEnd = payment(currentEnd.toISOString(), "50000000");
  const split = splitDashboardPeriods(
    [beforeAll, atPreviousStart, atCurrentStart, beforeCurrentEnd, atCurrentEnd],
    NOW,
    7,
  );
  assert.deepEqual(split.previousEvents.map((row) => row.txHash), [atPreviousStart.txHash]);
  assert.deepEqual(split.currentEvents.map((row) => row.txHash), [atCurrentStart.txHash, beforeCurrentEnd.txHash]);
});

test("daily buckets are zero-filled, UTC-stable, and keep boundary events in one bucket", () => {
  const start = new Date("2026-07-16T12:00:00.000Z");
  const rows = bucketDashboardEvents([
    payment("2026-07-16T12:00:00.000Z", "10000000"),
    recurring("2026-07-18T11:59:59.999Z", 2),
    payment("2026-07-18T12:00:00.000Z", "90000000"),
  ], start, NOW, 7);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((row) => row.label), ["Jul 16", "Jul 17", "Jul 18"]);
  assert.equal(rows[0].volumeReceived, "10000000");
  assert.equal(rows[1].volumeReceived, "40000000");
  assert.equal(rows[2].volumeReceived, "90000000");
  assert.equal(rows[2].successfulPayments, 1);
});

test("range outputs use daily buckets for 7/30 days and weekly buckets for 90 days", () => {
  for (const range of [7, 30, 90] as const) {
    const window = dashboardWindow(NOW, range);
    const buckets = bucketDashboardEvents([], window.currentStart, window.currentEnd, range);
    assert.equal(buckets.length, range === 90 ? 13 : range);
    assert.ok(buckets.every((bucket) => bucket.volumeReceived === "0"));
    assert.equal(buckets[0].start, window.currentStart.toISOString());
    assert.equal(buckets.at(-1)?.end, window.currentEnd.toISOString());
  }
});

test("subscription health states are mutually exclusive and ordered by urgency", () => {
  assert.deepEqual(summarizeSubscriptionHealth([
    { status: "Active", retryCount: 0, nextRetryAt: null, needsReauthorization: false },
    { status: "Active", retryCount: 1, nextRetryAt: null, needsReauthorization: true },
    { status: "PastDue", retryCount: 2, nextRetryAt: NOW, needsReauthorization: true },
    { status: "Active", retryCount: 0, nextRetryAt: null, needsReauthorization: true },
    { status: "Canceled", retryCount: 0, nextRetryAt: null, needsReauthorization: false },
  ]), { active: 1, retrying: 1, pastDue: 1, needsApproval: 1 });
});

test("summary splits one-time and recurring actual collections", () => {
  const summary = summarizePeriod([
    payment("2026-07-18T10:00:00Z", "50000000"),
    recurring("2026-07-18T11:00:00Z", 3),
    event("subscription.past_due", "2026-07-18T12:00:00Z"),
  ]);
  assert.deepEqual(summary, {
    volumeReceived: "110000000",
    oneTimeVolume: "50000000",
    recurringVolume: "60000000",
    successfulPayments: 2,
    oneTimePayments: 1,
    recurringCharges: 1,
  });
});

test("subscription creation counts the immediate first charge", () => {
  const created = recurring("2026-07-18T10:00:00Z");
  created.type = "subscription.created";
  created.data = {};
  assert.equal(amountForDashboardEvent(created), BigInt("20000000"));
});

test("empty period remains honestly zero", () => {
  assert.deepEqual(summarizePeriod([]), {
    volumeReceived: "0",
    oneTimeVolume: "0",
    recurringVolume: "0",
    successfulPayments: 0,
    oneTimePayments: 0,
    recurringCharges: 0,
  });
});

test("top products rank by actual volume, then payments, and dedupe customers", () => {
  const ranked = rankTopProducts([
    payment("2026-07-18T10:00:00Z", "50000000", "Consultation", "same@example.com"),
    payment("2026-07-18T11:00:00Z", "10000000", "Consultation", "same@example.com"),
    recurring("2026-07-18T12:00:00Z", 2, "Membership", "other@example.com"),
  ]);
  assert.equal(ranked[0].productName, "Consultation");
  assert.equal(ranked[0].volumeReceived, "60000000");
  assert.equal(ranked[0].payments, 2);
  assert.equal(ranked[0].customers, 1);
  assert.equal(ranked[1].volumeReceived, "40000000");
});

test("top-product ties fall back to payment count and empty input stays empty", () => {
  const ranked = rankTopProducts([
    payment("2026-07-18T10:00:00Z", "20000000", "Two smaller sales", "a@example.com", "201"),
    payment("2026-07-18T11:00:00Z", "20000000", "Two smaller sales", "b@example.com", "201"),
    payment("2026-07-18T12:00:00Z", "40000000", "One larger sale", "c@example.com", "202"),
  ]);
  assert.equal(ranked[0].productName, "Two smaller sales");
  assert.equal(ranked[0].payments, 2);
  assert.deepEqual(rankTopProducts([]), []);
});

test("recent sales preserve failures without pretending money was collected", () => {
  const failed = recurring("2026-07-18T10:00:00Z");
  failed.type = "subscription.past_due";
  const row = toRecentSale(failed);
  assert.equal(row.status, "past_due");
  assert.equal(row.amount, null);
  assert.equal(row.href, "/app/billing/subscriptions/202");
});
