import {
  Contract,
  Networks,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  Address,
  rpc,
} from "@stellar/stellar-sdk";

// ── config ────────────────────────────────────────────────────────────────────

const RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL!;
const PASSPHRASE = Networks.TESTNET;
const CONTRACT_ID = process.env.NEXT_PUBLIC_STELLARPAY_CONTRACT_ID!;
const TEST_USDC = process.env.NEXT_PUBLIC_TEST_USDC_SAC!;
const VIEW_SOURCE_ACCOUNT =
  process.env.CRON_ADMIN_ADDRESS ??
  process.env.NEXT_PUBLIC_PLATFORM_ADDRESS ??
  CONTRACT_ID;

const server = new rpc.Server(RPC_URL, { allowHttp: false });
const stellarPay = new Contract(CONTRACT_ID);

// ── types ─────────────────────────────────────────────────────────────────────

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

// ── core helpers ──────────────────────────────────────────────────────────────

/**
 * Simulate → assemble → return XDR for the caller to sign.
 * The sign step happens in the browser via the wallet context.
 */
export async function buildTxXdr(
  sourceAddress: string,
  operation: ReturnType<Contract["call"]>
): Promise<string> {
  const account = await server.getAccount(sourceAddress);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const simResult = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simResult)) {
    throw new Error(`Simulation failed: ${simResult.error}`);
  }

  return rpc.assembleTransaction(tx, simResult).build().toXDR();
}

/** Best-effort extraction of the RPC rejection reason (e.g. txBadSeq, txInsufficientFee). */
function describeSendError(sendResult: rpc.Api.SendTransactionResponse): string {
  try {
    const code = sendResult.errorResult?.result().switch().name;
    if (code) return code;
  } catch {
    /* errorResult not present or not decodable */
  }
  return sendResult.status;
}

/** Best-effort extraction of an on-chain failure reason from a FAILED getTransaction result. */
function describeFailure(status: rpc.Api.GetFailedTransactionResponse): string {
  try {
    const code = status.resultXdr?.result().switch().name;
    if (code) return code;
  } catch {
    /* resultXdr not present or not decodable */
  }
  return "unknown";
}

/**
 * Submit a signed XDR, wait for confirmation, and return the contract's return value.
 * Useful for calls that return a value (e.g. subscribe → sub ID).
 */
export async function submitAndWaitWithResult(
  signedXdr: string
): Promise<{ hash: string; returnValue: unknown }> {
  const tx = TransactionBuilder.fromXDR(signedXdr, PASSPHRASE);
  const sendResult = await server.sendTransaction(tx);
  if (sendResult.status === "ERROR") {
    throw new Error(`Transaction submission failed: ${describeSendError(sendResult)}`);
  }

  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const status = await server.getTransaction(sendResult.hash);
    if (status.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      const returnValue = status.returnValue ? scValToNative(status.returnValue) : null;
      return { hash: sendResult.hash, returnValue };
    }
    if (status.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction failed on-chain (${sendResult.hash}): ${describeFailure(status)}`);
    }
  }
  throw new Error("Transaction confirmation timeout");
}

/** Submit a signed XDR and wait for on-chain confirmation. Returns tx hash. */
export async function submitAndWait(signedXdr: string): Promise<string> {
  const tx = TransactionBuilder.fromXDR(signedXdr, PASSPHRASE);
  const sendResult = await server.sendTransaction(tx);

  if (sendResult.status === "ERROR") {
    throw new Error(`Transaction submission failed: ${describeSendError(sendResult)}`);
  }

  // Poll until confirmed
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const status = await server.getTransaction(sendResult.hash);
    if (status.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return sendResult.hash;
    }
    if (status.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction failed on-chain (${sendResult.hash}): ${describeFailure(status)}`);
    }
  }
  throw new Error("Transaction confirmation timeout");
}

// ── ledger helpers ────────────────────────────────────────────────────────────

export async function getCurrentLedger(): Promise<number> {
  const { sequence } = await server.getLatestLedger();
  return sequence;
}

// ── contract call builders ────────────────────────────────────────────────────
// Each returns the XDR string; the caller signs it via the wallet context.

/** Build XDR for SAC approve — subscriber grants contract a spending allowance. */
export function buildApproveXdr(
  subscriber: string,
  amount: bigint,
  expiryLedger: number
): Promise<string> {
  const sac = new Contract(TEST_USDC);
  return buildTxXdr(
    subscriber,
    sac.call(
      "approve",
      new Address(subscriber).toScVal(),
      new Address(CONTRACT_ID).toScVal(),
      nativeToScVal(amount, { type: "i128" }),
      nativeToScVal(expiryLedger, { type: "u32" })
    )
  );
}

