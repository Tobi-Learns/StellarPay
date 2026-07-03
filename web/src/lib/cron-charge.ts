import {
  Keypair,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  Address,
  nativeToScVal,
  scValToNative,
  Contract,
  xdr,
} from "@stellar/stellar-sdk";
import * as rpc from "@stellar/stellar-sdk/rpc";
import { db } from "@/lib/db";
import { getSubscription } from "@/lib/stellar";
import { deliverWebhook } from "@/lib/webhooks";
import { newId } from "@/lib/ids";
import { computeCatchUp, toUnixSeconds, type Interval, type IntervalUnit } from "@/lib/billing-schedule";

const RPC_URL = "https://soroban-testnet.stellar.org";
const CONTRACT_ID = process.env.NEXT_PUBLIC_STELLARPAY_CONTRACT_ID!;
const SAC_ID = process.env.NEXT_PUBLIC_TEST_USDC_SAC!;
const NETWORK_PASSPHRASE = Networks.TESTNET;

// 2j temporary overdue retry policy: when a due charge can't be collected,
// re-attempt 3 minutes later, at most twice, before canceling. Cancellation
// only ever happens on confirmed customer-side insufficient funds/allowance —
// system/RPC failures reschedule but never count toward it.
const RETRY_DELAY_MS = 3 * 60 * 1000;
const MAX_RETRIES = 2;

const server = new rpc.Server(RPC_URL, { allowHttp: false });

// "due" = the regular 15-minute pass over all Active subscriptions.
// "retry" = the 3-minute pass that only touches subscriptions with a pending retry.
export type ChargeMode = "due" | "retry";

interface ChargeResult {
  id: string;
  result: string;
}

async function buildAndSignCharge(
  adminKp: Keypair,
  subId: bigint,
  periods: number,
  newNextChargeAt: number
): Promise<string> {
  const contract = new Contract(CONTRACT_ID);
  const account = await server.getAccount(adminKp.publicKey());

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "charge",
        new Address(adminKp.publicKey()).toScVal(),
        nativeToScVal(subId, { type: "u64" }),
        nativeToScVal(periods, { type: "u32" }),
        nativeToScVal(BigInt(newNextChargeAt), { type: "u64" })
      )
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);

  const assembled = rpc.assembleTransaction(tx, sim).build();
  assembled.sign(adminKp);
  return assembled.toXDR();
}

async function submitAndWait(signedXdr: string): Promise<string> {
  const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  const send = await server.sendTransaction(tx);
  if (send.status === "ERROR") throw new Error(JSON.stringify(send.errorResult));

  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const status = await server.getTransaction(send.hash);
    if (status.status === rpc.Api.GetTransactionStatus.SUCCESS) return send.hash;
    if (status.status === rpc.Api.GetTransactionStatus.FAILED)
      throw new Error("Transaction failed");
  }
  throw new Error("Transaction timeout");
}

async function simulateSacView(
  source: string,
  method: string,
  ...args: xdr.ScVal[]
): Promise<bigint> {
  const contract = new Contract(SAC_ID);
  const account = await server.getAccount(source);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim) || !("result" in sim) || !sim.result) {
    throw new Error(`SAC ${method} simulation failed`);
  }
  return scValToNative(sim.result.retval) as bigint;
}

// How many whole periods (of `amount` each) the subscriber can currently cover,
// bounded by both their SAC allowance and their balance. Charging with
// insufficient funds flips the subscription to PastDue on-chain, which is
// terminal — so we compute what's affordable BEFORE submitting and never send a
// doomed charge.
async function affordablePeriods(
  adminAddress: string,
  subscriber: string,
  amount: bigint
): Promise<number> {
  if (amount <= BigInt(0)) return 0;
  const allowance = await simulateSacView(
    adminAddress,
    "allowance",
    new Address(subscriber).toScVal(),
    new Address(CONTRACT_ID).toScVal()
  );
  const balance = await simulateSacView(
    adminAddress,
    "balance",
    new Address(subscriber).toScVal()
  );
  const coverable = (allowance < balance ? allowance : balance) / amount;
  return Number(coverable);
}

