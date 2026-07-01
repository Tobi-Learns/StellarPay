import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const endpoint = await db.webhookEndpoint.findUnique({ where: { id } });
  if (!endpoint) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.webhookEndpoint.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ disabled: true });
}
