"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet } from "@/lib/wallet-context";
import { formatUsdc, truncateAddress } from "@/lib/stellar";
import { loadPlans, loadSubscriptions, type StoredPlan, type StoredSubscription } from "@/lib/plans";
import { SkeletonRow } from "@/components/skeleton";

export default function BillingPage() {
  const { address } = useWallet();
  const [plans, setPlans] = useState<StoredPlan[]>([]);
  const [subs, setSubs] = useState<StoredSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;

    const enc = encodeURIComponent(address);

    Promise.all([
      fetch(`/api/plans?merchant=${enc}`).then((r) => r.json()).catch(() => null),
      fetch(`/api/subscriptions?merchant=${enc}`).then((r) => r.json()).catch(() => null),
    ]).then(([apiPlans, apiSubs]) => {
      setPlans(
        Array.isArray(apiPlans) && apiPlans.length > 0
          ? apiPlans.map((p: { onChainId: string; merchant: string; amount: string; interval: number; intervalLabel: string; createdAt: string }) => ({ ...p, createdAt: new Date(p.createdAt).getTime() }))
          : loadPlans().filter((p) => p.merchant === address)
      );
      setSubs(
        Array.isArray(apiSubs) && apiSubs.length > 0
          ? apiSubs.map((s: { onChainId: string; planOnChainId: string; subscriber: string; merchant: string; amount: string; interval: number; intervalLabel: string; createdAt: string }) => ({ ...s, planId: s.planOnChainId, createdAt: new Date(s.createdAt).getTime() }))
          : loadSubscriptions().filter((s) => s.merchant === address)
      );
    }).finally(() => setLoading(false));
  }, [address]);

  function copySubscribeUrl(planId: string) {
    const url = `${window.location.origin}/subscribe/${planId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(planId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Billing</h1>
        <Link
          href="/app/billing/plans/new"
          className="text-sm bg-neutral-900 text-white px-4 py-2 rounded-lg hover:bg-neutral-700 transition-colors"
        >
          New plan
        </Link>
      </div>

      {/* Plans */}
      <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wide mb-3">Plans</h2>
      {loading ? (
        <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg bg-white mb-8">
          {[...Array(2)].map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-10 text-sm text-neutral-400 border border-dashed border-neutral-200 rounded-lg mb-8">
          No plans yet.{" "}
          <Link href="/app/billing/plans/new" className="underline">
            Create one.
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg bg-white mb-8">
          {plans.map((plan) => (
            <div key={plan.onChainId} className="flex items-center gap-4 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {formatUsdc(BigInt(plan.amount))} USDC / {plan.intervalLabel.split(" ")[0].toLowerCase()}
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Plan #{plan.onChainId} · {new Date(plan.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => copySubscribeUrl(plan.onChainId)}
                className="shrink-0 text-xs px-3 py-1.5 rounded border border-neutral-200 hover:bg-neutral-50 transition-colors"
              >
                {copiedId === plan.onChainId ? "Copied!" : "Copy subscribe link"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Subscriptions */}
      <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wide mb-3">Subscriptions</h2>
      {loading ? (
        <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg bg-white">
          {[...Array(2)].map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : subs.length === 0 ? (
        <p className="text-sm text-neutral-400">No active subscriptions yet.</p>
      ) : (
        <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg bg-white">
          {subs.map((sub) => (
            <div key={sub.onChainId} className="flex items-center gap-4 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {(sub as unknown as { payerName?: string }).payerName ?? truncateAddress(sub.subscriber)}
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {(sub as unknown as { payerEmail?: string }).payerEmail && (
                    <span>{(sub as unknown as { payerEmail?: string }).payerEmail} · </span>
                  )}
                  {formatUsdc(BigInt(sub.amount))} USDC · Plan #{sub.planId} · {new Date(sub.createdAt).toLocaleDateString()}
                </p>
              </div>
              <Link
                href={`/app/billing/subscriptions/${sub.onChainId}`}
                className="shrink-0 text-xs px-3 py-1.5 rounded border border-neutral-200 hover:bg-neutral-50 transition-colors"
              >
                Manage
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
