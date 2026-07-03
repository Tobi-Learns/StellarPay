import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSubscription } from "@/lib/stellar";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sub = await db.subscription.findUnique({
    where: { onChainId: id },
    include: {
      plan: {
        select: {
          extId: true,
          productName: true,
          description: true,
          intervalLabel: true,
          intervalUnit: true,
          intervalCount: true,
        },
      },
    },
  });
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const events = await db.event.findMany({
    where: {
      OR: [
        { subscriptionId: sub.id },
        { data: { path: ["subId"], equals: id } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: { extId: true, type: true, txHash: true, data: true, createdAt: true },
  });

  try {
    const onChain = await getSubscription(BigInt(id));
    // next_charge_at is now a UTC unix timestamp — no ledger→time estimation needed.
    const nowSecs = Math.floor(Date.now() / 1000);

    return NextResponse.json({
      ...sub,
      status: onChain.status,
      nextChargeAt: onChain.next_charge_at,
      estimatedNextChargeAt: new Date(onChain.next_charge_at * 1000).toISOString(),
      nextChargeOverdue: onChain.next_charge_at < nowSecs,
      events,
    });
  } catch {
    return NextResponse.json({ ...sub, events });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { status } = await req.json();

  if (!status) return NextResponse.json({ error: "status required" }, { status: 400 });

  const sub = await db.subscription.update({
    where: { onChainId: id },
    data: { status },
  });
  return NextResponse.json(sub);
}
