"use client";

import { useState } from "react";
import {
  TransactionBuilder,
  Asset,
  Operation,
  BASE_FEE,
  Networks,
  rpc,
} from "@stellar/stellar-sdk";
import { isConnected, requestAccess, signTransaction } from "@stellar/freighter-api";

const RPC_URL = "https://soroban-testnet.stellar.org";
const HORIZON_URL = "https://horizon-testnet.stellar.org";

// The correct USDC issuer for this project — trustlines to THIS issuer are kept.
const CORRECT_ISSUER = "GAUK4F5RUHGD2SSEBS4EVB7FJSFWU65ITJBV5PYPQNVNTYB2BWCFICEY";

type Status = "idle" | "checking" | "signing" | "submitting" | "done" | "clean" | "error";

const LABEL: Record<Status, string> = {
  idle:       "Connect & clean wallet",
  checking:   "Checking wallet…",
  signing:    "Sign in Freighter…",
  submitting: "Submitting…",
  done:       "Cleaned ✓",
  clean:      "Already clean ✓",
  error:      "Try again",
};

type HorizonBalance = {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance?: string;
};

export default function CleanupPage() {
  const [status, setStatus]   = useState<Status>("idle");
  const [removed, setRemoved] = useState<string[]>([]);
  const [error, setError]     = useState("");

  async function handleCleanup() {
    setStatus("checking");
    setError("");
    setRemoved([]);

    try {
      const conn = await isConnected();
      if ("error" in conn || !conn.isConnected) throw new Error("Freighter not installed");
      const access = await requestAccess();
      if ("error" in access) throw new Error(access.error);
      const address = access.address;

      const res = await fetch(`${HORIZON_URL}/accounts/${address}`);
      if (!res.ok) throw new Error("Could not load account from Horizon");
      const { balances } = await res.json() as { balances: HorizonBalance[] };

      // Any USDC trustline from the wrong issuer (not our GAUK4F5... project USDC).
      // 0-balance: just remove the trustline.
      // Non-zero balance: burn back to issuer (payment → issuer) then remove trustline.
      const stale = balances.filter(
        b => b.asset_code === "USDC" && b.asset_issuer !== CORRECT_ISSUER
      );

      if (stale.length === 0) { setStatus("clean"); return; }

      setStatus("signing");
      const server = new rpc.Server(RPC_URL, { allowHttp: false });
      const account = await server.getAccount(address);

      const builder = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      });

      for (const b of stale) {
        const asset = new Asset("USDC", b.asset_issuer!);
        const bal = parseFloat(b.balance ?? "0");
        if (bal > 0) {
          // Send balance back to issuer so the trustline can be removed.
          builder.addOperation(
            Operation.payment({ destination: b.asset_issuer!, asset, amount: bal.toFixed(7) })
          );
        }
        builder.addOperation(
          Operation.changeTrust({ asset, limit: "0" })
        );
      }

      const tx = builder.setTimeout(30).build();

      const signed = await signTransaction(tx.toXDR(), {
        networkPassphrase: Networks.TESTNET,
        address,
      });
      if ("error" in signed) throw new Error(signed.error);

      setStatus("submitting");
      const signedTx = TransactionBuilder.fromXDR(signed.signedTxXdr, Networks.TESTNET);
      const send = await server.sendTransaction(signedTx);
      if (send.status === "ERROR") throw new Error("Submission failed");

      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const result = await server.getTransaction(send.hash);
        if (result.status === "SUCCESS") {
          setRemoved(stale.map(b => `USDC:${b.asset_issuer!.slice(0, 8)}… (${b.balance})`));
          setStatus("done");
          return;
        }
        if (result.status === "FAILED") throw new Error("Transaction failed on-chain");
      }
      throw new Error("Timeout waiting for confirmation");
    } catch (e) {
      setError(String(e));
      setStatus("error");
    }
  }

  const busy     = status === "checking" || status === "signing" || status === "submitting";
  const finished = status === "done" || status === "clean";

  return (
    <div style={{ padding: 40, fontFamily: "sans-serif", maxWidth: 520 }}>
      <h2 style={{ margin: "0 0 8px" }}>Clean wrong-issuer USDC</h2>
      <p style={{ color: "#666", fontSize: 14, margin: "0 0 4px", lineHeight: 1.6 }}>
        Removes all USDC trustlines <em>not</em> from the project issuer (<code>GAUK4F5…</code>).
      </p>
      <p style={{ color: "#666", fontSize: 14, margin: "0 0 24px", lineHeight: 1.6 }}>
        If the trustline has a balance, the tokens are sent back to the issuer first (testnet burn).
        Trustlines to <code>GAUK4F5…</code> are left untouched.
      </p>
      <button
        onClick={!busy && !finished ? handleCleanup : undefined}
        disabled={busy || finished}
        style={{
          padding: "10px 24px",
          background: finished ? "#059669" : "#1c1917",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          cursor: busy || finished ? "default" : "pointer",
          fontSize: 14,
          opacity: busy ? 0.7 : 1,
        }}
      >
        {LABEL[status]}
      </button>
      {status === "done" && removed.length > 0 && (
        <p style={{ color: "#059669", fontSize: 13, marginTop: 12 }}>
          Removed: {removed.join(", ")}
        </p>
      )}
      {error && <p style={{ color: "#dc2626", fontSize: 13, marginTop: 12 }}>{error}</p>}
    </div>
  );
}
