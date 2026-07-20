import type { Prisma, PrismaClient } from "@prisma/client";

type DbLike = PrismaClient | Prisma.TransactionClient;

export async function getOwnerMembership(db: DbLike, userId: string) {
  return db.membership.findFirst({
    where: { userId, role: "owner" },
    orderBy: { createdAt: "asc" },
    include: {
      business: {
        include: { wallets: { orderBy: [{ isDefault: "desc" }, { verifiedAt: "asc" }] } },
      },
    },
  });
}

export async function createOwnedBusiness(
  db: DbLike,
  userId: string,
  name: string
) {
  const cleanName = name.trim();
  if (!cleanName || cleanName.length > 100) throw new Error("Business name must be 1-100 characters");
  const existing = await getOwnerMembership(db, userId);
  if (existing) return existing;

  const business = await db.business.create({
    data: {
      name: cleanName,
      claimedAt: new Date(),
      memberships: { create: { userId, role: "owner" } },
    },
    include: { memberships: true, wallets: true },
  });
  return business;
}
