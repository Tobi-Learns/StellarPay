import assert from "node:assert/strict";
import test from "node:test";
import {
  amountForDashboardEvent,
  compareDashboardPeriods,
  dashboardWindow,
  rankTopProducts,
  splitDashboardPeriods,
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

test("dashboard window is two adjacent seven-day rolling periods", () => {
  const window = dashboardWindow(NOW);
  assert.equal(window.currentStart.toISOString(), "2026-07-12T12:00:00.000Z");
  assert.equal(window.previousStart.toISOString(), "2026-07-05T12:00:00.000Z");
  assert.equal(window.currentEnd.toISOString(), NOW.toISOString());
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
  assert.deepEqual(compareDashboardPeriods("0", "10"), {
    text: "-100.0% vs previous 7 days",
    tone: "negative",
  });
  assert.deepEqual(compareDashboardPeriods("10", "10"), {
    text: "Flat vs previous 7 days",
    tone: "muted",
  });
  assert.deepEqual(compareDashboardPeriods("15", "10"), {
    text: "+50.0% vs previous 7 days",
    tone: "positive",
  });
});

test("period boundaries are start-inclusive and end-exclusive", () => {
  const { currentStart, currentEnd, previousStart } = dashboardWindow(NOW);
  const beforeAll = payment(new Date(previousStart.getTime() - 1).toISOString(), "10000000");
  const atPreviousStart = payment(previousStart.toISOString(), "20000000");
  const atCurrentStart = payment(currentStart.toISOString(), "30000000");
  const beforeCurrentEnd = payment(new Date(currentEnd.getTime() - 1).toISOString(), "40000000");
  const atCurrentEnd = payment(currentEnd.toISOString(), "50000000");
  const split = splitDashboardPeriods(
    [beforeAll, atPreviousStart, atCurrentStart, beforeCurrentEnd, atCurrentEnd],
    NOW,
  );
  assert.deepEqual(split.previousEvents.map((row) => row.txHash), [atPreviousStart.txHash]);
  assert.deepEqual(split.currentEvents.map((row) => row.txHash), [atCurrentStart.txHash, beforeCurrentEnd.txHash]);
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
