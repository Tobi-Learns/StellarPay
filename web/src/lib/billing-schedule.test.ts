import { test } from "node:test";
import assert from "node:assert/strict";
import {
  billingDateAfter,
  firstNextChargeAt,
  minIntervalSeconds,
  computeCatchUp,
  toUnixSeconds,
  type Interval,
} from "./billing-schedule.ts";

const iso = (d: Date) => d.toISOString();
const utc = (s: string) => new Date(s);

// ── linear units ────────────────────────────────────────────────────────────

test("day interval advances linearly", () => {
  const anchor = utc("2026-01-01T09:30:00.000Z");
  const day: Interval = { unit: "day", count: 1 };
  assert.equal(iso(billingDateAfter(anchor, day, 1)), "2026-01-02T09:30:00.000Z");
  assert.equal(iso(billingDateAfter(anchor, day, 10)), "2026-01-11T09:30:00.000Z");
});

test("week interval with count", () => {
  const anchor = utc("2026-01-01T00:00:00.000Z");
  const biweekly: Interval = { unit: "week", count: 2 };
  assert.equal(iso(billingDateAfter(anchor, biweekly, 1)), "2026-01-15T00:00:00.000Z");
});

test("minute interval (demo)", () => {
  const anchor = utc("2026-01-01T00:00:00.000Z");
  const m: Interval = { unit: "minute", count: 5 };
  assert.equal(iso(billingDateAfter(anchor, m, 3)), "2026-01-01T00:15:00.000Z");
});

// ── month-end clamping ──────────────────────────────────────────────────────

test("Jan 31 anchor clamps per month but stays anchored (non-leap year)", () => {
  const anchor = utc("2025-01-31T12:00:00.000Z");
  const monthly: Interval = { unit: "month", count: 1 };
  // Each boundary computed from the anchor, so it snaps back to 31 when the month allows.
  assert.equal(iso(billingDateAfter(anchor, monthly, 1)), "2025-02-28T12:00:00.000Z");
  assert.equal(iso(billingDateAfter(anchor, monthly, 2)), "2025-03-31T12:00:00.000Z");
  assert.equal(iso(billingDateAfter(anchor, monthly, 3)), "2025-04-30T12:00:00.000Z");
  assert.equal(iso(billingDateAfter(anchor, monthly, 4)), "2025-05-31T12:00:00.000Z");
});

test("Jan 31 anchor hits Feb 29 in a leap year", () => {
  const anchor = utc("2024-01-31T00:00:00.000Z");
  const monthly: Interval = { unit: "month", count: 1 };
  assert.equal(iso(billingDateAfter(anchor, monthly, 1)), "2024-02-29T00:00:00.000Z");
});

test("month interval crosses year boundary", () => {
  const anchor = utc("2025-11-15T00:00:00.000Z");
  const monthly: Interval = { unit: "month", count: 1 };
  assert.equal(iso(billingDateAfter(anchor, monthly, 2)), "2026-01-15T00:00:00.000Z");
});

test("quarterly (count 3 months)", () => {
  const anchor = utc("2026-01-15T00:00:00.000Z");
  const quarterly: Interval = { unit: "month", count: 3 };
  assert.equal(iso(billingDateAfter(anchor, quarterly, 1)), "2026-04-15T00:00:00.000Z");
});

// ── year clamping ───────────────────────────────────────────────────────────

test("Feb 29 anchor clamps to Feb 28 on non-leap years", () => {
  const anchor = utc("2024-02-29T00:00:00.000Z");
  const yearly: Interval = { unit: "year", count: 1 };
  assert.equal(iso(billingDateAfter(anchor, yearly, 1)), "2025-02-28T00:00:00.000Z");
  // Four years on is a leap year again — anchored back to the 29th.
  assert.equal(iso(billingDateAfter(anchor, yearly, 4)), "2028-02-29T00:00:00.000Z");
});

// ── firstNextChargeAt ───────────────────────────────────────────────────────

test("firstNextChargeAt equals boundary 1", () => {
  const anchor = utc("2026-03-10T08:00:00.000Z");
  const monthly: Interval = { unit: "month", count: 1 };
  assert.equal(iso(firstNextChargeAt(anchor, monthly)), "2026-04-10T08:00:00.000Z");
});

// ── minIntervalSeconds (cadence floor) ──────────────────────────────────────

