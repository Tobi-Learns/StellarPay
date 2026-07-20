import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuthenticatedUser, getPlatformContext } from "@/lib/auth-session";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  buildWalletChallenge,
  isWalletChallengePurpose,
  validateStellarAddress,
} from "@/lib/wallet-challenge";
import { hasFreshAuthentication } from "@/lib/wallet-policy";

export async function POST(req: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json()) as { address?: string; purpose?: unknown };
  const address = body.address?.trim();
  if (!address || !validateStellarAddress(address) || !isWalletChallengePurpose(body.purpose)) {
    return NextResponse.json({ error: "Valid address and purpose required" }, { status: 400 });
  }

  const context = await getPlatformContext();
  let businessId = context?.businessId ?? null;
  if (body.purpose === "claim") {
    if (context) return NextResponse.json({ error: "Account already owns a Business" }, { status: 409 });
    const imported = await db.business.findUnique({ where: { importedFromWallet: address } });
    if (!imported || imported.claimedAt) {
      return NextResponse.json({ error: "No unclaimed Business exists for this wallet" }, { status: 404 });
    }
    businessId = imported.id;
  } else if (!context) {
    return NextResponse.json({ error: "Create a Business before attaching a wallet" }, { status: 409 });
  }

  if (body.purpose === "rotate") {
    const session = await auth();
    if (!hasFreshAuthentication(session?.authenticatedAt, Math.floor(Date.now() / 1000))) {
      return NextResponse.json(
        { error: "Sign in with Google again before rotating a settlement wallet", code: "STEP_UP_REQUIRED" },
        { status: 403 }
      );
    }
  }

  try {
    const challenge = buildWalletChallenge(address);
    const record = await db.walletChallenge.create({
      data: {
        userId: user.id,
        businessId,
        address,
        purpose: body.purpose,
        nonce: randomBytes(32).toString("hex"),
        xdr: challenge.xdr,
        network: challenge.network,
        homeDomain: challenge.homeDomain,
        expiresAt: challenge.expiresAt,
      },
    });
    return NextResponse.json({
      id: record.id,
      xdr: record.xdr,
      address,
      networkPassphrase: record.network,
      expiresAt: record.expiresAt,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create wallet challenge" },
      { status: 503 }
    );
  }
}
