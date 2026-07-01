"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/lib/wallet-context";
import {
  getSubscription,
  buildChargeXdr,
  submitAndWait,
  formatUsdc,
  truncateAddress,
  type Subscription,
} from "@/lib/stellar";
import { findSubscription } from "@/lib/plans";

export default function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { address, signTransaction } = useWallet();

  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [chargeStatus, setChargeStatus] = useState<"idle" | "signing" | "submitting" | "done" | "error">("idle");
  const [chargeMsg, setChargeMsg] = useState("");
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  const stored = findSubscription(id);

  useEffect(() => {
    getSubscription(BigInt(id))
      .then(setSub)
      .catch(() => setSub(null))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleCharge() {
    if (!address || !sub) return;
    setChargeStatus("signing");
    setChargeMsg("");

    try {
      const xdr = await buildChargeXdr(address, BigInt(id));
      const signedXdr = await signTransaction(xdr);

      setChargeStatus("submitting");
      const txHash = await submitAndWait(signedXdr);

      setLastTxHash(txHash);
      setChargeStatus("done");

      // Write event + refresh on-chain state
      fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "subscription.charged", txHash, data: { subId: id } }),
      }).catch(() => {});
      getSubscription(BigInt(id)).then((s) => {
        setSub(s);
        fetch(`/api/subscriptions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: s.status }),
        }).catch(() => {});
      }).catch(() => {});
    } catch (err) {
      setChargeStatus("error");
      setChargeMsg(err instanceof Error ? err.message : "Charge failed");
    }
  }

  const chargeBusy = chargeStatus === "signing" || chargeStatus === "submitting";

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/app/billing" className="text-sm text-neutral-400 hover:text-neutral-700">
          ← Billing
        </Link>
        <span className="text-neutral-300">/</span>
        <span className="text-sm">Subscription #{id}</span>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-400">Loading…</p>
      ) : !sub ? (
        <p className="text-sm text-neutral-500">Subscription not found on-chain.</p>
      ) : (
        <>
          <div className="bg-white border border-neutral-200 rounded-lg p-5 mb-5">
            <div className="grid grid-cols-2 gap-y-3 text-sm">
              <span className="text-neutral-400">Status</span>
              <span className={`font-medium ${sub.status === "Active" ? "text-green-600" : sub.status === "PastDue" ? "text-amber-600" : "text-neutral-500"}`}>
                {sub.status}
              </span>

              <span className="text-neutral-400">Subscriber</span>
              <span className="font-mono text-xs">{truncateAddress(sub.subscriber)}</span>

              {stored && (
                <>
                  <span className="text-neutral-400">Amount</span>
                  <span>{formatUsdc(BigInt(stored.amount))} USDC</span>

                  <span className="text-neutral-400">Interval</span>
                  <span>{stored.intervalLabel}</span>
                </>
              )}

              <span className="text-neutral-400">Next charge</span>
              <span className="font-mono text-xs">ledger {sub.next_charge}</span>
            </div>
          </div>

          {chargeStatus === "done" && lastTxHash && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4">
              <p className="text-xs text-green-700 font-medium mb-1">Charge successful</p>
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${lastTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-green-600 underline break-all"
              >
                {lastTxHash}
              </a>
            </div>
          )}

          {chargeStatus === "error" && (
            <p className="text-xs text-red-500 mb-4">{chargeMsg}</p>
          )}

          <button
            onClick={handleCharge}
            disabled={chargeBusy || sub.status === "Canceled"}
            className="w-full py-2.5 rounded-lg bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {chargeStatus === "signing" && "Waiting for signature…"}
            {chargeStatus === "submitting" && "Submitting charge…"}
            {(chargeStatus === "idle" || chargeStatus === "done" || chargeStatus === "error") && "Run charge"}
          </button>

          <p className="mt-2 text-xs text-center text-neutral-400">
            Subscriber does not need to sign — only you (merchant) sign.
          </p>
        </>
      )}
    </div>
  );
}
