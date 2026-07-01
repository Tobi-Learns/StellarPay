import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sub = await db.subscription.findUnique({ where: { onChainId: id } });
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(sub);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { status } = await req.json();

  if (!status) return NextResponse.json({ error: "status required" }, { status: 400 });

  const sub = await db.subscription.update({
    where: { onChainId: id },
    data: { status },
  });
  return NextResponse.json(sub);
}