test("minIntervalSeconds is a safe lower bound", () => {
  assert.equal(minIntervalSeconds({ unit: "minute", count: 5 }), 300);
  assert.equal(minIntervalSeconds({ unit: "day", count: 1 }), 86_400);
  assert.equal(minIntervalSeconds({ unit: "week", count: 2 }), 1_209_600);
  assert.equal(minIntervalSeconds({ unit: "month", count: 1 }), 28 * 86_400);
  assert.equal(minIntervalSeconds({ unit: "year", count: 1 }), 365 * 86_400);
});

test("floor never exceeds a real monthly period", () => {
  // The shortest real month (Feb, 28 days) must be >= the floor, so the
  // contract's `new >= old + periods * floor` check never rejects a valid charge.
  const anchor = utc("2025-01-31T00:00:00.000Z");
  const monthly: Interval = { unit: "month", count: 1 };
  const floor = minIntervalSeconds(monthly);
  const realGap =
    toUnixSeconds(billingDateAfter(anchor, monthly, 1)) - toUnixSeconds(anchor);
  assert.ok(realGap >= floor, `real gap ${realGap} must be >= floor ${floor}`);
});

// ── computeCatchUp ──────────────────────────────────────────────────────────

test("not due yet → 0 periods", () => {
  const anchor = utc("2026-01-01T00:00:00.000Z");
  const monthly: Interval = { unit: "month", count: 1 };
  // periodsCharged=1 after subscribe; next boundary is 2026-02-01. Now is before it.
  const r = computeCatchUp(anchor, monthly, 1, utc("2026-01-20T00:00:00.000Z"));
  assert.equal(r.periods, 0);
  assert.equal(r.newPeriodsCharged, 1);
  assert.equal(iso(r.newNextChargeAt), "2026-02-01T00:00:00.000Z");
});

test("single period due", () => {
  const anchor = utc("2026-01-01T00:00:00.000Z");
  const monthly: Interval = { unit: "month", count: 1 };
  const r = computeCatchUp(anchor, monthly, 1, utc("2026-02-05T00:00:00.000Z"));
  assert.equal(r.periods, 1);
  assert.equal(r.newPeriodsCharged, 2);
  assert.equal(iso(r.newNextChargeAt), "2026-03-01T00:00:00.000Z");
});

test("arrears: three periods due after downtime", () => {
  const anchor = utc("2026-01-01T00:00:00.000Z");
  const monthly: Interval = { unit: "month", count: 1 };
  // Boundaries: Feb 1, Mar 1, Apr 1 all passed; May 1 not yet.
  const r = computeCatchUp(anchor, monthly, 1, utc("2026-04-10T00:00:00.000Z"));
  assert.equal(r.periods, 3);
  assert.equal(r.newPeriodsCharged, 4);
  assert.equal(iso(r.newNextChargeAt), "2026-05-01T00:00:00.000Z");
});

test("partial catch-up caps periods and advances only that far", () => {
  const anchor = utc("2026-01-01T00:00:00.000Z");
  const monthly: Interval = { unit: "month", count: 1 };
  // Three periods owed, but subscriber can only afford 2.
  const r = computeCatchUp(anchor, monthly, 1, utc("2026-04-10T00:00:00.000Z"), 2);
  assert.equal(r.periods, 2);
  assert.equal(r.newPeriodsCharged, 3);
  assert.equal(iso(r.newNextChargeAt), "2026-04-01T00:00:00.000Z");
});

test("catch-up resumes correctly after a partial charge", () => {
  const anchor = utc("2026-01-01T00:00:00.000Z");
  const monthly: Interval = { unit: "month", count: 1 };
  // After the partial charge above, periodsCharged=3, next boundary Apr 1.
  const r = computeCatchUp(anchor, monthly, 3, utc("2026-04-10T00:00:00.000Z"));
  assert.equal(r.periods, 1);
  assert.equal(r.newPeriodsCharged, 4);
  assert.equal(iso(r.newNextChargeAt), "2026-05-01T00:00:00.000Z");
});

test("arrears with anchored month-end dates", () => {
  const anchor = utc("2025-01-31T00:00:00.000Z");
  const monthly: Interval = { unit: "month", count: 1 };
  // Boundaries: Feb 28, Mar 31 passed by Apr 1; Apr 30 not yet.
  const r = computeCatchUp(anchor, monthly, 1, utc("2025-04-01T00:00:00.000Z"));
  assert.equal(r.periods, 2);
  assert.equal(iso(r.newNextChargeAt), "2025-04-30T00:00:00.000Z");
});

// ── toUnixSeconds ───────────────────────────────────────────────────────────

test("toUnixSeconds floors to seconds", () => {
  assert.equal(toUnixSeconds(utc("1970-01-01T00:00:01.999Z")), 1);
});
