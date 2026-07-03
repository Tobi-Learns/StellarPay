import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  const { linkId } = await params;
  // The link IS the numericId now (3.2 ids change). encodedId is retired.
  const link = await db.paymentLink.findUnique({ where: { numericId: linkId } });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (link.archivedAt && req.nextUrl.searchParams.get("includeArchived") !== "1") {
    return NextResponse.json({ error: "Payment link archived" }, { status: 410 });
  }
  return NextResponse.json(link);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  const { linkId } = await params;
  const body = await req.json();
  const { archived, productName, description } = body as {
    archived?: boolean;
    productName?: string;
    description?: string;
  };

  if (archived === undefined && productName === undefined && description === undefined) {
    return NextResponse.json({ error: "No supported fields provided" }, { status: 400 });
  }

  const link = await db.paymentLink.update({
    where: { numericId: linkId },
    data: {
      ...(typeof archived === "boolean" ? { archivedAt: archived ? new Date() : null } : {}),
      ...(productName !== undefined ? { productName: productName.trim() } : {}),
      ...(description !== undefined ? { description } : {}),
    },
  });

  return NextResponse.json(link);
}
