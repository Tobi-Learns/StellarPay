import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPlatformContext } from "@/lib/auth-session";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const context = await getPlatformContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { address } = await params;
  if (!context.business.wallets.some((wallet) => wallet.address === address)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const merchant = await db.merchant.findUnique({ where: { address } });
  if (!merchant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(merchant);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const context = await getPlatformContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { address } = await params;
  if (!context.business.wallets.some((wallet) => wallet.address === address)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { displayName, email, logoUrl } = await req.json();

  const merchant = await db.merchant.upsert({
    where: { address },
    update: { businessId: context.businessId, displayName, email, logoUrl },
    create: { address, businessId: context.businessId, displayName, email, logoUrl },
  });
  return NextResponse.json(merchant);
}
