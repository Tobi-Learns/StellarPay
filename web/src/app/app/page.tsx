"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@/lib/wallet-context";
import { formatUsdc, truncateAddress } from "@/lib/stellar";
import { Skeleton } from "@/components/skeleton";

interface Kpis {
  totalVolume: string;
  paymentsReceived: number;
  activeSubscriptions: number;
  pastDueCount: number;
  recurringMonthly: string;
}

interface AttentionRow {
  extId: string;
  onChainId: string;
  productName: string;
  payerName: string | null;
  payerEmail: string | null;
  subscriber: string;
  amount: string;
  intervalLabel: string;
  status: string;
  retryCount: number;
  nextRetryAt: string | null;
}

interface ActivityRow {
  extId: string;
  type: string;
  txHash: string;
  createdAt: string;
  productName: string | null;
  payerName: string | null;
  payerEmail: string | null;
  amount: string | null;
  subscriptionOnChainId: string | null;
}

interface Dashboard {
  kpis: Kpis;
  needsAttention: AttentionRow[];
  recentActivity: ActivityRow[];
}

const ACTIVITY_LABELS: Record<string, string> = {
  "payment.settled": "Payment received",
  "subscription.created": "New subscription",
  "subscription.charged": "Subscription charged",
  "subscription.past_due": "Subscription past due",
  "subscription.canceled": "Subscription canceled",
};

function formatRelative(value: string) {
  const then = new Date(value).getTime();
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(then);
}

function activityHref(row: ActivityRow): string | null {
  if (row.type === "payment.settled") return `/app/payments/received/${row.txHash}`;
  if (row.subscriptionOnChainId) return `/app/billing/subscriptions/${row.subscriptionOnChainId}`;
  return null;
}

function usdc(stroops: string) {
  return `${formatUsdc(BigInt(stroops))} USDC`;
}

function KpiCard({ label, value, accent }: { label: string; value: React.ReactNode; accent?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--sp-border)] bg-white p-5 shadow-[0_18px_48px_rgba(7,19,17,0.05)]">
      <p className="text-xs font-semibold uppercase tracking-normal text-[var(--sp-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-[var(--sp-ink)]">{value}</p>
      {accent}
    </div>
  );
}

