export type MobileSigningKind = "payment" | "approve" | "subscribe";
export type MobileSigningStatus = "pending" | "submitted" | "settled" | "rejected" | "expired";

export type MobileSigningContext = {
  merchant?: string;
  amount?: string;
  linkId?: string;
  payerName?: string;
  payerEmail?: string;
  payerWallet?: string;
  subscriber?: string;
  planOnChainId?: string;
  subscriptionOnChainId?: string;
  anchorAt?: string;
};

export type MobileSigningSession = {
  id: string;
  kind: MobileSigningKind;
  status: MobileSigningStatus;
  message: string;
  xdr: string;
  uri: string;
  txHash?: string;
  error?: string;
  context: MobileSigningContext;
  createdAt: number;
  updatedAt: number;
};

const SESSION_TTL_MS = 15 * 60 * 1000;

type StoreGlobal = typeof globalThis & {
  __stellarpayMobileSigningSessions?: Map<string, MobileSigningSession>;
};

export function mobileSigningSessions(): Map<string, MobileSigningSession> {
  const g = globalThis as StoreGlobal;
  if (!g.__stellarpayMobileSigningSessions) {
    g.__stellarpayMobileSigningSessions = new Map();
  }
  return g.__stellarpayMobileSigningSessions;
}

export function getMobileSigningSession(id: string): MobileSigningSession | undefined {
  const session = mobileSigningSessions().get(id);
  if (!session) return undefined;
  if (session.status === "pending" && Date.now() - session.createdAt > SESSION_TTL_MS) {
    session.status = "expired";
    session.error = "QR signing request expired. Generate a fresh QR code.";
    session.updatedAt = Date.now();
  }
  return session;
}

export function updateMobileSigningSession(id: string, patch: Partial<MobileSigningSession>) {
  const existing = mobileSigningSessions().get(id);
  if (!existing) return;
  mobileSigningSessions().set(id, { ...existing, ...patch, updatedAt: Date.now() });
}