export function buildPayXdr(
  payer: string,
  merchant: string,
  amount: bigint,
  linkId: bigint
): Promise<string> {
  return buildTxXdr(
    payer,
    stellarPay.call(
      "pay",
      new Address(payer).toScVal(),
      new Address(merchant).toScVal(),
      new Address(TEST_USDC).toScVal(),
      nativeToScVal(amount, { type: "i128" }),
      nativeToScVal(linkId, { type: "u64" })
    )
  );
}

export function buildCreatePlanXdr(
  merchant: string,
  amount: bigint,
  minIntervalSecs: number,
  planId: bigint
): Promise<string> {
  return buildTxXdr(
    merchant,
    stellarPay.call(
      "create_plan",
      new Address(merchant).toScVal(),
      new Address(TEST_USDC).toScVal(),
      nativeToScVal(amount, { type: "i128" }),
      nativeToScVal(BigInt(minIntervalSecs), { type: "u64" }),
      nativeToScVal(planId, { type: "u64" })
    )
  );
}

export function buildSubscribeXdr(
  subscriber: string,
  planId: bigint,
  nextChargeAt: number,
  subId: bigint
): Promise<string> {
  return buildTxXdr(
    subscriber,
    stellarPay.call(
      "subscribe",
      new Address(subscriber).toScVal(),
      nativeToScVal(planId, { type: "u64" }),
      nativeToScVal(BigInt(nextChargeAt), { type: "u64" }),
      nativeToScVal(subId, { type: "u64" })
    )
  );
}

export function buildChargeXdr(
  invoker: string,
  subId: bigint,
  periods: number,
  newNextChargeAt: number
): Promise<string> {
  return buildTxXdr(
    invoker,
    stellarPay.call(
      "charge",
      new Address(invoker).toScVal(),
      nativeToScVal(subId, { type: "u64" }),
      nativeToScVal(periods, { type: "u32" }),
      nativeToScVal(BigInt(newNextChargeAt), { type: "u64" })
    )
  );
}

export function buildCancelXdr(
  subscriber: string,
  subId: bigint
): Promise<string> {
  return buildTxXdr(
    subscriber,
    stellarPay.call(
      "cancel",
      new Address(subscriber).toScVal(),
      nativeToScVal(subId, { type: "u64" })
    )
  );
}

// ── read-only views ───────────────────────────────────────────────────────────

export async function getPlan(planId: bigint): Promise<Plan> {
  const tx = new TransactionBuilder(
    await getViewAccount(),
    { fee: BASE_FEE, networkPassphrase: PASSPHRASE }
  )
    .addOperation(
      stellarPay.call("get_plan", nativeToScVal(planId, { type: "u64" }))
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim) || !("result" in sim) || !sim.result) {
    throw new Error("Failed to fetch plan");
  }
  const plan = scValToNative(sim.result.retval) as Plan & { min_interval_secs: bigint | number };
  return { ...plan, min_interval_secs: Number(plan.min_interval_secs) };
}

export async function getSubscription(subId: bigint): Promise<Subscription> {
  const tx = new TransactionBuilder(
    await getViewAccount(),
    { fee: BASE_FEE, networkPassphrase: PASSPHRASE }
  )
    .addOperation(
      stellarPay.call("get_subscription", nativeToScVal(subId, { type: "u64" }))
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim) || !("result" in sim) || !sim.result) {
    throw new Error("Failed to fetch subscription");
  }
  const subscription = scValToNative(sim.result.retval) as Subscription & {
    status: unknown;
    next_charge_at: bigint | number;
    created_at: bigint | number;
  };
  return {
    ...subscription,
    status: normalizeStatus(subscription.status),
    next_charge_at: Number(subscription.next_charge_at),
    created_at: Number(subscription.created_at),
  };
}

// ── utils ─────────────────────────────────────────────────────────────────────

export const USDC_DECIMALS = 7;

export function formatUsdc(stroops: bigint): string {
  const whole = stroops / BigInt(10 ** USDC_DECIMALS);
  const frac = stroops % BigInt(10 ** USDC_DECIMALS);
  return `${whole}.${frac.toString().padStart(USDC_DECIMALS, "0").replace(/0+$/, "") || "00"}`;
}

export function parseUsdc(display: string): bigint {
  const [whole = "0", frac = "0"] = display.split(".");
  const paddedFrac = frac.padEnd(USDC_DECIMALS, "0").slice(0, USDC_DECIMALS);
  return BigInt(whole) * BigInt(10 ** USDC_DECIMALS) + BigInt(paddedFrac);
}

export function truncateAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getViewAccount() {
  return server.getAccount(VIEW_SOURCE_ACCOUNT).catch(
    () => ({ accountId: () => VIEW_SOURCE_ACCOUNT, sequenceNumber: () => "0", incrementSequenceNumber: () => {} } as never)
  );
}

function normalizeStatus(status: unknown): Subscription["status"] {
  const value = Array.isArray(status) ? status[0] : status;
  if (value === "Active" || value === "PastDue" || value === "Canceled") return value;
  throw new Error(`Unknown subscription status: ${String(value)}`);
}
