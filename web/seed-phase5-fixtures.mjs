import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Keypair } from "@stellar/stellar-sdk";

if (process.env.NODE_ENV === "production") {
  throw new Error("Phase 5 fixtures must never be seeded in production");
}

const connectionString = process.env.TRANSACTION_URL;
if (!connectionString) throw new Error("TRANSACTION_URL is required");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const fixtures = [
  { suffix: "alpha", email: "phase5-alpha@stellarpay.test", seedByte: 11 },
  { suffix: "beta", email: "phase5-beta@stellarpay.test", seedByte: 22 },
];

try {
  for (const fixture of fixtures) {
    const userId = `phase5_user_${fixture.suffix}`;
    const businessId = `phase5_business_${fixture.suffix}`;
    const address = Keypair.fromRawEd25519Seed(Buffer.alloc(32, fixture.seedByte)).publicKey();
    await db.$transaction(async (tx) => {
      await tx.user.upsert({
        where: { email: fixture.email },
        update: { emailVerified: new Date(0) },
        create: {
          id: userId,
          email: fixture.email,
          emailVerified: new Date(0),
          name: `Phase 5 ${fixture.suffix}`,
        },
      });
      await tx.business.upsert({
        where: { id: businessId },
        update: {},
        create: { id: businessId, name: `Fixture ${fixture.suffix}`, claimedAt: new Date(0) },
      });
      await tx.membership.upsert({
        where: { userId_businessId: { userId, businessId } },
        update: { role: "owner" },
        create: { id: `phase5_membership_${fixture.suffix}`, userId, businessId, role: "owner" },
      });
      const wallet = await tx.settlementWallet.upsert({
        where: { address },
        update: { businessId, status: "current", isDefault: true },
        create: {
          id: `phase5_wallet_${fixture.suffix}`,
          businessId,
          address,
          verifiedAt: new Date(0),
          status: "current",
          isDefault: true,
        },
      });
      await tx.settlementWallet.updateMany({
        where: { businessId, id: { not: wallet.id } },
        data: { isDefault: false },
      });
      await tx.merchant.upsert({
        where: { address },
        update: { businessId },
        create: { address, businessId, displayName: `Fixture ${fixture.suffix}` },
      });
    });
    console.log(`${fixture.email} -> ${address}`);
  }
} finally {
  await db.$disconnect();
}
