import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { getBusinessAccess } from "@/lib/api-access";

export async function GET(req: NextRequest) {
  const subscriber = req.nextUrl.searchParams.get("subscriber");

  const access = subscriber ? null : await getBusinessAccess(req);
  if (!subscriber && !access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const subs = await db.subscription.findMany({
    where: subscriber ? { subscriber } : { businessId: access!.businessId },
    orderBy: { createdAt: "desc" },
    include: {
      plan: {
        select: {
          extId: true,
          productName: true,
          description: true,
          intervalLabel: true,
          intervalUnit: true,
          intervalCount: true,
          archivedAt: true,
        },
      },
    },
  });
  return NextResponse.json(subs);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { onChainId, planOnChainId, subscriber, merchant, amount, payerName, payerEmail, anchorAt } = body;

  if (!onChainId || !planOnChainId || !subscriber || !merchant || !amount) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const plan = await db.plan.findUnique({
    where: { onChainId: planOnChainId },
    select: { businessId: true, settlementWalletId: true, merchant: true, amount: true },
  });
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  if (merchant !== plan.merchant || amount !== plan.amount) {
    return NextResponse.json({ error: "Subscription settlement details do not match the plan" }, { status: 400 });
  }

  const authorization = req.headers.get("authorization");
  if (authorization) {
    const access = await getBusinessAccess(req);
    if (!access || access.businessId !== plan.businessId) {
      return NextResponse.json({ error: "API key does not own this plan" }, { status: 403 });
    }
  }

  // Duplicate-subscription guard (2.4h/3.3c): at most one Active sub per
  // (subscriber, plan). A needsReauthorization sub is still Active; a Canceled
  // one is not. Exclude this same onChainId so re-registering an existing sub
  // (the idempotent upsert) is never blocked.
  const existingActive = await db.subscription.findFirst({
    where: { subscriber, planOnChainId, status: "Active", onChainId: { not: onChainId } },
  });
  if (existingActive) {
    return NextResponse.json(
      { error: "Subscriber already has an active subscription on this plan", existing: existingActive },
      { status: 409 }
    );
  }

  const sub = await db.subscription.upsert({
    where: { onChainId },
    update: {},
    create: {
      extId: newId("sub"),
      onChainId,
      planOnChainId,
      subscriber,
      merchant: plan.merchant,
      businessId: plan.businessId,
      settlementWalletId: plan.settlementWalletId,
      amount,
      payerName,
      payerEmail,
      // periodsCharged defaults to 1 (the immediate first charge at subscribe).
      ...(anchorAt ? { anchorAt: new Date(anchorAt) } : {}),
    },
  });
  return NextResponse.json(sub, { status: 201 });
}
