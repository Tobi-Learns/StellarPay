import { getPlatformContext } from "@/lib/auth-session";
import { validateApiKey } from "@/lib/api-keys";

export type BusinessAccess = {
  businessId: string;
  merchant: string;
  settlementWalletId: string | null;
  source: "session" | "api-key";
};

export async function getBusinessAccess(req: Request): Promise<BusinessAccess | null> {
  const context = await getPlatformContext();
  if (context) {
    const wallet = context.business.wallets.find((candidate) => candidate.isDefault) ?? null;
    return {
      businessId: context.businessId,
      merchant: wallet?.address ?? "",
      settlementWalletId: wallet?.id ?? null,
      source: "session",
    };
  }

  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const result = await validateApiKey(authorization.slice(7).trim());
  if (!result) return null;
  return { ...result, source: "api-key" };
}

export function businessWalletAddresses(context: { business: { wallets: Array<{ address: string }> } }) {
  return context.business.wallets.map((wallet) => wallet.address);
}
