import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPlatformContext } from "@/lib/auth-session";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { planId } = await params;
  const manage = req.nextUrl.searchParams.get("manage") === "1";
  const context = manage ? await getPlatformContext() : null;
  if (manage && !context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const plan = await db.plan.findUnique({
    where: { onChainId: planId },
    include: {
      subscriptions: manage ? {
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          extId: true,
          onChainId: true,
          payerName: true,
          payerEmail: true,
          subscriber: true,
          amount: true,
          status: true,
          createdAt: true,
        },
      } : false,
    },
  });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (manage && plan.businessId !== context?.businessId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(plan);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { planId } = await params;
  const context = await getPlatformContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const existing = await db.plan.findUnique({ where: { onChainId: planId } });
  if (!existing || existing.businessId !== context.businessId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await req.json();
  const { archived, productName, description } = body as {
    archived?: boolean;
    productName?: string;
    description?: string;
  };

  if (archived === undefined && productName === undefined && description === undefined) {
    return NextResponse.json({ error: "No supported fields provided" }, { status: 400 });
  }

  const plan = await db.plan.update({
    where: { onChainId: planId },
    data: {
      ...(typeof archived === "boolean" ? { archivedAt: archived ? new Date() : null } : {}),
      ...(productName !== undefined ? { productName: productName.trim() } : {}),
      ...(description !== undefined ? { description } : {}),
    },
  });

  return NextResponse.json(plan);
}
