import { createHash } from "node:crypto";

export type LegacyResource = {
  id: string;
  merchant: string | null;
  displayName?: string | null;
  email?: string | null;
};

export type BackfillState = {
  businesses: Array<{ id: string; name: string; importedFromWallet: string }>;
  wallets: Array<{ id: string; businessId: string; address: string }>;
  ownership: Record<string, { businessId: string; settlementWalletId: string }>;
};

function legacyId(prefix: "business" | "wallet", address: string): string {
  return `legacy_${prefix}_${createHash("md5").update(address).digest("hex")}`;
}

/**
 * Pure mirror of the migration's ownership decisions. It exists so the
 * additive backfill can be exercised deterministically without a live DB.
 */
export function planLegacyBackfill(resources: LegacyResource[], initial?: Partial<BackfillState>): BackfillState {
  const state: BackfillState = {
    businesses: structuredClone(initial?.businesses ?? []),
    wallets: structuredClone(initial?.wallets ?? []),
    ownership: structuredClone(initial?.ownership ?? {}),
  };
  const next = structuredClone(state);
  const byAddress = new Map<string, LegacyResource>();
  for (const resource of resources) {
    const address = resource.merchant?.trim();
    if (!address) continue;
    const prior = byAddress.get(address);
    byAddress.set(address, prior?.displayName ? prior : resource);
  }

  for (const [address, sample] of [...byAddress].sort(([a], [b]) => a.localeCompare(b))) {
    let business = next.businesses.find((candidate) => candidate.importedFromWallet === address);
    if (!business) {
      business = {
        id: legacyId("business", address),
        name: sample.displayName?.trim() || "Imported Business",
        importedFromWallet: address,
      };
      next.businesses.push(business);
    }

    const existingWallet = next.wallets.find((candidate) => candidate.address === address);
    if (existingWallet && existingWallet.businessId !== business.id) {
      throw new Error(`Wallet ${address} already belongs to another Business`);
    }
    const wallet = existingWallet ?? {
      id: legacyId("wallet", address),
      businessId: business.id,
      address,
    };
    if (!existingWallet) next.wallets.push(wallet);

    for (const resource of resources.filter((candidate) => candidate.merchant?.trim() === address)) {
      next.ownership[resource.id] ??= { businessId: business.id, settlementWalletId: wallet.id };
    }
  }
  return next;
}
