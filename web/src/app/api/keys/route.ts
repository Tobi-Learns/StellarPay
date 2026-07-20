import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { getPlatformContext } from "@/lib/auth-session";

export async function GET() {
  const context = await getPlatformContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const keys = await db.apiKey.findMany({
    where: { businessId: context.businessId, revokedAt: null },
    select: { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(keys);
}

export async function POST(req: NextRequest) {
  const context = await getPlatformContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name } = await req.json();
  const wallet = context.business.wallets.find((candidate) => candidate.isDefault);
  if (!wallet) return NextResponse.json({ error: "Attach a settlement wallet first" }, { status: 409 });

  const raw = "sp_" + randomBytes(16).toString("hex");
  const hash = createHash("sha256").update(raw).digest("hex");
  const prefix = raw.slice(0, 11); // "sp_" + 8 chars

  const record = await db.apiKey.create({
    data: { businessId: context.businessId, merchant: wallet.address, name: name || null, keyHash: hash, prefix },
  });

  // Return the full key only on creation — never retrievable again
  return NextResponse.json({ id: record.id, key: raw, prefix, name: record.name, createdAt: record.createdAt }, { status: 201 });
}
