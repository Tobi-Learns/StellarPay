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
   * Register a payment link in the hosted DB. Call after generating the
   * encodedId / numericId client-side (same encoding the hosted frontend uses).
   */
  async createPaymentLink(opts: {
    encodedId: string;
    numericId: string;
    merchant: string;
    amount: string;
    description?: string;
  }): Promise<PaymentLinkRecord> {
    return this._post("/api/payments", opts);
  }

  /** List all payment links for a merchant. */
  async listPaymentLinks(merchant: string): Promise<PaymentLinkRecord[]> {
    return this._get(`/api/payments?merchant=${encodeURIComponent(merchant)}`);
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
    interval: number
  ): Promise<string> {
    return buildTxXdr(this.cfg, merchant, this.contract.call(
      "create_plan",
      new Address(merchant).toScVal(),
      new Address(this.cfg.sacAddress).toScVal(),
      nativeToScVal(amount, { type: "i128" }),
      nativeToScVal(interval, { type: "u32" }),
    ));
  }

  /**
   * Register a plan in the hosted DB after it has been created on-chain.
   * `onChainId` is the u64 returned by the create_plan contract call.
   */
  async registerPlan(opts: {
    onChainId: string;
    merchant: string;
    amount: string;
    interval: number;
    intervalLabel: string;
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
   * Build XDR for subscribing to a plan. Runs the first charge immediately.
   * After signing and submitting, capture the returned subId and call registerSubscription().
   */
  buildSubscribeXdr(subscriber: string, planId: bigint): Promise<string> {
    return buildTxXdr(this.cfg, subscriber, this.contract.call(
      "subscribe",
      new Address(subscriber).toScVal(),
      nativeToScVal(planId, { type: "u64" }),
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
    return scValToNative(sim.result!.retval) as Plan;
  }

  async getSubscription(subId: bigint): Promise<Subscription> {
    const sim = await simulateRead(
      this.cfg,
      this.contract.call("get_subscription", nativeToScVal(subId, { type: "u64" }))
    );
    return scValToNative(sim.result!.retval) as Subscription;
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
