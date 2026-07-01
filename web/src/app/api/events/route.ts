import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deliverWebhook } from "@/lib/webhooks";

export async function GET(req: NextRequest) {
  const subscriptionId = req.nextUrl.searchParams.get("subscriptionId");
  const paymentLinkId = req.nextUrl.searchParams.get("paymentLinkId");
  const merchant = req.nextUrl.searchParams.get("merchant");
  const type = req.nextUrl.searchParams.get("type");

  const events = await db.event.findMany({
    where: {
      ...(subscriptionId ? { subscriptionId } : {}),
      ...(paymentLinkId ? { paymentLinkId } : {}),
      ...(type ? { type } : {}),
      ...(merchant ? { data: { path: ["merchant"], equals: merchant } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(events);
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
    return NextResponse.json({ error: "type and txHash required" }, { status: 400 });
  }

  const event = await db.event.upsert({
    where: { txHash },
    update: {},
    create: { type, txHash, paymentLinkId, subscriptionId, data: data ?? {} },
  });

  // Fire-and-forget webhook delivery for qualifying event types
  if (WEBHOOK_TYPES.has(type)) {
    resolveMerchant({ type, paymentLinkId, subscriptionId, data }).then((merchant) => {
      if (merchant) deliverWebhook(merchant, type, { txHash, ...data });
    }).catch(() => {});
  }

  return NextResponse.json(event, { status: 201 });
}

async function resolveMerchant({
  type,
  paymentLinkId,
  subscriptionId,
  data,
}: {
  type: string;
  paymentLinkId?: string;
  subscriptionId?: string;
  data?: Record<string, unknown>;
}): Promise<string | null> {
  // Prefer explicit merchant in event data
  if (typeof data?.merchant === "string") return data.merchant;

  if (type === "payment.settled" && paymentLinkId) {
    const link = await db.paymentLink.findUnique({ where: { id: paymentLinkId }, select: { merchant: true } });
    return link?.merchant ?? null;
  }

  if (subscriptionId) {
    const sub = await db.subscription.findUnique({ where: { id: subscriptionId }, select: { merchant: true } });
    return sub?.merchant ?? null;
  }

  return null;
}
