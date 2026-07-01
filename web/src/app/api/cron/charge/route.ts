import { NextRequest, NextResponse } from "next/server";
import {
  Keypair,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  Address,
  nativeToScVal,
  Contract,
} from "@stellar/stellar-sdk";
import * as rpc from "@stellar/stellar-sdk/rpc";
import { db } from "@/lib/db";
import { getSubscription } from "@/lib/stellar";
import { deliverWebhook } from "@/lib/webhooks";

const RPC_URL = "https://soroban-testnet.stellar.org";
const CONTRACT_ID = process.env.NEXT_PUBLIC_STELLARPAY_CONTRACT_ID!;
const NETWORK_PASSPHRASE = Networks.TESTNET;

const server = new rpc.Server(RPC_URL, { allowHttp: false });

async function buildAndSignCharge(adminKp: Keypair, subId: bigint): Promise<string> {
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
        nativeToScVal(subId, { type: "u64" })
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

export async function GET(req: NextRequest) {
  // Verify Vercel cron secret
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminSecret = process.env.CRON_ADMIN_SECRET;
  if (!adminSecret) return NextResponse.json({ error: "No admin secret" }, { status: 500 });

  const adminKp = Keypair.fromSecret(adminSecret);
  const { sequence: currentLedger } = await server.getLatestLedger();

  // Fetch all active subscriptions from DB
  const subs = await db.subscription.findMany({ where: { status: "Active" } });

  const results: { id: string; result: string }[] = [];

  for (const sub of subs) {
    try {
      const onChain = await getSubscription(BigInt(sub.onChainId));

      // Sync status drift
      if (onChain.status !== "Active") {
        await db.subscription.update({
          where: { onChainId: sub.onChainId },
          data: { status: onChain.status },
        });
        results.push({ id: sub.onChainId, result: `skipped — status ${onChain.status}` });
        continue;
      }

      if (currentLedger < onChain.next_charge) {
        results.push({ id: sub.onChainId, result: `not due (next: ${onChain.next_charge}, now: ${currentLedger})` });
        continue;
      }

      // Charge is due
      const signedXdr = await buildAndSignCharge(adminKp, BigInt(sub.onChainId));
      const txHash = await submitAndWait(signedXdr);

      // Re-read on-chain state — contract sets PastDue without panicking,
      // so the tx succeeds either way and we must check the outcome here.
      const after = await getSubscription(BigInt(sub.onChainId));
      const eventType = after.status === "PastDue" ? "subscription.past_due" : "subscription.charged";

      await db.subscription.update({
        where: { onChainId: sub.onChainId },
        data: { status: after.status },
      });

      await db.event.upsert({
        where: { txHash },
        update: {},
        create: {
          type: eventType,
          txHash,
          subscriptionId: sub.id,
          data: { subId: sub.onChainId, triggeredBy: "cron", status: after.status },
        },
      });

      deliverWebhook(sub.merchant, eventType, { subId: sub.onChainId, txHash, status: after.status }).catch(() => {});

      results.push({ id: sub.onChainId, result: `${after.status.toLowerCase()} — ${txHash}` });
    } catch (err) {
      results.push({ id: sub.onChainId, result: `error — ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  return NextResponse.json({ ran: new Date().toISOString(), currentLedger, results });
}
