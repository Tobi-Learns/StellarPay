import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPlatformContext } from "@/lib/auth-session";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getPlatformContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const key = await db.apiKey.findUnique({ where: { id } });
  if (!key || key.businessId !== context.businessId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (key.revokedAt) return NextResponse.json({ error: "Already revoked" }, { status: 409 });

  await db.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
  return NextResponse.json({ revoked: true });
}
