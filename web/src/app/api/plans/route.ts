import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { getBusinessAccess } from "@/lib/api-access";

export async function GET(req: NextRequest) {
  const access = await getBusinessAccess(req);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plans = await db.plan.findMany({
    where: { businessId: access.businessId },
    orderBy: { createdAt: "desc" },
    include: {
      subscriptions: { select: { status: true } },
    },
  });
  return NextResponse.json(plans.map((plan) => {
    const { subscriptions, ...row } = plan;
    return {
      ...row,
      subscriberCount: subscriptions.length,
      activeSubscriberCount: subscriptions.filter((sub) => sub.status === "Active").length,
    };
  }));
}

export async function POST(req: NextRequest) {
  const access = await getBusinessAccess(req);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.merchant) return NextResponse.json({ error: "Attach a settlement wallet first" }, { status: 409 });
  const body = await req.json();
  const { onChainId, merchant, amount, productName, description, interval, intervalLabel, intervalUnit, intervalCount } = body;

  if (!onChainId || !merchant || !amount || interval == null || !intervalLabel || !intervalUnit || intervalCount == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (merchant !== access.merchant) {
    return NextResponse.json({ error: "Signed merchant does not match the Business settlement wallet" }, { status: 403 });
  }

  const existing = await db.plan.findUnique({ where: { onChainId }, select: { businessId: true } });
  if (existing && existing.businessId !== access.businessId) {
    return NextResponse.json({ error: "Plan ID is already in use" }, { status: 409 });
  }

  const plan = await db.plan.upsert({
    where: { onChainId },
    update: {},
    create: {
      extId: newId("plan"),
      onChainId,
      merchant: access.merchant,
      businessId: access.businessId,
      settlementWalletId: access.settlementWalletId,
      amount,
      productName: productName?.trim() || "Untitled product or service",
      description,
      interval,
      intervalLabel,
      intervalUnit,
      intervalCount,
    },
  });
  return NextResponse.json(plan, { status: 201 });
}
