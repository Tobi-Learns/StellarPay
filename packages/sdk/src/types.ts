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
  min_interval_secs: number; // on-chain cadence floor (seconds)
  active: boolean;
}

export interface Subscription {
  id: bigint;
  plan_id: bigint;
  subscriber: string;
  status: "Active" | "PastDue" | "Canceled";
  next_charge_at: number; // unix seconds
  created_at: number;     // unix seconds
}

// ── API record types (mirrors Prisma schema) ──────────────────────────────────

export interface PaymentLinkRecord {
  id: string;
  extId: string;        // plink_ + ULID — the external handle (3.2)
  numericId: string;    // Snowflake u64 — the canonical link id (URL + contract link_id)
  merchant: string;
  amount: string;
  description?: string;
  createdAt: string;
}

export interface PlanRecord {
  id: string;
  extId: string;        // plan_ + ULID — the external handle (3.2)
  onChainId: string;
  merchant: string;
  amount: string;
  interval: number;         // min_interval_secs
  intervalLabel: string;
  intervalUnit: string;
  intervalCount: number;
  createdAt: string;
}

export interface SubscriptionRecord {
  id: string;
  extId: string;        // sub_ + ULID — the external handle (3.2)
  onChainId: string;
  planOnChainId: string;
  subscriber: string;
  merchant: string;
  amount: string;
  payerName?: string;
  payerEmail?: string;
  status: string;
  anchorAt?: string;
  periodsCharged?: number;
  createdAt: string;
  updatedAt: string;
}
