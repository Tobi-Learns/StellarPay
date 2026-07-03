import {
  Contract,
  Address,
  nativeToScVal,
  scValToNative,
} from "@stellar/stellar-sdk";
import type {
  StellarPayConfig,
  Plan,
  Subscription,
  PaymentLinkRecord,
  PlanRecord,
  SubscriptionRecord,
} from "./types";
import {
  buildTxXdr,
  buildTrustlineTxXdr,
  submitAndWait,
  submitAndWaitWithResult,
  simulateRead,
  makeServer,
} from "./rpc";

export class StellarPayClient {
  private readonly cfg: StellarPayConfig;
  private readonly contract: Contract;
  private readonly sac: Contract;

  constructor(config: StellarPayConfig) {
    this.cfg = config;
    this.contract = new Contract(config.contractId);
    this.sac = new Contract(config.sacAddress);
  }

  // ── One-time payments ───────────────────────────────────────────────────────

  /**
   * Register a payment link in the hosted DB. `numericId` is the canonical link
   * id (a Snowflake) used both as the /pay URL param and the on-chain link_id.
   */
  async createPaymentLink(opts: {
    numericId: string;
    merchant: string;
    amount: string;
    productName: string;
    description?: string;
  }): Promise<PaymentLinkRecord> {
    return this._post("/api/payments", opts);
  }

  /** List all payment links for a merchant. */
  async listPaymentLinks(merchant: string): Promise<PaymentLinkRecord[]> {
    return this._get(`/api/payments?merchant=${encodeURIComponent(merchant)}`);
  }

  /**
   * Record a settled one-time payment in the hosted DB — creates the
   * `payment.settled` event and triggers webhook delivery to the merchant's
   * registered endpoints. Idempotent by txHash: recording the same payment
   * twice is a no-op. Include `payerName`/`payerEmail` so the merchant
   * dashboard shows who paid.
   */
  async recordPaymentSettled(opts: {
    txHash: string;
    merchant: string;
    /** Amount in stroops, as a string. */
    amount: string;
    /** Numeric link ID (same value passed to buildPayXdr). */
    linkId: string;
    payerName?: string;
    payerEmail?: string;
    payerWallet?: string;
  }): Promise<void> {
    const { txHash, ...data } = opts;
    await this._post("/api/events", { type: "payment.settled", txHash, data });
  }

  /**
   * Build XDR for a one-time payment. The caller signs and submits.
   * `amount` is in stroops (7 decimal places).
   */
  buildPayXdr(
    payer: string,
    merchant: string,
    amount: bigint,
    linkId: bigint
  ): Promise<string> {
    return buildTxXdr(this.cfg, payer, this.contract.call(
      "pay",
      new Address(payer).toScVal(),
      new Address(merchant).toScVal(),
      new Address(this.cfg.sacAddress).toScVal(),
      nativeToScVal(amount, { type: "i128" }),
      nativeToScVal(linkId, { type: "u64" }),
    ));
  }

  // ── Subscription plans ──────────────────────────────────────────────────────

  /**
   * Build XDR for creating a subscription plan on-chain.
   * After signing and submitting, capture the returned planId and call registerPlan().
   */
  buildCreatePlanXdr(
    merchant: string,
    amount: bigint,
    minIntervalSecs: number,
    planId: bigint
  ): Promise<string> {
    return buildTxXdr(this.cfg, merchant, this.contract.call(
      "create_plan",
      new Address(merchant).toScVal(),
      new Address(this.cfg.sacAddress).toScVal(),
      nativeToScVal(amount, { type: "i128" }),
      nativeToScVal(BigInt(minIntervalSecs), { type: "u64" }),
      nativeToScVal(planId, { type: "u64" }),
    ));
  }

  /**
   * Register a plan in the hosted DB after it has been created on-chain.
   * `onChainId` is the u64 returned by the create_plan contract call.
   * `interval` is min_interval_secs; `intervalUnit`/`intervalCount` describe the
   * real calendar interval used for date math.
   */
  async registerPlan(opts: {
    onChainId: string;
    merchant: string;
    amount: string;
    productName?: string;
    description?: string;
    interval: number;
    intervalLabel: string;
    intervalUnit: string;
    intervalCount: number;
  }): Promise<PlanRecord> {
    return this._post("/api/plans", opts);
  }

  /** List all plans for a merchant. */
  async listPlans(merchant: string): Promise<PlanRecord[]> {
    return this._get(`/api/plans?merchant=${encodeURIComponent(merchant)}`);
  }

  // ── Subscriptions ───────────────────────────────────────────────────────────

