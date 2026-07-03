import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";

export async function GET(req: NextRequest) {
  const merchant = req.nextUrl.searchParams.get("merchant");
  if (!merchant) return NextResponse.json({ error: "merchant required" }, { status: 400 });

  const links = await db.paymentLink.findMany({
    where: { merchant },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(links);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { encodedId, numericId, merchant, amount, description } = body;

  if (!encodedId || !numericId || !merchant || !amount) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const link = await db.paymentLink.upsert({
    where: { encodedId },
    update: {},
    create: { extId: newId("plink"), encodedId, numericId, merchant, amount, description },
  });
  return NextResponse.json(link, { status: 201 });
}
