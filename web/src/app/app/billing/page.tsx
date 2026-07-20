"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatUsdc, truncateAddress } from "@/lib/stellar";
import { type StoredPlan, type StoredSubscription } from "@/lib/plans";
import { SkeletonRow } from "@/components/skeleton";

type PlanRow = Omit<StoredPlan, "description"> & {
  productName?: string;
  description?: string | null;
  archivedAt?: string | null;
  subscriberCount?: number;
  activeSubscriberCount?: number;
};

type SubscriptionRow = StoredSubscription & {
  payerName?: string | null;
  payerEmail?: string | null;
  status?: string;
  plan?: {
    extId?: string;
    productName?: string;
    description?: string | null;
    intervalLabel?: string;
  };
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
      : "bg-[#eceef2] text-[var(--sp-muted)]";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}>{status}</span>;
}

export default function BillingPage() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [subs, setSubs] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    Promise.all([
      fetch("/api/plans").then((r) => r.json()).catch(() => null),
      fetch("/api/subscriptions").then((r) => r.json()).catch(() => null),
    ]).then(([apiPlans, apiSubs]) => {
      setPlans(
        Array.isArray(apiPlans) && apiPlans.length > 0
          ? apiPlans.map((p: {
              extId: string;
              onChainId: string;
              merchant: string;
              amount: string;
              productName?: string;
              description?: string | null;
              interval: number;
              intervalLabel: string;
              intervalUnit?: StoredPlan["intervalUnit"];
              intervalCount?: number;
              archivedAt?: string | null;
              subscriberCount?: number;
              activeSubscriberCount?: number;
              createdAt: string;
            }) => ({ ...p, createdAt: new Date(p.createdAt).getTime() }))
          : []
      );
      setSubs(
        Array.isArray(apiSubs) && apiSubs.length > 0
          ? apiSubs.map((s: {
              extId: string;
              onChainId: string;
              planOnChainId: string;
              plan?: SubscriptionRow["plan"];
              subscriber: string;
              merchant: string;
              amount: string;
              payerName?: string | null;
              payerEmail?: string | null;
              status?: string;
              createdAt: string;
            }) => ({
              ...s,
              planId: s.planOnChainId,
              planExtId: s.plan?.extId,
              planProductName: s.plan?.productName,
              planDescription: s.plan?.description ?? undefined,
              interval: 0,
              intervalLabel: s.plan?.intervalLabel ?? "",
              createdAt: new Date(s.createdAt).getTime(),
            }))
          : []
      );
    }).finally(() => setLoading(false));
  }, []);

  const filteredPlans = useMemo(() => {
    const q = query.trim().toLowerCase();
    return plans.filter((plan) => {
      const active = plan.archivedAt ? "archived" : "active";
      if (["pastdue", "canceled"].includes(statusFilter)) return false;
      if (statusFilter !== "all" && statusFilter !== active) return false;
      if (!q) return true;
      return [
        plan.productName,
        plan.description,
        plan.extId,
        plan.onChainId,
        plan.intervalLabel,
      ].some((value) => value?.toLowerCase().includes(q));
    });
  }, [plans, query, statusFilter]);

  const filteredSubs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return subs.filter((sub) => {
      const status = sub.status ?? "Active";
      if (statusFilter === "archived") return false;
      if (statusFilter !== "all" && status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (!q) return true;
      return [
        sub.payerName,
        sub.payerEmail,
        sub.subscriber,
        sub.extId,
        sub.onChainId,
        sub.planProductName ?? sub.plan?.productName,
        sub.planExtId,
        sub.planId,
      ].some((value) => value?.toLowerCase().includes(q));
    });
  }, [subs, query, statusFilter]);

  function copySubscribeUrl(planId: string) {
    const url = `${window.location.origin}/subscribe/${planId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(planId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold">Billing</h1>
          <p className="text-sm text-neutral-500 mt-1">Manage recurring plans and active subscriptions.</p>
        </div>
        <Link
          href="/app/billing/plans/new"
          className="text-sm bg-neutral-900 text-white px-4 py-2 rounded-lg hover:bg-neutral-700 transition-colors"
        >
          New plan
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="search"
          placeholder="Search name, email, product, or id"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-[260px] flex-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="archived">Archived plans</option>
          <option value="pastdue">Past due subscriptions</option>
          <option value="canceled">Canceled subscriptions</option>
        </select>
      </div>

      <section className="mb-8">
        <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wide mb-3">Plans</h2>
        {loading ? (
          <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg bg-white">
            {[...Array(2)].map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : filteredPlans.length === 0 ? (
          <div className="text-center py-12 text-sm text-neutral-400 border border-dashed border-neutral-200 rounded-lg bg-white">
            No plans match this view.{" "}
            <Link href="/app/billing/plans/new" className="underline">Create a plan.</Link>
          </div>
        ) : (
          <div className="overflow-x-auto border border-neutral-200 rounded-lg bg-white">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Product or service</th>
                  <th className="text-left font-medium px-4 py-3">Amount per cycle</th>
                  <th className="text-left font-medium px-4 py-3">Billing interval</th>
                  <th className="text-left font-medium px-4 py-3">Created</th>
                  <th className="text-left font-medium px-4 py-3">Status</th>
                  <th className="text-right font-medium px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredPlans.map((plan) => (
                  <tr key={plan.onChainId}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-900">{plan.productName || "Subscription plan"}</p>
                      {plan.extId && <p className="text-xs font-mono text-neutral-400 mt-0.5">{plan.extId}</p>}
                    </td>
                    <td className="px-4 py-3 text-neutral-900">{formatUsdc(BigInt(plan.amount))} USDC</td>
                    <td className="px-4 py-3 text-neutral-600">{plan.intervalLabel}</td>
                    <td className="px-4 py-3 text-neutral-600">{formatDateTime(plan.createdAt)}</td>
                    <td className="px-4 py-3">{plan.archivedAt ? statusPill("Archived") : statusPill("Active")}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => copySubscribeUrl(plan.onChainId)}
                          className="text-xs px-3 py-1.5 rounded border border-neutral-200 hover:bg-neutral-50 transition-colors"
                        >
                          {copiedId === plan.onChainId ? "Copied!" : "Copy link"}
                        </button>
                        <Link
                          href={`/app/billing/plans/${plan.onChainId}`}
                          className="text-xs px-3 py-1.5 rounded border border-neutral-200 hover:bg-neutral-50 transition-colors"
                        >
                          Manage
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wide mb-3">Subscriptions</h2>
        {loading ? (
          <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg bg-white">
            {[...Array(2)].map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : filteredSubs.length === 0 ? (
          <div className="text-center py-12 text-sm text-neutral-400 border border-dashed border-neutral-200 rounded-lg bg-white">
            No subscriptions match this view. Copy a plan link to share it with customers.
          </div>
        ) : (
          <div className="overflow-x-auto border border-neutral-200 rounded-lg bg-white">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Name</th>
                  <th className="text-left font-medium px-4 py-3">Email</th>
                  <th className="text-left font-medium px-4 py-3">Product or service</th>
                  <th className="text-left font-medium px-4 py-3">Amount per cycle</th>
                  <th className="text-left font-medium px-4 py-3">Purchased</th>
                  <th className="text-left font-medium px-4 py-3">Status</th>
                  <th className="text-right font-medium px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredSubs.map((sub) => (
                  <tr key={sub.onChainId}>
                    <td className="px-4 py-3 text-neutral-900">{sub.payerName || truncateAddress(sub.subscriber)}</td>
                    <td className="px-4 py-3 text-neutral-600">{sub.payerEmail || "Not provided"}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-900">{sub.planProductName ?? sub.plan?.productName ?? "Subscription plan"}</p>
                      <p className="text-xs font-mono text-neutral-400 mt-0.5">{sub.planExtId ?? sub.planId}</p>
                    </td>
                    <td className="px-4 py-3 text-neutral-900">{formatUsdc(BigInt(sub.amount))} USDC</td>
                    <td className="px-4 py-3 text-neutral-600">{formatDateTime(sub.createdAt)}</td>
                    <td className="px-4 py-3">{statusPill(sub.status ?? "Active")}</td>
                    <td className="px-4 py-3 text-right">
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
      </section>
    </div>
  );
}
