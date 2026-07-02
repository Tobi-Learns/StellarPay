/**
 * Billing schedule calendar math (Phase 2.1).
 *
 * The backend owns exact billing dates; the contract only enforces a cadence
 * floor (`min_interval_secs`). This module computes anchor-aligned billing
 * boundaries with correct month-end handling, works out how many periods are
 * owed at a given moment (arrears), and derives the floor the contract stores.
 *
 * All arithmetic is UTC. Amounts/timestamps the contract sees are unix seconds.
 *
 * Anchoring: every billing boundary is computed from the original subscribe
 * date (the "anchor"), never from the previous boundary. That's what keeps a
 * Jan-31 subscription landing on Feb-28 → Mar-31 → Apr-30 instead of drifting
 * to the 28th forever.
 */

export type IntervalUnit = "minute" | "day" | "week" | "month" | "year";

export interface Interval {
  unit: IntervalUnit;
  /** How many units per billing period. Must be a positive integer. */
  count: number;
}

const SECONDS: Record<"minute" | "day" | "week", number> = {
  minute: 60,
  day: 86_400,
  week: 604_800,
};

// Guards against a pathological loop if a caller passes a far-future `now`
// with a tiny interval. 100k periods is far beyond any real subscription.
const MAX_CATCHUP_ITERATIONS = 100_000;

function assertValidInterval(interval: Interval): void {
  if (!Number.isInteger(interval.count) || interval.count < 1) {
    throw new Error(`interval.count must be a positive integer, got ${interval.count}`);
  }
}

function daysInMonthUTC(year: number, month: number): number {
  // month is 0-indexed; day 0 of next month = last day of this month.
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Add `months` calendar months to `anchor` (UTC), clamping the day to the last
 * day of the target month when the anchor day doesn't exist there
 * (e.g. Jan 31 + 1 month → Feb 28/29). Time-of-day is preserved.
 */
function addMonthsUTC(anchor: Date, months: number): Date {
  const total = anchor.getUTCMonth() + months;
  const targetYear = anchor.getUTCFullYear() + Math.floor(total / 12);
  const targetMonth = ((total % 12) + 12) % 12;
  const day = Math.min(anchor.getUTCDate(), daysInMonthUTC(targetYear, targetMonth));
  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      day,
      anchor.getUTCHours(),
      anchor.getUTCMinutes(),
      anchor.getUTCSeconds(),
      anchor.getUTCMilliseconds()
    )
  );
}

/**
 * The k-th billing boundary strictly after `anchor` (k >= 1). Boundary k is
 * when the (k+1)-th charge becomes due.
 */
export function billingDateAfter(anchor: Date, interval: Interval, k: number): Date {
  assertValidInterval(interval);
  if (!Number.isInteger(k) || k < 1) {
    throw new Error(`k must be a positive integer, got ${k}`);
  }
  const n = interval.count * k;
  switch (interval.unit) {
    case "minute":
    case "day":
    case "week":
      return new Date(anchor.getTime() + n * SECONDS[interval.unit] * 1000);
    case "month":
      return addMonthsUTC(anchor, n);
    case "year":
      return addMonthsUTC(anchor, n * 12);
  }
}

/** The first billing date after subscribe — what `subscribe` sets as next_charge_at. */
export function firstNextChargeAt(anchor: Date, interval: Interval): Date {
  return billingDateAfter(anchor, interval, 1);
}

/**
 * A small grace subtracted from the floor so normal clock skew between the
 * client (which computes exact dates) and the ledger (which the contract reads)
 * can't trip the `next_charge_at >= now + min_interval_secs` check. Capped at
 * half the period so tiny demo intervals stay positive. 60s comfortably covers
 * sim→submit latency and wall-clock drift.
 */
const FLOOR_GRACE_SECONDS = 60;

/** Shortest possible real duration of one period, in seconds. */
function shortestRealSeconds(interval: Interval): number {
  switch (interval.unit) {
    case "minute":
    case "day":
    case "week":
      return SECONDS[interval.unit] * interval.count;
    case "month":
      return 28 * SECONDS.day * interval.count; // shortest month = February
    case "year":
      return 365 * SECONDS.day * interval.count; // shortest year = non-leap
  }
}

/**
 * The cadence floor (seconds) the contract stores as `min_interval_secs`: the
 * shortest real period minus a small skew grace. Kept below any real interval so
 * the contract never rejects a legitimate charge, while still bounding a
 * malicious invoker to ~one period per interval.
 */
export function minIntervalSeconds(interval: Interval): number {
  assertValidInterval(interval);
  const shortest = shortestRealSeconds(interval);
  const grace = Math.min(FLOOR_GRACE_SECONDS, Math.floor(shortest / 2));
  return shortest - grace;
}

export interface CatchUp {
  /** Periods that have come due and should be charged now (0 if not yet due). */
  periods: number;
  /** New count of charges made after applying `periods`. */
  newPeriodsCharged: number;
  /** New next_charge_at boundary after applying `periods`. */
  newNextChargeAt: Date;
}

/**
 * Given how many charges have been made so far (`periodsCharged`, which is 1
 * immediately after subscribe), determine how many periods are due at `now` and
 * where the schedule lands after charging them. `maxPeriods` caps the result for
 * partial catch-up when the subscriber can't cover the full arrears.
 *
 * Invariant: the on-chain next_charge_at equals billingDateAfter(anchor,
 * interval, periodsCharged), so the first uncharged boundary is index
 * `periodsCharged`.
 */
export function computeCatchUp(
  anchor: Date,
  interval: Interval,
  periodsCharged: number,
  now: Date,
  maxPeriods: number = Infinity
): CatchUp {
  assertValidInterval(interval);
  if (!Number.isInteger(periodsCharged) || periodsCharged < 1) {
    throw new Error(`periodsCharged must be a positive integer, got ${periodsCharged}`);
  }

  const nowMs = now.getTime();
  let periods = 0;
  let boundaryIndex = periodsCharged; // first uncharged boundary
  let iterations = 0;

  while (
    periods < maxPeriods &&
    billingDateAfter(anchor, interval, boundaryIndex).getTime() <= nowMs
  ) {
    periods++;
    boundaryIndex++;
    if (++iterations > MAX_CATCHUP_ITERATIONS) {
      throw new Error("computeCatchUp exceeded iteration cap — check anchor/interval/now");
    }
  }

  const newPeriodsCharged = periodsCharged + periods;
  return {
    periods,
    newPeriodsCharged,
    newNextChargeAt: billingDateAfter(anchor, interval, newPeriodsCharged),
  };
}

/** Contract timestamps are unix seconds (floored). */
export function toUnixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}
