"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  getSubscription,
  formatUsdc,
  truncateAddress,
  type Subscription,
} from "@/lib/stellar";
import { findSubscription } from "@/lib/plans";

type SubscriptionRecord = {
  onChainId: string;
  planOnChainId: string;
  subscriber: string;
  amount: string;
  status: Subscription["status"];
  nextCharge?: number;
  createdLedger?: number;
  estimatedNextChargeAt?: string;
  nextChargeOverdue?: boolean;
};

type SubscriptionView = Subscription & {
  amount?: string;
  estimatedNextChargeAt?: string;
  nextChargeOverdue?: boolean;
};

async function loadSubscription(id: string): Promise<SubscriptionView> {
  const res = await fetch(`/api/subscriptions/${id}`);
  if (res.ok) {
    const record = (await res.json()) as SubscriptionRecord;
    return {
      id: BigInt(record.onChainId),
      plan_id: BigInt(record.planOnChainId),
      subscriber: record.subscriber,
      status: record.status,
      amount: record.amount,
      next_charge: record.nextCharge ?? 0,
      created_at: record.createdLedger ?? 0,
      estimatedNextChargeAt: record.estimatedNextChargeAt,
      nextChargeOverdue: record.nextChargeOverdue,
    };
  }

  return getSubscription(BigInt(id));
}

function formatNextCharge(sub: SubscriptionView): string {
  if (sub.estimatedNextChargeAt) {
    const date = new Date(sub.estimatedNextChargeAt);
    const formatted = new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
    const suffix = sub.nextChargeOverdue
      ? `${formatUtcOffset(date)}, overdue`
      : formatUtcOffset(date);
    return `${formatted} (${suffix})`;
  }
  return sub.next_charge > 0 ? `Ledger ${sub.next_charge}` : "Unavailable";
}

function formatUtcOffset(date: Date): string {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;
  return minutes === 0
    ? `UTC${sign}${hours}`
    : `UTC${sign}${hours}:${minutes.toString().padStart(2, "0")}`;
}

export default function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [sub, setSub] = useState<SubscriptionView | null>(null);
  const [loading, setLoading] = useState(true);

  const stored = findSubscription(id);

  useEffect(() => {
    loadSubscription(id)
      .then(setSub)
      .catch(() => setSub(null))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/app/billing" className="text-sm text-neutral-400 hover:text-neutral-700">
          &larr; Billing
        </Link>
        <span className="text-neutral-300">/</span>
        <span className="text-sm">Subscription #{id}</span>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-400">Loading...</p>
      ) : !sub ? (
        <p className="text-sm text-neutral-500">Subscription not found.</p>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-lg p-5 mb-5">
          <div className="grid grid-cols-2 gap-y-3 text-sm">
            <span className="text-neutral-400">Status</span>
            <span className={`font-medium ${sub.status === "Active" ? "text-green-600" : sub.status === "PastDue" ? "text-amber-600" : "text-neutral-500"}`}>
              {sub.status}
            </span>

            <span className="text-neutral-400">Subscriber</span>
            <span className="font-mono text-xs">{truncateAddress(sub.subscriber)}</span>

            {(stored || sub.amount) && (
              <>
                <span className="text-neutral-400">Amount</span>
                <span>{formatUsdc(BigInt(stored?.amount ?? sub.amount ?? "0"))} USDC</span>

                {stored && (
                  <>
                    <span className="text-neutral-400">Interval</span>
                    <span>{stored.intervalLabel}</span>
                  </>
                )}
              </>
            )}

            <span className="text-neutral-400">Next charge</span>
            <span className="font-mono text-xs">{formatNextCharge(sub)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
