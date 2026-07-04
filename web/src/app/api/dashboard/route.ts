import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { IntervalUnit } from "@/lib/billing-schedule";

// Nominal seconds per billing period, used only to normalize recurring revenue
// to a comparable per-month run-rate (months = 30d, years = 365d). This is a
// display estimate, deliberately not the exact-calendar math the contract uses.
const MONTH_SECONDS = 2_592_000; // 30 days
const PERIOD_SECONDS: Record<IntervalUnit, number> = {
  minute: 60,
  day: 86_400,
  week: 604_800,
  month: MONTH_SECONDS,
  year: 31_536_000, // 365 days
};

// Events whose merchant we resolve via data/link/subscription joins (same shape
// as /api/events). One-time volume comes from these; recurring volume comes off
// the subscription rows (periodsCharged), which is exact and avoids the fact
// that subscription.charged events don't carry an amount.
const ACTIVITY_TYPES = [
  "payment.settled",
  "subscription.created",
  "subscription.charged",
  "subscription.past_due",
  "subscription.canceled",
];

export async function GET(req: NextRequest) {
  const merchant = req.nextUrl.searchParams.get("merchant");
  if (!merchant) return NextResponse.json({ error: "merchant required" }, { status: 400 });

  // Reused across event queries — an event belongs to this merchant if its data
  // names them, or its linked payment link / subscription does.
  const merchantEventFilter: Prisma.EventWhereInput = {
    OR: [
      { data: { path: ["merchant"], equals: merchant } },
      { paymentLink: { merchant } },
      { subscription: { merchant } },
    ],
  };

  const [subs, settledEvents, recentEvents] = await Promise.all([
    db.subscription.findMany({
      where: { merchant },
      include: {
        plan: {
          select: {
            productName: true,
            extId: true,
            intervalLabel: true,
            intervalUnit: true,
            intervalCount: true,
          },
        },
      },
    }),
    db.event.findMany({
      where: { AND: [merchantEventFilter, { type: "payment.settled" }] },
      select: { data: true },
    }),
    db.event.findMany({
      where: { AND: [merchantEventFilter, { type: { in: ACTIVITY_TYPES } }] },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        paymentLink: { select: { productName: true } },
        subscription: {
          select: { onChainId: true, amount: true, plan: { select: { productName: true } } },
        },
      },
    }),
  ]);

  // --- KPIs -----------------------------------------------------------------
  const oneTimeVolume = settledEvents.reduce((sum, e) => {
    const data = e.data as { amount?: string } | null;
    return data?.amount ? sum + BigInt(data.amount) : sum;
  }, BigInt(0));

  // Recurring money actually pulled = amount × every charge made (periodsCharged
  // counts the immediate first charge at subscribe plus each cron charge since).
  const recurringVolume = subs.reduce(
    (sum, s) => sum + BigInt(s.amount) * BigInt(s.periodsCharged),
    BigInt(0)
  );

  const activeSubscriptions = subs.filter((s) => s.status === "Active").length;
  const pastDueCount = subs.filter((s) => s.status === "PastDue").length;

  // Normalized run-rate: what active subscriptions are worth per month if they
  // keep billing at their current cadence. Labeled as a run-rate, not real MRR.
  const recurringMonthly = subs
    .filter((s) => s.status === "Active")
    .reduce((sum, s) => {
      const unit = s.plan.intervalUnit as IntervalUnit;
      const periodSecs = (PERIOD_SECONDS[unit] ?? MONTH_SECONDS) * s.plan.intervalCount;
      return sum + (BigInt(s.amount) * BigInt(MONTH_SECONDS)) / BigInt(periodSecs);
    }, BigInt(0));

  const kpis = {
    totalVolume: (oneTimeVolume + recurringVolume).toString(),
    paymentsReceived: settledEvents.length,
    activeSubscriptions,
    pastDueCount,
    recurringMonthly: recurringMonthly.toString(),
  };

  // --- Needs attention ------------------------------------------------------
  // Subscriptions that are PastDue or mid-retry — the operational worklist.
  const needsAttention = subs
    .filter((s) => s.status === "PastDue" || s.retryCount > 0 || s.nextRetryAt !== null)
    .map((s) => ({
      extId: s.extId,
      onChainId: s.onChainId,
      productName: s.plan.productName,
      payerName: s.payerName,
      payerEmail: s.payerEmail,
      subscriber: s.subscriber,
      amount: s.amount,
      intervalLabel: s.plan.intervalLabel,
      status: s.status,
      retryCount: s.retryCount,
      nextRetryAt: s.nextRetryAt,
    }));

  // --- Recent activity ------------------------------------------------------
  const recentActivity = recentEvents.map((e) => {
    const data = (e.data ?? {}) as {
      amount?: string;
      periods?: number;
      payerName?: string;
      payerEmail?: string;
      productName?: string;
    };
    const subAmount = e.subscription?.amount;
    // payment.settled carries its amount in event data; subscription events
    // don't, so derive from the subscription amount × periods in this charge.
    const amount =
      e.type === "payment.settled"
        ? data.amount ?? null
        : subAmount
          ? (BigInt(subAmount) * BigInt(data.periods ?? 1)).toString()
          : null;

    return {
      extId: e.extId,
      type: e.type,
      txHash: e.txHash,
      createdAt: e.createdAt,
      productName:
        e.paymentLink?.productName ??
        e.subscription?.plan?.productName ??
        data.productName ??
        null,
      payerName: data.payerName ?? null,
      payerEmail: data.payerEmail ?? null,
      amount,
      subscriptionOnChainId: e.subscription?.onChainId ?? null,
    };
  });

  return NextResponse.json({ kpis, needsAttention, recentActivity });
}
