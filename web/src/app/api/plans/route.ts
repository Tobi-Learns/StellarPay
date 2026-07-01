import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const merchant = req.nextUrl.searchParams.get("merchant");
  if (!merchant) return NextResponse.json({ error: "merchant required" }, { status: 400 });

  const plans = await db.plan.findMany({
    where: { merchant },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(plans);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { onChainId, merchant, amount, interval, intervalLabel } = body;

  if (!onChainId || !merchant || !amount || interval == null || !intervalLabel) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const plan = await db.plan.upsert({
    where: { onChainId },
    update: {},
    create: { onChainId, merchant, amount, interval, intervalLabel },
  });
  return NextResponse.json(plan, { status: 201 });
}