export default function AppOverviewPage() {
  const { address } = useWallet();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    fetch(`/api/dashboard?merchant=${encodeURIComponent(address)}`)
      .then((r) => r.json())
      .then((d) => setData(d && d.kpis ? d : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [address]);

  const isEmpty = useMemo(() => {
    if (!data) return false;
    const { kpis, needsAttention, recentActivity } = data;
    return (
      kpis.totalVolume === "0" &&
      kpis.paymentsReceived === 0 &&
      kpis.activeSubscriptions === 0 &&
      needsAttention.length === 0 &&
      recentActivity.length === 0
    );
  }, [data]);

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <p className="text-sm font-semibold text-[var(--sp-muted)]">Overview</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-normal text-[var(--sp-ink)]">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--sp-muted)]">How your business is doing, and what needs your attention.</p>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-[var(--sp-border)] bg-white p-5 shadow-[0_18px_48px_rgba(7,19,17,0.05)]">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-7 w-32" />
            </div>
          ))}
        </div>
      ) : isEmpty ? (
        <EmptyState />
      ) : data ? (
        <>
          {/* 4.1b — KPI strip */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Total volume" value={usdc(data.kpis.totalVolume)} />
            <KpiCard label="Payments received" value={data.kpis.paymentsReceived} />
            <KpiCard
              label="Active subscriptions"
              value={data.kpis.activeSubscriptions}
              accent={
                data.kpis.pastDueCount > 0 ? (
                  <p className="mt-1.5 text-xs font-semibold text-amber-700">
                    {data.kpis.pastDueCount} past due
                  </p>
                ) : undefined
              }
            />
            <KpiCard
              label="Recurring value / month"
              value={usdc(data.kpis.recurringMonthly)}
              accent={<p className="mt-1.5 text-xs text-[var(--sp-muted)]">Normalized run-rate</p>}
            />
          </div>

          {/* 4.1c — Needs attention */}
          {data.needsAttention.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-normal text-[var(--sp-muted)]">Needs attention</h2>
              <div className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-[0_18px_48px_rgba(7,19,17,0.05)]">
                <ul className="divide-y divide-[#eaebef]">
                  {data.needsAttention.map((row) => (
                    <li key={row.extId}>
                      <Link
                        href={`/app/billing/subscriptions/${row.onChainId}`}
                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--sp-mist)]"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[var(--sp-ink)]">{row.productName}</p>
                          <p className="truncate text-xs text-[var(--sp-muted)]">
                            {row.payerName || truncateAddress(row.subscriber)}
                            {row.payerEmail ? ` · ${row.payerEmail}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-[var(--sp-ink)]">{usdc(row.amount)}</span>
                          {row.status === "PastDue" ? (
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Past due</span>
                          ) : (
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                              Retry {row.retryCount}/2
                            </span>
                          )}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {/* 4.1e — Quick actions */}
          <section className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/app/payments/new"
              className="rounded-full bg-[var(--sp-ink)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--sp-green)]"
            >
              New payment link
            </Link>
            <Link
              href="/app/billing/plans/new"
              className="rounded-full border border-[var(--sp-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--sp-ink)] transition-colors hover:border-[var(--sp-green)] hover:bg-[var(--sp-mist)]"
            >
              New subscription plan
            </Link>
          </section>

          {/* 4.1d — Recent activity */}
          <section className="mt-8">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-normal text-[var(--sp-muted)]">Recent activity</h2>
            {data.recentActivity.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--sp-border)] bg-white py-12 text-center text-sm text-[var(--sp-muted)]">
                No activity yet.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-[var(--sp-border)] bg-white shadow-[0_18px_48px_rgba(7,19,17,0.05)]">
                <ul className="divide-y divide-[#eaebef]">
                  {data.recentActivity.map((row) => {
                    const href = activityHref(row);
                    const inner = (
                      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[var(--sp-ink)]">
                            {ACTIVITY_LABELS[row.type] ?? row.type}
                            {row.productName ? <span className="text-[var(--sp-muted)]"> · {row.productName}</span> : null}
                          </p>
                          <p className="truncate text-xs text-[var(--sp-muted)]">
                            {row.payerName || "—"}
                            {row.payerEmail ? ` · ${row.payerEmail}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          {row.amount ? <span className="text-sm font-medium text-[var(--sp-ink)]">{usdc(row.amount)}</span> : null}
                          <span className="w-16 text-right text-xs text-[var(--sp-muted)]">{formatRelative(row.createdAt)}</span>
                        </div>
                      </div>
                    );
                    return (
                      <li key={row.extId}>
                        {href ? (
                          <Link href={href} className="block transition-colors hover:bg-[var(--sp-mist)]">
                            {inner}
                          </Link>
                        ) : (
                          inner
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-[var(--sp-border)] bg-white p-8 shadow-[0_18px_48px_rgba(7,19,17,0.05)]">
      <h2 className="text-lg font-semibold text-[var(--sp-ink)]">Take your first payment</h2>
      <p className="mt-1 max-w-lg text-sm text-[var(--sp-muted)]">
        Create a payment link to charge once, or a subscription plan to bill on a recurring cycle. Your sales and
        activity will show up here as customers pay.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href="/app/payments/new"
          className="rounded-full bg-[var(--sp-ink)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--sp-green)]"
        >
          Create payment link
        </Link>
        <Link
          href="/app/billing/plans/new"
          className="rounded-full border border-[var(--sp-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--sp-ink)] transition-colors hover:border-[var(--sp-green)] hover:bg-[var(--sp-mist)]"
        >
          Create subscription plan
        </Link>
      </div>
    </div>
  );
}
