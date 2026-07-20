import { NextResponse } from "next/server";
import { getPlatformContext } from "@/lib/auth-session";
import { db } from "@/lib/db";

export async function GET() {
  const context = await getPlatformContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [paymentLinks, plans] = await Promise.all([
    db.paymentLink.findMany({
      where: { businessId: context.businessId, archivedAt: null },
      select: { id: true, numericId: true, productName: true, merchant: true },
      orderBy: { createdAt: "desc" },
    }),
    db.plan.findMany({
      where: { businessId: context.businessId, archivedAt: null },
      select: {
        id: true,
        onChainId: true,
        productName: true,
        merchant: true,
        subscriptions: { where: { status: "Active" }, select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return NextResponse.json({
    paymentLinks,
    recurringPlans: plans.map(({ subscriptions, ...plan }) => ({ ...plan, activeSubscriptions: subscriptions.length })),
  });
}
