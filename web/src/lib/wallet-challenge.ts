import { Keypair, Networks, StrKey, TransactionBuilder, WebAuth } from "@stellar/stellar-sdk";

export const WALLET_CHALLENGE_TTL_SECONDS = 5 * 60;

export type WalletChallengePurpose = "attach" | "claim" | "rotate";

export function isWalletChallengePurpose(value: unknown): value is WalletChallengePurpose {
  return value === "attach" || value === "claim" || value === "rotate";
}

export function validateStellarAddress(address: string): boolean {
  return StrKey.isValidEd25519PublicKey(address);
}

export function walletAuthConfig() {
  const secret = process.env.AUTH_STELLAR_SIGNING_SECRET;
  if (!secret) throw new Error("AUTH_STELLAR_SIGNING_SECRET is not configured");

  const baseUrl =
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    process.env.NEXT_PUBLIC_STELLARPAY_URL ??
    "http://localhost:3000";
  const homeDomain = new URL(baseUrl).host;
  const network = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? Networks.TESTNET;
  const serverKeypair = Keypair.fromSecret(secret);
  return { homeDomain, network, serverKeypair };
}

export function buildWalletChallenge(address: string) {
  if (!validateStellarAddress(address)) throw new Error("Invalid Stellar address");
  const { homeDomain, network, serverKeypair } = walletAuthConfig();
  const xdr = WebAuth.buildChallengeTx(
    serverKeypair,
    address,
    homeDomain,
    WALLET_CHALLENGE_TTL_SECONDS,
    network,
    homeDomain
  );
  return {
    xdr,
    network,
    homeDomain,
    serverAddress: serverKeypair.publicKey(),
    expiresAt: new Date(Date.now() + WALLET_CHALLENGE_TTL_SECONDS * 1000),
  };
}

export function verifyWalletChallenge({
  originalXdr,
  signedXdr,
  address,
  network,
  homeDomain,
  serverAddress,
}: {
  originalXdr: string;
  signedXdr: string;
  address: string;
  network: string;
  homeDomain: string;
  serverAddress: string;
}): void {
  const original = TransactionBuilder.fromXDR(originalXdr, network);
  const signed = TransactionBuilder.fromXDR(signedXdr, network);
  if (!original.hash().equals(signed.hash())) throw new Error("Challenge transaction was changed");

  const signers = WebAuth.verifyChallengeTxSigners(
    signedXdr,
    serverAddress,
    network,
    [address],
    homeDomain,
    homeDomain
  );
  if (!signers.includes(address)) throw new Error("Challenge was not signed by the selected wallet");
}
