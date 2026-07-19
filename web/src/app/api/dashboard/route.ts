import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  DASHBOARD_ACTIVITY_TYPES,
  dashboardWindow,
  rankTopProducts,
  splitDashboardPeriods,
  summarizePeriod,
  toRecentSale,
  type DashboardEventInput,
} from "@/lib/dashboard-aggregation";

const SUCCESS_TYPES = [
  "payment.settled",
  "subscription.created",
  "subscription.charged",
];

const eventInclude = {
  paymentLink: {
    select: { numericId: true, productName: true, amount: true },
  },
  subscription: {
    select: {
      onChainId: true,
      amount: true,
      subscriber: true,
      payerName: true,
      payerEmail: true,
      plan: { select: { onChainId: true, productName: true } },
    },
  },
} satisfies Prisma.EventInclude;

function asDashboardEvents(events: Array<Prisma.EventGetPayload<{ include: typeof eventInclude }>>) {
  return events as unknown as DashboardEventInput[];
}

export async function GET(req: NextRequest) {
  const merchant = req.nextUrl.searchParams.get("merchant");
  if (!merchant) return NextResponse.json({ error: "merchant required" }, { status: 400 });

  const now = new Date();
  const { currentStart, currentEnd, previousStart } = dashboardWindow(now);
  const merchantEventFilter: Prisma.EventWhereInput = {
    OR: [
      { data: { path: ["merchant"], equals: merchant } },
      { paymentLink: { merchant } },
      { subscription: { merchant } },
    ],
  };

  const [
    subs,
    periodEventsRaw,
    recentEventsRaw,
    activityExists,
    paymentLinks,
    plans,
    paymentLinkCount,
    planCount,
  ] = await Promise.all([
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
      where: {
        AND: [
          merchantEventFilter,
          { type: { in: SUCCESS_TYPES }, createdAt: { gte: previousStart, lt: currentEnd } },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: eventInclude,
    }),
    db.event.findMany({
      where: { AND: [merchantEventFilter, { type: { in: [...DASHBOARD_ACTIVITY_TYPES] } }] },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: eventInclude,
    }),
    db.event.findFirst({
      where: { AND: [merchantEventFilter, { type: { in: SUCCESS_TYPES } }] },
      select: { id: true },
    }),
    db.paymentLink.findMany({
      where: { merchant, archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 1,
      select: { numericId: true, productName: true },
    }),
    db.plan.findMany({
      where: { merchant, archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 1,
      select: { onChainId: true, productName: true },
    }),
    db.paymentLink.count({ where: { merchant, archivedAt: null } }),
    db.plan.count({ where: { merchant, archivedAt: null } }),
  ]);

  const periodEvents = asDashboardEvents(periodEventsRaw);
  const { currentEvents, previousEvents } = splitDashboardPeriods(periodEvents, now);

  const needsAttention = subs
    .filter(
      (sub) =>
        sub.status === "PastDue" ||
        sub.retryCount > 0 ||
        sub.nextRetryAt !== null ||
        sub.needsReauthorization,
    )
    .sort((a, b) => {
      const priority = (sub: typeof a) =>
        sub.status === "PastDue" ? 0 : sub.retryCount > 0 || sub.nextRetryAt ? 1 : 2;
      return priority(a) - priority(b);
    })
    .map((sub) => ({
      extId: sub.extId,
      onChainId: sub.onChainId,
      productName: sub.plan.productName,
      payerName: sub.payerName,
      payerEmail: sub.payerEmail,
      subscriber: sub.subscriber,
      amount: sub.amount,
      intervalLabel: sub.plan.intervalLabel,
      status: sub.status,
      retryCount: sub.retryCount,
      nextRetryAt: sub.nextRetryAt,
      needsReauthorization: sub.needsReauthorization,
      reauthRequestedAt: sub.reauthRequestedAt,
    }));

  return NextResponse.json({
    period: {
      label: "Last 7 days",
      current: { start: currentStart, end: currentEnd },
      previous: { start: previousStart, end: currentStart },
    },
    performance: {
      current: summarizePeriod(currentEvents),
      previous: summarizePeriod(previousEvents),
      activeSubscriptions: subs.filter((sub) => sub.status === "Active").length,
    },
    needsAttention,
    recentSales: asDashboardEvents(recentEventsRaw).map(toRecentSale),
    topProducts: rankTopProducts(currentEvents),
    setup: {
      // A subscription row proves the immediate first charge completed even if
      // its historical event was one of the records lost before the durable
      // settlement outbox shipped (B2/B5/B6).
      hasActivity: Boolean(activityExists) || subs.length > 0,
      paymentLinks: paymentLinkCount,
      plans: planCount,
      latestPaymentLink: paymentLinks[0] ?? null,
      latestPlan: plans[0] ?? null,
    },
  });
}
