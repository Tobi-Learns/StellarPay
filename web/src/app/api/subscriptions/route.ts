import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";

export async function GET(req: NextRequest) {
  const merchant = req.nextUrl.searchParams.get("merchant");
  const subscriber = req.nextUrl.searchParams.get("subscriber");

  if (!merchant && !subscriber) {
    return NextResponse.json({ error: "merchant or subscriber required" }, { status: 400 });
  }

  const subs = await db.subscription.findMany({
    where: merchant ? { merchant } : { subscriber: subscriber! },
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

  const sub = await db.subscription.upsert({
    where: { onChainId },
    update: {},
    create: {
      extId: newId("sub"),
      onChainId,
      planOnChainId,
      subscriber,
      merchant,
      amount,
      payerName,
      payerEmail,
      // periodsCharged defaults to 1 (the immediate first charge at subscribe).
      ...(anchorAt ? { anchorAt: new Date(anchorAt) } : {}),
    },
  });
  return NextResponse.json(sub, { status: 201 });
}
