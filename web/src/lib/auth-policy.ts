export const TEST_AUTH_FLAG = "STELLARPAY_ENABLE_TEST_AUTH";

export function assertTestAuthConfiguration(
  enabled: boolean,
  nodeEnv: string | undefined
): void {
  if (enabled && nodeEnv === "production") {
    throw new Error(`${TEST_AUTH_FLAG} must never be enabled in production`);
  }
}

export function isVerifiedGoogleProfile(profile: unknown): boolean {
  if (!profile || typeof profile !== "object") return false;
  const candidate = profile as { email?: unknown; email_verified?: unknown; sub?: unknown };
  return (
    typeof candidate.sub === "string" &&
    candidate.sub.length > 0 &&
    typeof candidate.email === "string" &&
    candidate.email.length > 0 &&
    candidate.email_verified === true
  );
}

export function defaultBusinessName(name: string | null | undefined, email: string | null | undefined): string {
  const trimmed = name?.trim();
  if (trimmed) return trimmed;
  const localPart = email?.split("@")[0]?.trim();
  return localPart || "My business";
}

export function isActivePlatformSession(
  session: { user?: { id?: string | null } | null; expires?: string } | null | undefined,
  now: Date
): boolean {
  if (!session?.user?.id) return false;
  if (!session.expires) return true;
  const expiresAt = Date.parse(session.expires);
  return Number.isFinite(expiresAt) && expiresAt > now.getTime();
}

export function isAuthorizedTestFixture(user: { emailVerified: Date | null } | null): boolean {
  return Boolean(user?.emailVerified);
}
