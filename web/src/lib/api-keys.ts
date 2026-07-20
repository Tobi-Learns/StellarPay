import { createHash } from "node:crypto";
import { db } from "./db";

/** Validate an API key and resolve its Business + current settlement context. */
export async function validateApiKey(
  key: string
): Promise<{ businessId: string; merchant: string; settlementWalletId: string | null } | null> {
  if (!key.startsWith("sp_")) return null;

  const hash = createHash("sha256").update(key).digest("hex");
  const record = await db.apiKey.findUnique({ where: { keyHash: hash } });

  if (!record || record.revokedAt) return null;

  // Fire-and-forget lastUsedAt update
  db.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  let businessId = record.businessId;
  if (!businessId) {
    const wallet = await db.settlementWallet.findUnique({ where: { address: record.merchant } });
    businessId = wallet?.businessId ?? null;
  }
  if (!businessId) return null;

  const current = await db.settlementWallet.findFirst({
    where: { businessId, isDefault: true },
    select: { id: true, address: true },
  });
  return {
    businessId,
    merchant: current?.address ?? record.merchant,
    settlementWalletId: current?.id ?? null,
  };
}
