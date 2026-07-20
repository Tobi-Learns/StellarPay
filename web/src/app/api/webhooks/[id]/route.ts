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

  const endpoint = await db.webhookEndpoint.findUnique({ where: { id } });
  if (!endpoint || endpoint.businessId !== context.businessId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.webhookEndpoint.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ disabled: true });
}