  /**
   * Build XDR for the SAC approve step — subscriber grants the contract
   * a spending cap before calling subscribe.
   * `amount` is the cap in stroops; `expiryLedger` is when the allowance expires.
   */
  buildApproveXdr(
    subscriber: string,
    amount: bigint,
    expiryLedger: number
  ): Promise<string> {
    return buildTxXdr(this.cfg, subscriber, this.sac.call(
      "approve",
      new Address(subscriber).toScVal(),
      new Address(this.cfg.contractId).toScVal(),
      nativeToScVal(amount, { type: "i128" }),
      nativeToScVal(expiryLedger, { type: "u32" }),
    ));
  }

  /**
   * Build XDR for subscribing to a plan. Runs the first charge immediately and
   * sets the next due date to `nextChargeAt` (a UTC unix timestamp — compute it
   * with `firstNextChargeAt(anchor, interval)` then `toUnixSeconds`).
   * After signing and submitting, capture the returned subId and call registerSubscription().
   */
  buildSubscribeXdr(subscriber: string, planId: bigint, nextChargeAt: number, subId: bigint): Promise<string> {
    return buildTxXdr(this.cfg, subscriber, this.contract.call(
      "subscribe",
      new Address(subscriber).toScVal(),
      nativeToScVal(planId, { type: "u64" }),
      nativeToScVal(BigInt(nextChargeAt), { type: "u64" }),
      nativeToScVal(subId, { type: "u64" }),
    ));
  }

  /** Build XDR for canceling a subscription on-chain. */
  buildCancelXdr(subscriber: string, subId: bigint): Promise<string> {
    return buildTxXdr(this.cfg, subscriber, this.contract.call(
      "cancel",
      new Address(subscriber).toScVal(),
      nativeToScVal(subId, { type: "u64" }),
    ));
  }

  /**
   * Register a subscription in the hosted DB after it has been created on-chain.
   * `onChainId` is the u64 returned by the subscribe contract call.
   */
  async registerSubscription(opts: {
    onChainId: string;
    planOnChainId: string;
    subscriber: string;
    merchant: string;
    amount: string;
    payerName?: string;
    payerEmail?: string;
    anchorAt?: string; // ISO subscribe date — the anchor for billing-date math
  }): Promise<SubscriptionRecord> {
    return this._post("/api/subscriptions", opts);
  }

  /** List subscriptions — filter by merchant or subscriber address. */
  async listSubscriptions(filter: { merchant: string } | { subscriber: string }): Promise<SubscriptionRecord[]> {
    const param = "merchant" in filter
      ? `merchant=${encodeURIComponent(filter.merchant)}`
      : `subscriber=${encodeURIComponent(filter.subscriber)}`;
    return this._get(`/api/subscriptions?${param}`);
  }

  // ── On-chain read views ─────────────────────────────────────────────────────

  async getPlan(planId: bigint): Promise<Plan> {
    const sim = await simulateRead(
      this.cfg,
      this.contract.call("get_plan", nativeToScVal(planId, { type: "u64" }))
    );
    const plan = scValToNative(sim.result!.retval) as Plan & { min_interval_secs: bigint | number };
    return { ...plan, min_interval_secs: Number(plan.min_interval_secs) };
  }

  async getSubscription(subId: bigint): Promise<Subscription> {
    const sim = await simulateRead(
      this.cfg,
      this.contract.call("get_subscription", nativeToScVal(subId, { type: "u64" }))
    );
    const sub = scValToNative(sim.result!.retval) as Subscription & {
      next_charge_at: bigint | number;
      created_at: bigint | number;
    };
    return { ...sub, next_charge_at: Number(sub.next_charge_at), created_at: Number(sub.created_at) };
  }

  async getCurrentLedger(): Promise<number> {
    const { sequence } = await makeServer(this.cfg).getLatestLedger();
    return sequence;
  }

  /**
   * Returns a signed CHANGE_TRUST XDR if `address` is missing a trustline to
   * the configured `classicAsset`, or null if the trustline already exists.
   * Call this before any payment or subscription and have the user sign + submit
   * the returned XDR first — otherwise the SAC will reject the transfer.
   */
  buildTrustlineXdr(address: string): Promise<string | null> {
    return buildTrustlineTxXdr(this.cfg, address);
  }

  // ── Submit helpers ──────────────────────────────────────────────────────────

  /** Submit a signed XDR and wait for on-chain confirmation. Returns tx hash. */
  submitAndWait(signedXdr: string): Promise<string> {
    return submitAndWait(this.cfg, signedXdr);
  }

  /**
   * Submit a signed XDR and return the contract's return value.
   * Use this for create_plan and subscribe, which return IDs.
   */
  submitAndWaitWithResult(signedXdr: string): Promise<{ hash: string; returnValue: unknown }> {
    return submitAndWaitWithResult(this.cfg, signedXdr);
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  private async _post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.cfg.apiBase}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`POST ${path} failed (${res.status}): ${text}`);
    }
    return res.json();
  }

  private async _get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.cfg.apiBase}${path}`);
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`GET ${path} failed (${res.status}): ${text}`);
    }
    return res.json();
  }
}
