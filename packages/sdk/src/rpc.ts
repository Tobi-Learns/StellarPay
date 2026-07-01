import {
  Contract,
  TransactionBuilder,
  Asset,
  Operation,
  BASE_FEE,
  scValToNative,
  rpc,
} from "@stellar/stellar-sdk";
import type { StellarPayConfig } from "./types";

export function makeServer(config: StellarPayConfig): rpc.Server {
  return new rpc.Server(config.rpcUrl, { allowHttp: false });
}

export async function buildTxXdr(
  config: StellarPayConfig,
  sourceAddress: string,
  operation: ReturnType<Contract["call"]>
): Promise<string> {
  const server = makeServer(config);
  const account = await server.getAccount(sourceAddress);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`Simulation failed: ${sim.error}`);

  // Pad write-byte budget 2× — simulation can underestimate when try_invoke paths diverge
  // from the actual execution path (e.g. PastDue vs Active in _charge).
  if ("transactionData" in sim) {
    const r = sim.transactionData.build().resources();
    sim.transactionData.setResources(r.instructions(), r.diskReadBytes(), r.writeBytes() * 2);
  }

  return rpc.assembleTransaction(tx, sim).build().toXDR();
}

export async function submitAndWait(
  config: StellarPayConfig,
  signedXdr: string
): Promise<string> {
  const server = makeServer(config);
  const tx = TransactionBuilder.fromXDR(signedXdr, config.networkPassphrase);
  const send = await server.sendTransaction(tx);
  if (send.status === "ERROR") throw new Error("Transaction submission failed");

  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const result = await server.getTransaction(send.hash);
    if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) return send.hash;
    if (result.status === rpc.Api.GetTransactionStatus.FAILED)
      throw new Error(`Transaction failed on-chain (hash: ${send.hash})`);
  }
  throw new Error("Transaction confirmation timeout");
}

export async function submitAndWaitWithResult(
  config: StellarPayConfig,
  signedXdr: string
): Promise<{ hash: string; returnValue: unknown }> {
  const server = makeServer(config);
  const tx = TransactionBuilder.fromXDR(signedXdr, config.networkPassphrase);
  const send = await server.sendTransaction(tx);
  if (send.status === "ERROR") throw new Error("Transaction submission failed");

  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const result = await server.getTransaction(send.hash);
    if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return {
        hash: send.hash,
        returnValue: result.returnValue ? scValToNative(result.returnValue) : null,
      };
    }
    if (result.status === rpc.Api.GetTransactionStatus.FAILED)
      throw new Error(`Transaction failed on-chain (hash: ${send.hash})`);
  }
  throw new Error("Transaction confirmation timeout");
}

/** Simulation-only read — uses a dummy account so no funding is required. */
export async function simulateRead(
  config: StellarPayConfig,
  operation: ReturnType<Contract["call"]>
): Promise<rpc.Api.SimulateTransactionSuccessResponse> {
  const server = makeServer(config);
  const dummyAccount = {
    accountId: () => config.contractId,
    sequenceNumber: () => "0",
    incrementSequenceNumber: () => {},
  } as never;

  const tx = new TransactionBuilder(dummyAccount, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim) || !("result" in sim) || !sim.result) {
    throw new Error("Simulation read failed");
  }
  return sim as rpc.Api.SimulateTransactionSuccessResponse;
}

/**
 * Checks Horizon for a trustline to config.classicAsset on `address`.
 * Returns a CHANGE_TRUST XDR if the trustline is missing, or null if it exists
 * (or if the config doesn't include classicAsset / horizonUrl).
 */
export async function buildTrustlineTxXdr(
  config: StellarPayConfig,
  address: string,
): Promise<string | null> {
  const { classicAsset, horizonUrl } = config;
  if (!classicAsset || !horizonUrl) return null;

  const res = await fetch(`${horizonUrl}/accounts/${address}`);
  if (!res.ok) return null;

  const { balances } = await res.json() as {
    balances: Array<{ asset_type: string; asset_code?: string; asset_issuer?: string }>;
  };
  const hasTrustline = balances.some(
    b => b.asset_code === classicAsset.code && b.asset_issuer === classicAsset.issuer
  );
  if (hasTrustline) return null;

  const server = makeServer(config);
  const account = await server.getAccount(address);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(Operation.changeTrust({ asset: new Asset(classicAsset.code, classicAsset.issuer) }))
    .setTimeout(30)
    .build();

  return tx.toXDR();
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
