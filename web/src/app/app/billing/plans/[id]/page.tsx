"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatUsdc, truncateAddress } from "@/lib/stellar";

type PlanDetail = {
  extId: string;
  onChainId: string;
  merchant: string;
  amount: string;
  productName: string;
  description?: string | null;
  interval: number;
  intervalLabel: string;
  intervalUnit: string;
  intervalCount: number;
  archivedAt?: string | null;
  createdAt: string;
  subscriptions: Array<{
    extId: string;
    onChainId: string;
    payerName?: string | null;
    payerEmail?: string | null;
    subscriber: string;
    amount: string;
    status: string;
    createdAt: string;
  }>;
};

function formatDateTime(value: string | number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusPill(status: string) {
  const classes = status === "Active"
    ? "bg-green-50 text-green-700"
    : status === "PastDue"
      ? "bg-amber-50 text-amber-700"
      : "bg-neutral-100 text-neutral-600";
  return <span className={`rounded-full px-2 py-1 text-xs font-medium ${classes}`}>{status}</span>;
}

export default function PlanManagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const subscribeUrl = typeof window === "undefined" ? "" : `${window.location.origin}/subscribe/${id}`;
  const explorerUrl = `https://stellar.expert/explorer/testnet/contract/${process.env.NEXT_PUBLIC_STELLARPAY_CONTRACT_ID ?? ""}`;

  useEffect(() => {
    let active = true;
    fetch(`/api/plans/${encodeURIComponent(id)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((row: PlanDetail | null) => {
        if (!active) return;
        setPlan(row);
        setProductName(row?.productName ?? "");
        setDescription(row?.description ?? "");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [id]);

  const activeSubscriptions = useMemo(() => {
    return plan?.subscriptions.filter((sub) => sub.status === "Active").length ?? 0;
  }, [plan?.subscriptions]);

  function copy(label: string, value: string) {
    navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  async function saveEdits() {
    if (!plan) return;
    setSaving(true);
    const res = await fetch(`/api/plans/${encodeURIComponent(plan.onChainId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productName, description }),
    }).catch(() => null);

    if (res?.ok) {
      const updated = await res.json();
      setPlan((current) => current ? { ...current, ...updated, subscriptions: current.subscriptions } : current);
      setEditing(false);
    }
    setSaving(false);
  }

  async function toggleArchive() {
    if (!plan) return;
    setSaving(true);
    const archived = !plan.archivedAt;
    const res = await fetch(`/api/plans/${encodeURIComponent(plan.onChainId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    }).catch(() => null);

    if (res?.ok) {
      const updated = await res.json();
      setPlan((current) => current ? { ...current, ...updated, subscriptions: current.subscriptions } : current);
    }
    setSaving(false);
  }

  return (
    <div className="max-w-6xl">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/app/billing" className="text-sm text-neutral-400 hover:text-neutral-700">
          &larr; Billing
        </Link>
        <span className="text-neutral-300">/</span>
        <span className="text-sm font-mono">{plan?.extId ?? id}</span>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-400">Loading plan...</p>
      ) : !plan ? (
        <p className="text-sm text-neutral-500">Plan not found.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-semibold">{plan.productName}</h1>
              <p className="text-sm text-neutral-500 mt-1">
                {formatUsdc(BigInt(plan.amount))} USDC · {plan.intervalLabel} · Created {formatDateTime(plan.createdAt)}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditing((value) => !value)}
                className="text-sm px-4 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors"
              >
                {editing ? "Cancel edit" : "Edit"}
              </button>
              <button
                onClick={toggleArchive}
                disabled={saving}
                className="text-sm px-4 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-50 transition-colors"
              >
                {plan.archivedAt ? "Restore plan" : "Archive plan"}
              </button>
            </div>
          </div>

          {editing && (
            <div className="rounded-lg border border-neutral-200 bg-white p-5 mb-6">
              <h2 className="text-sm font-medium text-neutral-900 mb-4">Edit plan details</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Product or service name</label>
                  <input
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    maxLength={80}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={240}
                    rows={3}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
                  />
                </div>
                <button
                  onClick={saveEdits}
                  disabled={saving || !productName.trim()}
                  className="text-sm px-4 py-2 rounded-lg bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-50 transition-colors"
                >
                  Save changes
                </button>
              </div>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-3 mb-6">
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Status</p>
              <p className="text-sm font-medium">{plan.archivedAt ? "Archived" : "Active"}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Active subscriptions</p>
              <p className="text-sm font-medium">{activeSubscriptions}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Total subscriptions</p>
              <p className="text-sm font-medium">{plan.subscriptions.length}</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="space-y-6">
              <div className="rounded-lg border border-neutral-200 bg-white p-5">
                <h2 className="text-sm font-medium text-neutral-900 mb-4">Details</h2>
                <dl className="grid gap-3 text-sm sm:grid-cols-[180px_minmax(0,1fr)]">
                  <dt className="text-neutral-400">Product or service</dt>
                  <dd>{plan.productName}</dd>
                  <dt className="text-neutral-400">Amount per cycle</dt>
                  <dd>{formatUsdc(BigInt(plan.amount))} USDC</dd>
                  <dt className="text-neutral-400">Billing interval</dt>
                  <dd>{plan.intervalLabel}</dd>
                  <dt className="text-neutral-400">Min interval seconds</dt>
                  <dd>{plan.interval}</dd>
                  <dt className="text-neutral-400">Unit count</dt>
                  <dd>{plan.intervalCount} {plan.intervalUnit}</dd>
                  <dt className="text-neutral-400">Description</dt>
                  <dd>{plan.description || "No description"}</dd>
                  <dt className="text-neutral-400">Merchant wallet</dt>
                  <dd className="font-mono text-xs break-all">{plan.merchant}</dd>
                </dl>
              </div>

              <div className="rounded-lg border border-neutral-200 bg-white p-5">
                <h2 className="text-sm font-medium text-neutral-900 mb-4">Attached subscriptions</h2>
                {plan.subscriptions.length === 0 ? (
                  <p className="text-sm text-neutral-400">No subscriptions are attached to this plan yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[680px] text-sm">
                      <thead className="text-xs uppercase tracking-wide text-neutral-500">
                        <tr>
                          <th className="text-left font-medium py-2">Name</th>
                          <th className="text-left font-medium py-2">Email</th>
                          <th className="text-left font-medium py-2">Created</th>
                          <th className="text-left font-medium py-2">Status</th>
                          <th className="text-right font-medium py-2">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {plan.subscriptions.map((sub) => (
                          <tr key={sub.onChainId}>
                            <td className="py-3">{sub.payerName ?? truncateAddress(sub.subscriber)}</td>
                            <td className="py-3 text-neutral-600">{sub.payerEmail || "Not provided"}</td>
                            <td className="py-3 text-neutral-600">{formatDateTime(sub.createdAt)}</td>
                            <td className="py-3">{statusPill(sub.status)}</td>
                            <td className="py-3 text-right">
                              <Link
                                href={`/app/billing/subscriptions/${sub.onChainId}`}
                                className="text-xs px-3 py-1.5 rounded border border-neutral-200 hover:bg-neutral-50 transition-colors"
                              >
                                Manage
                              </Link>
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
                  <p className="text-xs text-neutral-400 mb-1">Hosted subscription URL</p>
                  <p className="font-mono text-xs break-all mb-2">{subscribeUrl}</p>
                  <button
                    onClick={() => copy("url", subscribeUrl)}
                    className="text-xs px-3 py-1.5 rounded border border-neutral-200 hover:bg-neutral-50 transition-colors"
                  >
                    {copied === "url" ? "Copied!" : "Copy link"}
                  </button>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 mb-1">Integration ID</p>
                  <p className="font-mono text-xs break-all mb-2">{plan.extId}</p>
                  <button
                    onClick={() => copy("extId", plan.extId)}
                    className="text-xs px-3 py-1.5 rounded border border-neutral-200 hover:bg-neutral-50 transition-colors"
                  >
                    {copied === "extId" ? "Copied!" : "Copy ID"}
                  </button>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 mb-1">On-chain plan ID</p>
                  <p className="font-mono text-xs break-all mb-2">{plan.onChainId}</p>
                  <button
                    onClick={() => copy("onChainId", plan.onChainId)}
                    className="text-xs px-3 py-1.5 rounded border border-neutral-200 hover:bg-neutral-50 transition-colors"
                  >
                    {copied === "onChainId" ? "Copied!" : "Copy on-chain ID"}
                  </button>
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
