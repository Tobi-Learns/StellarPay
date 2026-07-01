import { createHash } from "node:crypto";
import { db } from "./db";

/** Validate an API key. Returns the merchant address on success, null otherwise. */
export async function validateApiKey(key: string): Promise<string | null> {
  if (!key.startsWith("sp_")) return null;

  const hash = createHash("sha256").update(key).digest("hex");
  const record = await db.apiKey.findUnique({ where: { keyHash: hash } });

  if (!record || record.revokedAt) return null;

  // Fire-and-forget lastUsedAt update
  db.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  return record.merchant;
}
