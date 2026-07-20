export type AuthorizationResult = "allow" | "unauthorized" | "not-found";

export function authorizeBusinessResource(
  actorBusinessId: string | null,
  resourceBusinessId: string | null,
  operation: "public-read" | "platform-read" | "platform-write"
): AuthorizationResult {
  if (operation === "public-read") return "allow";
  if (!actorBusinessId) return "unauthorized";
  return resourceBusinessId === actorBusinessId ? "allow" : "not-found";
}

export function merchantFieldMatchesSettlement(
  suppliedMerchant: unknown,
  currentSettlementAddress: string
): boolean {
  return suppliedMerchant == null || suppliedMerchant === "" || suppliedMerchant === currentSettlementAddress;
}
