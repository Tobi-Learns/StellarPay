import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";

export async function GET(req: NextRequest) {
  const merchant = req.nextUrl.searchParams.get("merchant");
  if (!merchant) return NextResponse.json({ error: "merchant required" }, { status: 400 });

  const plans = await db.plan.findMany({
    where: { merchant },
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
  const body = await req.json();
  const { onChainId, merchant, amount, productName, description, interval, intervalLabel, intervalUnit, intervalCount } = body;

  if (!onChainId || !merchant || !amount || interval == null || !intervalLabel || !intervalUnit || intervalCount == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const plan = await db.plan.upsert({
    where: { onChainId },
    update: {},
    create: {
      extId: newId("plan"),
      onChainId,
      merchant,
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
