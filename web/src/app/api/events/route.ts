import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { deliverWebhook } from "@/lib/webhooks";
import { newId } from "@/lib/ids";
import { getPlatformContext } from "@/lib/auth-session";

export async function GET(req: NextRequest) {
  const context = await getPlatformContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const subscriptionId = req.nextUrl.searchParams.get("subscriptionId");
  const paymentLinkId = req.nextUrl.searchParams.get("paymentLinkId");
  const type = req.nextUrl.searchParams.get("type");
  const filters: Prisma.EventWhereInput[] = [];

  if (subscriptionId) {
    filters.push({
      OR: [
        { subscriptionId },
        { subscription: { onChainId: subscriptionId } },
        { data: { path: ["subId"], equals: subscriptionId } },
      ],
    });
  }
  if (paymentLinkId) {
    filters.push({
      OR: [
        { paymentLinkId },
        { paymentLink: { numericId: paymentLinkId } },
        { data: { path: ["linkId"], equals: paymentLinkId } },
      ],
    });
  }
  if (type) filters.push({ type });
  filters.push({ businessId: context.businessId });

  const events = await db.event.findMany({
    where: filters.length > 0 ? { AND: filters } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      paymentLink: { select: { extId: true, numericId: true, productName: true, amount: true, description: true } },
      subscription: { select: { extId: true, onChainId: true, plan: { select: { extId: true, productName: true, description: true } } } },
    },
    take: 50,
  });
  return NextResponse.json(events);
}

// CORS: the SDK's <StellarPayButton> records payment.settled directly from the
// merchant's origin. The endpoint is unauthenticated and idempotent by txHash,
// so cross-origin browser posts add no exposure beyond what curl already has.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

const WEBHOOK_TYPES = new Set([
  "payment.settled",
  "subscription.charged",
  "subscription.past_due",
  "subscription.canceled",
]);

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { type, txHash, paymentLinkId, subscriptionId, data } = body;

  if (!type || !txHash) {
    return NextResponse.json({ error: "type and txHash required" }, { status: 400, headers: CORS_HEADERS });
  }

  const resolvedPaymentLinkId = await resolvePaymentLinkId(paymentLinkId, data);
  const resolvedSubscriptionId = await resolveSubscriptionId(subscriptionId, data);
  const businessId = await resolveBusinessId({
    paymentLinkId: resolvedPaymentLinkId,
    subscriptionId: resolvedSubscriptionId,
    data,
  });

  const event = await db.event.upsert({
    where: { txHash },
    update: {},
    create: {
      extId: newId("evt"),
      type,
      txHash,
      paymentLinkId: resolvedPaymentLinkId,
      subscriptionId: resolvedSubscriptionId,
      businessId,
      data: data ?? {},
    },
  });

  // Fire-and-forget webhook delivery for qualifying event types.
  // The payload carries the evt_ id (3.2) so consumers can dedupe/reference it.
  if (WEBHOOK_TYPES.has(type)) {
    Promise.resolve(businessId).then((owner) => {
      if (owner) deliverWebhook(owner, type, { id: event.extId, txHash, ...data });
    }).catch(() => {});
  }

  return NextResponse.json(event, { status: 201, headers: CORS_HEADERS });
}

async function resolvePaymentLinkId(paymentLinkId?: string, data?: Record<string, unknown>): Promise<string | undefined> {
  if (paymentLinkId) {
    const byId = await db.paymentLink.findFirst({
      where: { OR: [{ id: paymentLinkId }, { numericId: paymentLinkId }] },
      select: { id: true },
    });
    return byId?.id;
  }

  if (typeof data?.linkId === "string") {
    const link = await db.paymentLink.findUnique({
      where: { numericId: data.linkId },
      select: { id: true },
    });
    return link?.id;
  }

  return undefined;
}

async function resolveSubscriptionId(subscriptionId?: string, data?: Record<string, unknown>): Promise<string | undefined> {
  if (subscriptionId) {
    const byId = await db.subscription.findFirst({
      where: { OR: [{ id: subscriptionId }, { onChainId: subscriptionId }] },
      select: { id: true },
    });
    return byId?.id;
  }

  if (typeof data?.subId === "string") {
    const sub = await db.subscription.findUnique({
      where: { onChainId: data.subId },
      select: { id: true },
    });
    return sub?.id;
  }

  return undefined;
}

async function resolveBusinessId({
  paymentLinkId,
  subscriptionId,
  data,
}: {
  paymentLinkId?: string;
  subscriptionId?: string;
  data?: Record<string, unknown>;
}): Promise<string | null> {
  if (paymentLinkId) {
    const link = await db.paymentLink.findUnique({ where: { id: paymentLinkId }, select: { businessId: true } });
    if (link?.businessId) return link.businessId;
  }

  if (subscriptionId) {
    const sub = await db.subscription.findUnique({ where: { id: subscriptionId }, select: { businessId: true } });
    if (sub?.businessId) return sub.businessId;
  }

  if (typeof data?.merchant === "string") {
    const wallet = await db.settlementWallet.findUnique({ where: { address: data.merchant } });
    return wallet?.businessId ?? null;
  }

  return null;
}
