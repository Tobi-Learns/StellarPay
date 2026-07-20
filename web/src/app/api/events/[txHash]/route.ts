import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPlatformContext } from "@/lib/auth-session";

// Single settled-payment detail: one Event joined with its payment link, for the
// Payments received manage view (4m). Keyed by txHash — the natural, unique id
// for a settled payment and what the list row already carries.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ txHash: string }> }
) {
  const context = await getPlatformContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { txHash } = await params;

  const event = await db.event.findUnique({
    where: { txHash },
    include: {
      paymentLink: {
        select: {
          extId: true,
          numericId: true,
          productName: true,
          description: true,
          amount: true,
          merchant: true,
        },
      },
    },
  });

  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (event.businessId !== context.businessId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(event);
}
