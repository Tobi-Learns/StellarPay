"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/lib/wallet-context";
import {
  getSubscription,
  buildCancelXdr,
  submitAndWait,
  formatUsdc,
  truncateAddress,
  type Subscription,
} from "@/lib/stellar";
import { findSubscription } from "@/lib/plans";

export default function ManageSubscriptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { address, signTransaction } = useWallet();

  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelStatus, setCancelStatus] = useState<"idle" | "signing" | "submitting" | "done" | "error">("idle");
  const [cancelMsg, setCancelMsg] = useState("");

  const stored = findSubscription(id);

  useEffect(() => {
    getSubscription(BigInt(id))
      .then(setSub)
      .catch(() => setSub(null))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleCancel() {
    if (!address || !sub) return;
    setCancelStatus("signing");
    setCancelMsg("");

    try {
      const xdr = await buildCancelXdr(address, BigInt(id));
      const signedXdr = await signTransaction(xdr);

      setCancelStatus("submitting");
      await submitAndWait(signedXdr);

      setCancelStatus("done");
      getSubscription(BigInt(id)).then(setSub).catch(() => {});

      // Write-through: mark canceled in DB
      const txHash = signedXdr.slice(0, 64); // use first 64 chars as a stable key
      fetch(`/api/subscriptions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Canceled" }),
      }).catch(() => {});
      fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "subscription.canceled", txHash, data: { subId: id } }),
      }).catch(() => {});
    } catch (err) {
      setCancelStatus("error");
      setCancelMsg(err instanceof Error ? err.message : "Cancel failed");
    }
  }

  const busy = cancelStatus === "signing" || cancelStatus === "submitting";
  const alreadyCanceled = sub?.status === "Canceled" || cancelStatus === "done";

  return (
    <div className="max-w-lg mx-auto px-6 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/portal" className="text-sm text-neutral-400 hover:text-neutral-700">
          ← My subscriptions
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

              <span className="text-neutral-400">Merchant</span>
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

          {cancelStatus === "done" && (
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-3 mb-4">
              <p className="text-sm font-medium">Subscription canceled.</p>
              <p className="text-xs text-neutral-400 mt-1">No further charges will be pulled.</p>
            </div>
          )}

          {cancelStatus === "error" && (
            <p className="text-xs text-red-500 mb-4">{cancelMsg}</p>
          )}

          {!alreadyCanceled && (
            <button
              onClick={handleCancel}
              disabled={busy}
              className="w-full py-2.5 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {cancelStatus === "signing" && "Waiting for signature…"}
              {cancelStatus === "submitting" && "Canceling…"}
              {(cancelStatus === "idle" || cancelStatus === "error") && "Cancel subscription"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
