import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { planId } = await params;
  const plan = await db.plan.findUnique({
    where: { onChainId: planId },
    include: {
      subscriptions: {
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
      },
    },
  });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(plan);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { planId } = await params;
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
