export const WALLET_ROTATION_STEP_UP_SECONDS = 10 * 60;

export function hasFreshAuthentication(authenticatedAt: number | undefined, nowSeconds: number): boolean {
  return Boolean(
    authenticatedAt &&
      authenticatedAt <= nowSeconds &&
      nowSeconds - authenticatedAt <= WALLET_ROTATION_STEP_UP_SECONDS
  );
}

export function canConsumeChallenge<T extends { userId: string; usedAt: Date | null; expiresAt: Date }>(
  challenge: T | null,
  userId: string,
  now: Date
): challenge is T {
  return Boolean(
    challenge && challenge.userId === userId && !challenge.usedAt && challenge.expiresAt.getTime() > now.getTime()
  );
}

export function eligiblePaymentLinkSelection(requested: string[], eligible: string[]): string[] {
  const allowed = new Set(eligible);
  return [...new Set(requested)].filter((id) => allowed.has(id));
}
