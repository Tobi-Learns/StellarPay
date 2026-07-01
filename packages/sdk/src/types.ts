export interface StellarPayConfig {
  /** Base URL of the hosted StellarPay app, e.g. "https://stellarpay.vercel.app" */
  apiBase: string;
  contractId: string;
  sacAddress: string;
  rpcUrl: string;
  networkPassphrase: string;
  /**
   * Horizon REST API base URL. Required for trustline auto-setup.
   * Testnet: "https://horizon-testnet.stellar.org"
   */
  horizonUrl?: string;
  /**
   * The classic Stellar asset wrapped by the SAC. When provided, the SDK detects
   * a missing trustline and builds a CHANGE_TRUST transaction automatically so
   * users don't see a cryptic on-chain failure.
   */
  classicAsset?: { code: string; issuer: string };
}

// ── On-chain types ────────────────────────────────────────────────────────────

export interface Plan {
  id: bigint;
  merchant: string;
  asset: string;
  amount: bigint;
  interval: number;
  active: boolean;
}

export interface Subscription {
  id: bigint;
  plan_id: bigint;
  subscriber: string;
  status: "Active" | "PastDue" | "Canceled";
  next_charge: number;
  created_at: number;
}

// ── API record types (mirrors Prisma schema) ──────────────────────────────────

export interface PaymentLinkRecord {
  id: string;
  encodedId: string;
  numericId: string;
  merchant: string;
  amount: string;
  description?: string;
  createdAt: string;
}

export interface PlanRecord {
  id: string;
  onChainId: string;
  merchant: string;
  amount: string;
  interval: number;
  intervalLabel: string;
  createdAt: string;
}

export interface SubscriptionRecord {
  id: string;
  onChainId: string;
  planOnChainId: string;
  subscriber: string;
  merchant: string;
  amount: string;
  payerName?: string;
  payerEmail?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}
