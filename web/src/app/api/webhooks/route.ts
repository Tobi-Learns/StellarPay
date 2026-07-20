import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { getPlatformContext } from "@/lib/auth-session";

export async function GET() {
  const context = await getPlatformContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const endpoints = await db.webhookEndpoint.findMany({
    where: { businessId: context.businessId, active: true },
    select: { id: true, url: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(endpoints);
}

export async function POST(req: NextRequest) {
  const context = await getPlatformContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { url } = await req.json();
  const wallet = context.business.wallets.find((candidate) => candidate.isDefault);
  if (!wallet || !url) return NextResponse.json({ error: "Settlement wallet and url required" }, { status: 400 });

  try { new URL(url); } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const secret = "whsec_" + randomBytes(16).toString("hex");

  const endpoint = await db.webhookEndpoint.create({
    data: { businessId: context.businessId, merchant: wallet.address, url, secret },
  });

  // Return the secret only on creation — not retrievable again
  return NextResponse.json({ id: endpoint.id, url: endpoint.url, secret, createdAt: endpoint.createdAt }, { status: 201 });
}
