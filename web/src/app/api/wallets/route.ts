import { Keypair } from "@stellar/stellar-sdk";
import { NextResponse } from "next/server";
import { getAuthenticatedUser, getPlatformContext } from "@/lib/auth-session";
import { db } from "@/lib/db";
import { verifyWalletChallenge } from "@/lib/wallet-challenge";
import { canConsumeChallenge, eligiblePaymentLinkSelection } from "@/lib/wallet-policy";

export async function GET() {
  const context = await getPlatformContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(context.business.wallets);
}

export async function POST(req: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json()) as { challengeId?: string; signedXdr?: string; paymentLinkIds?: string[] };
  if (!body.challengeId || !body.signedXdr) {
    return NextResponse.json({ error: "challengeId and signedXdr required" }, { status: 400 });
  }

  const challenge = await db.walletChallenge.findFirst({
    where: { id: body.challengeId, userId: user.id },
  });
  if (!canConsumeChallenge(challenge, user.id, new Date())) {
    return NextResponse.json({ error: "Challenge expired or already used" }, { status: 409 });
  }

  try {
    const signingSecret = process.env.AUTH_STELLAR_SIGNING_SECRET;
    if (!signingSecret) throw new Error("AUTH_STELLAR_SIGNING_SECRET is not configured");
    verifyWalletChallenge({
      originalXdr: challenge.xdr,
      signedXdr: body.signedXdr,
      address: challenge.address,
      network: challenge.network,
      homeDomain: challenge.homeDomain,
      serverAddress: Keypair.fromSecret(signingSecret).publicKey(),
    });

    const result = await db.$transaction(async (tx) => {
      const consumed = await tx.walletChallenge.updateMany({
        where: { id: challenge.id, userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1) throw new Error("Challenge expired or already used");

      const existingWallet = await tx.settlementWallet.findUnique({ where: { address: challenge.address } });
      if (existingWallet && existingWallet.businessId !== challenge.businessId) {
        throw new Error("Wallet already belongs to another Business");
      }
      if (!challenge.businessId) throw new Error("Challenge has no Business");

      if (challenge.purpose === "claim") {
        const business = await tx.business.findUnique({ where: { id: challenge.businessId } });
        if (!business || business.claimedAt || business.importedFromWallet !== challenge.address) {
          throw new Error("Business is no longer claimable");
        }
        const currentMembership = await tx.membership.findFirst({ where: { userId: user.id, role: "owner" } });
        if (currentMembership) throw new Error("Account already owns a Business");
        await tx.membership.create({ data: { userId: user.id, businessId: business.id, role: "owner" } });
        await tx.business.update({ where: { id: business.id }, data: { claimedAt: new Date() } });
      } else {
        const membership = await tx.membership.findFirst({
          where: { userId: user.id, businessId: challenge.businessId, role: "owner" },
        });
        if (!membership) throw new Error("Unauthorized Business");
      }

      const current = await tx.settlementWallet.findFirst({
        where: { businessId: challenge.businessId, isDefault: true },
      });
      if (challenge.purpose === "attach" && current) {
        throw new Error("Business already has a settlement wallet");
      }
      if (challenge.purpose === "rotate" && current?.address === challenge.address) {
        throw new Error("Wallet is already the default");
      }

      if (challenge.purpose === "rotate") {
        await tx.settlementWallet.updateMany({
          where: { businessId: challenge.businessId, isDefault: true },
          data: { isDefault: false, status: "legacy", legacyAt: new Date() },
        });
      }

      const wallet = await tx.settlementWallet.upsert({
        where: { address: challenge.address },
        update: { isDefault: true, status: "current", legacyAt: null, verifiedAt: new Date() },
        create: {
          businessId: challenge.businessId,
          address: challenge.address,
          isDefault: true,
          status: "current",
          verifiedAt: new Date(),
        },
      });
      await tx.settlementWallet.updateMany({
        where: { businessId: challenge.businessId, id: { not: wallet.id }, isDefault: true },
        data: { isDefault: false },
      });

      let switchedPaymentLinkIds: string[] = [];
      if (challenge.purpose === "rotate" && body.paymentLinkIds?.length) {
        const eligible = await tx.paymentLink.findMany({
          where: { businessId: challenge.businessId, archivedAt: null },
          select: { id: true },
        });
        switchedPaymentLinkIds = eligiblePaymentLinkSelection(
          body.paymentLinkIds,
          eligible.map((link) => link.id)
        );
        await tx.paymentLink.updateMany({
          where: { businessId: challenge.businessId, id: { in: switchedPaymentLinkIds }, archivedAt: null },
          data: { merchant: challenge.address, settlementWalletId: wallet.id },
        });
      }

      await tx.merchant.upsert({
        where: { address: challenge.address },
        update: { businessId: challenge.businessId },
        create: { address: challenge.address, businessId: challenge.businessId },
      });
      await tx.walletAudit.create({
        data: {
          businessId: challenge.businessId,
          actorUserId: user.id,
          action: challenge.purpose,
          address: challenge.address,
          previousAddress: current?.address ?? null,
          metadata: switchedPaymentLinkIds.length ? { switchedPaymentLinkIds } : undefined,
        },
      });
      return wallet;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Wallet verification failed" },
      { status: 400 }
    );
  }
}
