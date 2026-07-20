import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  DASHBOARD_ACTIVITY_TYPES,
  bucketDashboardEvents,
  dashboardWindow,
  parseDashboardRange,
  rankTopProducts,
  splitDashboardPeriods,
  summarizePeriod,
  summarizeSubscriptionHealth,
  toRecentSale,
  type DashboardEventInput,
} from "@/lib/dashboard-aggregation";
import { getPlatformContext } from "@/lib/auth-session";
import { businessWalletAddresses } from "@/lib/api-access";

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
  const context = await getPlatformContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const walletAddresses = businessWalletAddresses(context);
  const resourceFilter = { OR: [{ businessId: context.businessId }, { merchant: { in: walletAddresses } }] };

  const now = new Date();
  const range = parseDashboardRange(req.nextUrl.searchParams.get("range"));
  const { currentStart, currentEnd, previousStart } = dashboardWindow(now, range);
  const merchantEventFilter: Prisma.EventWhereInput = {
    OR: [
      { businessId: context.businessId },
      ...walletAddresses.map((address) => ({ data: { path: ["merchant"], equals: address } })),
      { paymentLink: resourceFilter },
      { subscription: resourceFilter },
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
      where: resourceFilter,
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
      where: { AND: [resourceFilter, { archivedAt: null }] },
      orderBy: { createdAt: "desc" },
      take: 1,
      select: { numericId: true, productName: true },
    }),
    db.plan.findMany({
      where: { AND: [resourceFilter, { archivedAt: null }] },
      orderBy: { createdAt: "desc" },
      take: 1,
      select: { onChainId: true, productName: true },
    }),
    db.paymentLink.count({ where: { AND: [resourceFilter, { archivedAt: null }] } }),
    db.plan.count({ where: { AND: [resourceFilter, { archivedAt: null }] } }),
  ]);

  const periodEvents = asDashboardEvents(periodEventsRaw);
  const { currentEvents, previousEvents } = splitDashboardPeriods(periodEvents, now, range);

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
      range,
      label: `Last ${range} days`,
      current: { start: currentStart, end: currentEnd },
      previous: { start: previousStart, end: currentStart },
    },
    performance: {
      current: summarizePeriod(currentEvents),
      previous: summarizePeriod(previousEvents),
      activeSubscriptions: subs.filter((sub) => sub.status === "Active").length,
    },
    buckets: bucketDashboardEvents(currentEvents, currentStart, currentEnd, range),
    subscriptionHealth: summarizeSubscriptionHealth(subs),
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
