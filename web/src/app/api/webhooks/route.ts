import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const merchant = req.nextUrl.searchParams.get("merchant");
  if (!merchant) return NextResponse.json({ error: "merchant required" }, { status: 400 });

  const endpoints = await db.webhookEndpoint.findMany({
    where: { merchant, active: true },
    select: { id: true, url: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(endpoints);
}

export async function POST(req: NextRequest) {
  const { merchant, url } = await req.json();
  if (!merchant || !url) return NextResponse.json({ error: "merchant and url required" }, { status: 400 });

  try { new URL(url); } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const secret = "whsec_" + randomBytes(16).toString("hex");

  const endpoint = await db.webhookEndpoint.create({
    data: { merchant, url, secret },
  });

  // Return the secret only on creation — not retrievable again
  return NextResponse.json({ id: endpoint.id, url: endpoint.url, secret, createdAt: endpoint.createdAt }, { status: 201 });
}
