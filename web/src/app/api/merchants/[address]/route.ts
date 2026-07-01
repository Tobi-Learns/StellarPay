import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  const merchant = await db.merchant.findUnique({ where: { address } });
  if (!merchant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(merchant);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  const { displayName, email, logoUrl } = await req.json();

  const merchant = await db.merchant.upsert({
    where: { address },
    update: { displayName, email, logoUrl },
    create: { address, displayName, email, logoUrl },
  });
  return NextResponse.json(merchant);
}
