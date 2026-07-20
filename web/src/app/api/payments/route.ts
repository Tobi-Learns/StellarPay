import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { getBusinessAccess } from "@/lib/api-access";

export async function GET(req: NextRequest) {
  const access = await getBusinessAccess(req);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const links = await db.paymentLink.findMany({
    where: { businessId: access.businessId },
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
  const access = await getBusinessAccess(req);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.merchant) return NextResponse.json({ error: "Attach a settlement wallet first" }, { status: 409 });
  const body = await req.json();
  const { numericId, merchant, amount, productName, description } = body;

  if (!numericId || !amount || !productName?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (merchant && merchant !== access.merchant) {
    return NextResponse.json({ error: "Merchant does not match the Business settlement wallet" }, { status: 403 });
  }

  const existing = await db.paymentLink.findUnique({ where: { numericId }, select: { businessId: true } });
  if (existing && existing.businessId !== access.businessId) {
    return NextResponse.json({ error: "Payment link ID is already in use" }, { status: 409 });
  }

  // numericId is the canonical link id (Snowflake); encodedId is retired.
  const link = await db.paymentLink.upsert({
    where: { numericId },
    update: {},
    create: {
      extId: newId("plink"),
      numericId,
      merchant: access.merchant,
      businessId: access.businessId,
      settlementWalletId: access.settlementWalletId,
      amount,
      productName: productName.trim(),
      description,
    },
  });
  return NextResponse.json(link, { status: 201 });
}
