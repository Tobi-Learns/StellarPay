"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { formatUsdc, truncateAddress } from "@/lib/stellar";

type SubscriptionRecord = {
  extId?: string;
  onChainId: string;
  planOnChainId: string;
  plan?: {
    extId?: string;
    productName?: string;
    description?: string | null;
    intervalLabel?: string;
    intervalUnit?: string;
    intervalCount?: number;
  };
  subscriber: string;
  merchant: string;
  amount: string;
  payerName?: string | null;
  payerEmail?: string | null;
  status: "Active" | "PastDue" | "Canceled";
  retryCount: number;
  nextRetryAt?: string | null;
  anchorAt: string;
  periodsCharged: number;
  createdAt: string;
  updatedAt: string;
  nextChargeAt?: number;
  estimatedNextChargeAt?: string;
  nextChargeOverdue?: boolean;
  events?: Array<{
    extId?: string;
    type: string;
    txHash: string;
    data?: Record<string, unknown>;
    createdAt: string;
  }>;
};

function formatDateTime(value?: string | number | null) {
  if (!value) return "Unavailable";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatNextCharge(sub: SubscriptionRecord): string {
  const iso = sub.estimatedNextChargeAt ?? (sub.nextChargeAt ? new Date(sub.nextChargeAt * 1000).toISOString() : undefined);
  if (!iso) return "Unavailable";
  const date = new Date(iso);
  const overdue = sub.nextChargeOverdue ?? (sub.nextChargeAt ? sub.nextChargeAt * 1000 < Date.now() : false);
  return `${formatDateTime(date.toISOString())}${overdue ? " (overdue)" : ""}`;
}

function statusPill(status: string) {
  const classes = status === "Active"
    ? "bg-green-50 text-green-700"
    : status === "PastDue"
      ? "bg-amber-50 text-amber-700"
      : "bg-neutral-100 text-neutral-600";
  return <span className={`rounded-full px-2 py-1 text-xs font-medium ${classes}`}>{status}</span>;
}

export default function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [sub, setSub] = useState<SubscriptionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const explorerUrl = `https://stellar.expert/explorer/testnet/contract/${process.env.NEXT_PUBLIC_STELLARPAY_CONTRACT_ID ?? ""}`;

  useEffect(() => {
    let active = true;
    fetch(`/api/subscriptions/${encodeURIComponent(id)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((row: SubscriptionRecord | null) => {
        if (active) setSub(row);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [id]);

  function copy(label: string, value: string) {
    navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/app/billing" className="text-sm text-neutral-400 hover:text-neutral-700">
          &larr; Billing
        </Link>
        <span className="text-neutral-300">/</span>
        <span className="text-sm font-mono">{sub?.extId ?? `Subscription #${id}`}</span>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-400">Loading subscription...</p>
      ) : !sub ? (
        <p className="text-sm text-neutral-500">Subscription not found.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-semibold">{sub.payerName || truncateAddress(sub.subscriber)}</h1>
              <p className="text-sm text-neutral-500 mt-1">
                {sub.plan?.productName ?? "Subscription plan"} · {formatUsdc(BigInt(sub.amount))} USDC · Purchased {formatDateTime(sub.createdAt)}
              </p>
            </div>
            {statusPill(sub.status)}
          </div>

          <div className="grid gap-4 lg:grid-cols-4 mb-6">
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Next charge</p>
              <p className="text-sm font-medium">{formatNextCharge(sub)}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Periods charged</p>
              <p className="text-sm font-medium">{sub.periodsCharged}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Retry count</p>
              <p className="text-sm font-medium">{sub.retryCount}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Next retry</p>
              <p className="text-sm font-medium">{formatDateTime(sub.nextRetryAt)}</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="space-y-6">
              <div className="rounded-lg border border-neutral-200 bg-white p-5">
                <h2 className="text-sm font-medium text-neutral-900 mb-4">Details</h2>
                <dl className="grid gap-3 text-sm sm:grid-cols-[180px_minmax(0,1fr)]">
                  <dt className="text-neutral-400">Name</dt>
                  <dd>{sub.payerName || "Not provided"}</dd>
                  <dt className="text-neutral-400">Email</dt>
                  <dd>{sub.payerEmail || "Not provided"}</dd>
                  <dt className="text-neutral-400">Product or service</dt>
                  <dd>{sub.plan?.productName ?? "Subscription plan"}</dd>
                  <dt className="text-neutral-400">Description</dt>
                  <dd>{sub.plan?.description || "No description"}</dd>
                  <dt className="text-neutral-400">Amount per cycle</dt>
                  <dd>{formatUsdc(BigInt(sub.amount))} USDC</dd>
                  <dt className="text-neutral-400">Billing interval</dt>
                  <dd>{sub.plan?.intervalLabel ?? "Unavailable"}</dd>
                  <dt className="text-neutral-400">Purchased</dt>
                  <dd>{formatDateTime(sub.createdAt)}</dd>
                  <dt className="text-neutral-400">Anchor/start date</dt>
                  <dd>{formatDateTime(sub.anchorAt)}</dd>
                  <dt className="text-neutral-400">Last updated</dt>
                  <dd>{formatDateTime(sub.updatedAt)}</dd>
                  <dt className="text-neutral-400">Subscriber wallet</dt>
                  <dd className="font-mono text-xs break-all">{sub.subscriber}</dd>
                  <dt className="text-neutral-400">Merchant wallet</dt>
                  <dd className="font-mono text-xs break-all">{sub.merchant}</dd>
                </dl>
              </div>

              <div className="rounded-lg border border-neutral-200 bg-white p-5">
                <h2 className="text-sm font-medium text-neutral-900 mb-4">Charge history and related events</h2>
                {!sub.events || sub.events.length === 0 ? (
                  <p className="text-sm text-neutral-400">No related events recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] text-sm">
                      <thead className="text-xs uppercase tracking-wide text-neutral-500">
                        <tr>
                          <th className="text-left font-medium py-2">Event</th>
                          <th className="text-left font-medium py-2">Date</th>
                          <th className="text-left font-medium py-2">ID</th>
                          <th className="text-right font-medium py-2">Tx</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {sub.events.map((event) => (
                          <tr key={event.txHash}>
                            <td className="py-3">{event.type}</td>
                            <td className="py-3 text-neutral-600">{formatDateTime(event.createdAt)}</td>
                            <td className="py-3 font-mono text-xs text-neutral-500">{event.extId ?? "evt_pending"}</td>
                            <td className="py-3 text-right">
                              <a
                                href={`https://stellar.expert/explorer/testnet/tx/${event.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs px-3 py-1.5 rounded border border-neutral-200 hover:bg-neutral-50 transition-colors"
                              >
                                View
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>

            <aside className="rounded-lg border border-neutral-200 bg-white p-5 h-fit">
              <h2 className="text-sm font-medium text-neutral-900 mb-4">Integration</h2>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-xs text-neutral-400 mb-1">Subscription ID</p>
                  <p className="font-mono text-xs break-all mb-2">{sub.extId}</p>
                  <button
                    onClick={() => copy("subExtId", sub.extId ?? sub.onChainId)}
                    className="text-xs px-3 py-1.5 rounded border border-neutral-200 hover:bg-neutral-50 transition-colors"
                  >
                    {copied === "subExtId" ? "Copied!" : "Copy subscription ID"}
                  </button>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 mb-1">On-chain subscription ID</p>
                  <p className="font-mono text-xs break-all mb-2">{sub.onChainId}</p>
                  <button
                    onClick={() => copy("subOnChain", sub.onChainId)}
                    className="text-xs px-3 py-1.5 rounded border border-neutral-200 hover:bg-neutral-50 transition-colors"
                  >
                    {copied === "subOnChain" ? "Copied!" : "Copy on-chain ID"}
                  </button>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 mb-1">Plan</p>
                  <p className="font-mono text-xs break-all mb-2">{sub.plan?.extId ?? sub.planOnChainId}</p>
                  <Link
                    href={`/app/billing/plans/${sub.planOnChainId}`}
                    className="inline-block text-xs px-3 py-1.5 rounded border border-neutral-200 hover:bg-neutral-50 transition-colors"
                  >
                    Manage plan
                  </Link>
                </div>
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center text-xs px-3 py-2 rounded border border-neutral-200 hover:bg-neutral-50 transition-colors"
                >
                  View contract onchain
                </a>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
