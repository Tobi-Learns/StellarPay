import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";

export async function GET(req: NextRequest) {
  const merchant = req.nextUrl.searchParams.get("merchant");
  if (!merchant) return NextResponse.json({ error: "merchant required" }, { status: 400 });

  const links = await db.paymentLink.findMany({
    where: { merchant },
    orderBy: { createdAt: "desc" },
    include: { events: { where: { type: "payment.settled" }, select: { txHash: true, data: true, createdAt: true } } },
  });
  return NextResponse.json(links.map((link) => {
    const { events, ...row } = link;
    const totalVolume = events.reduce((sum, event) => {
      const data = event.data as { amount?: string } | null;
      return sum + BigInt(data?.amount ?? link.amount);
    }, BigInt(0));

    return {
      ...row,
      settledCount: events.length,
      totalVolume: totalVolume.toString(),
    };
  }));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { numericId, merchant, amount, productName, description } = body;

  if (!numericId || !merchant || !amount || !productName?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // numericId is the canonical link id (Snowflake); encodedId is retired.
  const link = await db.paymentLink.upsert({
    where: { numericId },
    update: {},
    create: { extId: newId("plink"), numericId, merchant, amount, productName: productName.trim(), description },
  });
  return NextResponse.json(link, { status: 201 });
}