export async function runChargePass(mode: ChargeMode) {
  const adminSecret = process.env.CRON_ADMIN_SECRET;
  if (!adminSecret) throw new Error("No admin secret");

  const adminKp = Keypair.fromSecret(adminSecret);
  const now = new Date();

  const subs = await db.subscription.findMany({
    where:
      mode === "retry"
        ? { status: "Active", nextRetryAt: { lte: now } }
        : { status: "Active" },
    include: { plan: true },
  });

  const results: ChargeResult[] = [];

  for (const sub of subs) {
    // The 15-minute pass leaves mid-retry-window subscriptions to the retry cron
    // so the 3-minute spacing is honored.
    if (mode === "due" && sub.nextRetryAt && sub.nextRetryAt > now) {
      results.push({ id: sub.onChainId, result: `retry pending at ${sub.nextRetryAt.toISOString()}` });
      continue;
    }

    try {
      const onChain = await getSubscription(BigInt(sub.onChainId));

      // Sync status drift
      if (onChain.status !== "Active") {
        await db.subscription.update({
          where: { onChainId: sub.onChainId },
          data: { status: onChain.status, retryCount: 0, nextRetryAt: null },
        });
        results.push({ id: sub.onChainId, result: `skipped — status ${onChain.status}` });
        continue;
      }

      const interval: Interval = {
        unit: sub.plan.intervalUnit as IntervalUnit,
        count: sub.plan.intervalCount,
      };

      // How many periods have come due since the last charge (arrears aware).
      const owed = computeCatchUp(sub.anchorAt, interval, sub.periodsCharged, now);
      if (owed.periods === 0) {
        if (sub.retryCount > 0 || sub.nextRetryAt) {
          await db.subscription.update({
            where: { onChainId: sub.onChainId },
            data: { retryCount: 0, nextRetryAt: null },
          });
        }
        results.push({ id: sub.onChainId, result: `not due (next: ${onChain.next_charge_at})` });
        continue;
      }

      // Confirm what the subscriber can cover, then charge that many (partial catch-up).
      const amount = BigInt(sub.amount);
      const affordable = await affordablePeriods(adminKp.publicKey(), sub.subscriber, amount);

      if (affordable === 0) {
        if (sub.retryCount >= MAX_RETRIES) {
          // Confirmed customer-side insufficient funds/allowance after both
          // retries — cancel platform-side. The contract's cancel() needs the
          // subscriber's signature, so this is a DB-level cancellation: the
          // cron only charges DB-Active subscriptions, so billing stops here.
          await db.subscription.update({
            where: { onChainId: sub.onChainId },
            data: { status: "Canceled", retryCount: 0, nextRetryAt: null },
          });

          const syntheticHash = `policy-cancel-${sub.onChainId}-${Date.now()}`;
          await db.event.create({
            data: {
              extId: newId("evt"),
              type: "subscription.canceled",
              txHash: syntheticHash,
              subscriptionId: sub.id,
              data: { subId: sub.onChainId, triggeredBy: "cron", reason: "insufficient_funds_after_retries" },
            },
          });

          deliverWebhook(sub.merchant, "subscription.canceled", {
            subId: sub.onChainId,
            reason: "insufficient_funds_after_retries",
          }).catch(() => {});

          results.push({ id: sub.onChainId, result: "canceled — insufficient funds after retries" });
        } else {
          const attempt = sub.retryCount + 1;
          await db.subscription.update({
            where: { onChainId: sub.onChainId },
            data: { retryCount: attempt, nextRetryAt: new Date(Date.now() + RETRY_DELAY_MS) },
          });
          results.push({ id: sub.onChainId, result: `insufficient funds — retry ${attempt}/${MAX_RETRIES} in 3 min` });
        }
        continue;
      }

      // Charge the affordable number of owed periods (capped catch-up).
      const periodsToCharge = Math.min(owed.periods, affordable);
      const settled = computeCatchUp(sub.anchorAt, interval, sub.periodsCharged, now, periodsToCharge);
      const newNextChargeAt = toUnixSeconds(settled.newNextChargeAt);

      const signedXdr = await buildAndSignCharge(
        adminKp,
        BigInt(sub.onChainId),
        periodsToCharge,
        newNextChargeAt
      );
      const txHash = await submitAndWait(signedXdr);

      // Re-read on-chain state — contract sets PastDue without panicking,
      // so the tx succeeds either way and we must check the outcome here.
      const after = await getSubscription(BigInt(sub.onChainId));
      const charged = after.status === "Active";
      const eventType = charged ? "subscription.charged" : "subscription.past_due";

      await db.subscription.update({
        where: { onChainId: sub.onChainId },
        data: {
          status: after.status,
          periodsCharged: charged ? settled.newPeriodsCharged : sub.periodsCharged,
          retryCount: 0,
          nextRetryAt: null,
        },
      });

      await db.event.upsert({
        where: { txHash },
        update: {},
        create: {
          extId: newId("evt"),
          type: eventType,
          txHash,
          subscriptionId: sub.id,
          data: { subId: sub.onChainId, triggeredBy: "cron", status: after.status, periods: periodsToCharge },
        },
      });

      deliverWebhook(sub.merchant, eventType, {
        subId: sub.onChainId,
        txHash,
        status: after.status,
        periods: periodsToCharge,
      }).catch(() => {});

      const partial = periodsToCharge < owed.periods ? ` (partial ${periodsToCharge}/${owed.periods})` : periodsToCharge > 1 ? ` (${periodsToCharge} periods)` : "";
      results.push({ id: sub.onChainId, result: `${after.status.toLowerCase()}${partial} — ${txHash}` });
    } catch (err) {
      // System-side failure (RPC, simulation, submission, timeout) — reschedule
      // but never increment retryCount: only confirmed insufficient funds may
      // lead to cancellation.
      try {
        await db.subscription.update({
          where: { onChainId: sub.onChainId },
          data: { nextRetryAt: new Date(Date.now() + RETRY_DELAY_MS) },
        });
      } catch {
        // DB unreachable too — nothing to persist; next pass picks it up
      }
      results.push({
        id: sub.onChainId,
        result: `error — ${err instanceof Error ? err.message : String(err)}; retry in 3 min`,
      });
    }
  }

  return { ran: now.toISOString(), mode, results };
}
