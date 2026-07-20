import { NextResponse } from "next/server";
import { getAuthenticatedUser, getPlatformContext } from "@/lib/auth-session";
import { createOwnedBusiness } from "@/lib/business";
import { db } from "@/lib/db";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const context = await getPlatformContext();
  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, image: user.image },
    business: context?.business ?? null,
    role: context?.role ?? null,
  });
}

export async function POST(req: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name } = (await req.json()) as { name?: string };
  try {
    const result = await createOwnedBusiness(db, user.id, name ?? "");
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create Business" },
      { status: 400 }
    );
  }
}

export async function PATCH(req: Request) {
  const context = await getPlatformContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name, logoUrl } = (await req.json()) as { name?: string; logoUrl?: string | null };
  const cleanName = name?.trim();
  if (!cleanName || cleanName.length > 100) {
    return NextResponse.json({ error: "Business name must be 1-100 characters" }, { status: 400 });
  }
  const business = await db.business.update({
    where: { id: context.businessId },
    data: { name: cleanName, logoUrl: logoUrl?.trim() || null },
  });
  return NextResponse.json(business);
}
