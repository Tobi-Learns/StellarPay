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

const server = new rpc.Server(RPC_URL, { allowHttp: false });
const stellarPay = new Contract(CONTRACT_ID);

// ── types ─────────────────────────────────────────────────────────────────────

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

/**
 * Submit a signed XDR, wait for confirmation, and return the contract's return value.
 * Useful for calls that return a value (e.g. subscribe → sub ID).
 */
export async function submitAndWaitWithResult(
  signedXdr: string
): Promise<{ hash: string; returnValue: unknown }> {
  const tx = TransactionBuilder.fromXDR(signedXdr, PASSPHRASE);
  const sendResult = await server.sendTransaction(tx);
  if (sendResult.status === "ERROR") throw new Error("Transaction submission failed");

  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const status = await server.getTransaction(sendResult.hash);
    if (status.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      const returnValue = status.returnValue ? scValToNative(status.returnValue) : null;
      return { hash: sendResult.hash, returnValue };
    }
    if (status.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error("Transaction failed on-chain");
    }
  }
  throw new Error("Transaction confirmation timeout");
}

/** Submit a signed XDR and wait for on-chain confirmation. Returns tx hash. */
export async function submitAndWait(signedXdr: string): Promise<string> {
  const tx = TransactionBuilder.fromXDR(signedXdr, PASSPHRASE);
  const sendResult = await server.sendTransaction(tx);

  if (sendResult.status === "ERROR") {
    throw new Error("Transaction submission failed");
  }

  // Poll until confirmed
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const status = await server.getTransaction(sendResult.hash);
    if (status.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return sendResult.hash;
    }
    if (status.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error("Transaction failed on-chain");
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
  interval: number
): Promise<string> {
  return buildTxXdr(
    merchant,
    stellarPay.call(
      "create_plan",
      new Address(merchant).toScVal(),
      new Address(TEST_USDC).toScVal(),
      nativeToScVal(amount, { type: "i128" }),
      nativeToScVal(interval, { type: "u32" })
    )
  );
}

export function buildSubscribeXdr(
  subscriber: string,
  planId: bigint
): Promise<string> {
  return buildTxXdr(
    subscriber,
    stellarPay.call(
      "subscribe",
      new Address(subscriber).toScVal(),
      nativeToScVal(planId, { type: "u64" })
    )
  );
}

export function buildChargeXdr(
  invoker: string,
  subId: bigint
): Promise<string> {
  return buildTxXdr(
    invoker,
    stellarPay.call(
      "charge",
      new Address(invoker).toScVal(),
      nativeToScVal(subId, { type: "u64" })
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
  const account = await server.getAccount(CONTRACT_ID).catch(() =>
    // views don't need a real account; use the contract address as a dummy source
    ({ accountId: () => CONTRACT_ID, sequenceNumber: () => "0", incrementSequenceNumber: () => {} } as never)
  );

  const tx = new TransactionBuilder(
    await server.getAccount(CONTRACT_ID).catch(
      () => ({ accountId: () => CONTRACT_ID, sequenceNumber: () => "0", incrementSequenceNumber: () => {} } as never)
    ),
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
  return scValToNative(sim.result.retval) as Plan;
}

export async function getSubscription(subId: bigint): Promise<Subscription> {
  const tx = new TransactionBuilder(
    await server.getAccount(CONTRACT_ID).catch(
      () => ({ accountId: () => CONTRACT_ID, sequenceNumber: () => "0", incrementSequenceNumber: () => {} } as never)
    ),
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
  return scValToNative(sim.result.retval) as Subscription;
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
