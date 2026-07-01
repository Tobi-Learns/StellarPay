"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useWallet } from "@/lib/wallet-context";
import { formatUsdc } from "@/lib/stellar";
import { loadSubscriptions, type StoredSubscription } from "@/lib/plans";
import { SkeletonRow } from "@/components/skeleton";

export default function PortalPage() {
  const { address } = useWallet();
  const router = useRouter();
  const [subs, setSubs] = useState<StoredSubscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) { router.replace("/connect"); return; }

    fetch(`/api/subscriptions?subscriber=${encodeURIComponent(address)}`)
      .then((r) => r.json())
      .then((rows) => {
        if (Array.isArray(rows) && rows.length > 0) {
          setSubs(rows.map((s: { onChainId: string; planOnChainId: string; subscriber: string; merchant: string; amount: string; interval: number; intervalLabel: string; createdAt: string }) => ({
            ...s, planId: s.planOnChainId, createdAt: new Date(s.createdAt).getTime(),
          })));
        } else {
          setSubs(loadSubscriptions().filter((s) => s.subscriber === address));
        }
      })
      .catch(() => {
        setSubs(loadSubscriptions().filter((s) => s.subscriber === address));
      })
      .finally(() => setLoading(false));
  }, [address, router]);

  if (!address) return null;

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="text-xl font-semibold mb-6">My subscriptions</h1>

      {loading ? (
        <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg bg-white">
          {[...Array(3)].map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : subs.length === 0 ? (
        <p className="text-sm text-neutral-400">No active subscriptions.</p>
      ) : (
        <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg bg-white">
          {subs.map((sub) => (
            <div key={sub.onChainId} className="flex items-center gap-4 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {formatUsdc(BigInt(sub.amount))} USDC · {sub.intervalLabel.split(" ")[0].toLowerCase()}
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Sub #{sub.onChainId} · Plan #{sub.planId} · {new Date(sub.createdAt).toLocaleDateString()}
                </p>
              </div>
              <Link
                href={`/portal/${sub.onChainId}`}
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
