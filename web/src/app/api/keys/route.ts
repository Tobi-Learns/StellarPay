import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const merchant = req.nextUrl.searchParams.get("merchant");
  if (!merchant) return NextResponse.json({ error: "merchant required" }, { status: 400 });

  const keys = await db.apiKey.findMany({
    where: { merchant, revokedAt: null },
    select: { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(keys);
}

export async function POST(req: NextRequest) {
  const { merchant, name } = await req.json();
  if (!merchant) return NextResponse.json({ error: "merchant required" }, { status: 400 });

  const raw = "sp_" + randomBytes(16).toString("hex");
  const hash = createHash("sha256").update(raw).digest("hex");
  const prefix = raw.slice(0, 11); // "sp_" + 8 chars

  const record = await db.apiKey.create({
    data: { merchant, name: name || null, keyHash: hash, prefix },
  });

  // Return the full key only on creation — never retrievable again
  return NextResponse.json({ id: record.id, key: raw, prefix, name: record.name, createdAt: record.createdAt }, { status: 201 });
}
