"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  CollectionsChart,
  PaymentsChart,
  SubscriptionHealthChart,
  TopProductsChart,
  type ChartBucket,
  type ChartHealth,
} from "@/components/dashboard-charts";
import { Skeleton } from "@/components/skeleton";
import { compareDashboardPeriods, type DashboardRange } from "@/lib/dashboard-aggregation";
import { formatUsdc, truncateAddress } from "@/lib/stellar";

interface PeriodMetrics {
  volumeReceived: string;
  oneTimeVolume: string;
  recurringVolume: string;
  successfulPayments: number;
  oneTimePayments: number;
  recurringCharges: number;
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
  needsReauthorization: boolean;
  reauthRequestedAt: string | null;
}

interface RecentSale {
  extId: string;
  txHash: string;
  createdAt: string;
  eventType: string;
  paymentType: "one_time" | "recurring";
  status: "succeeded" | "past_due" | "canceled" | "needs_reauthorization";
  productName: string;
  customerName: string | null;
  customerEmail: string | null;
  amount: string | null;
  href: string | null;
}

interface TopProduct {
  key: string;
  kind: "payment_link" | "plan";
  productName: string;
  volumeReceived: string;
  payments: number;
  customers: number;
  href: string | null;
}

interface SetupResource {
  productName: string;
  numericId?: string;
  onChainId?: string;
}

interface Dashboard {
  period: {
    range: DashboardRange;
    label: string;
    current: { start: string; end: string };
    previous: { start: string; end: string };
  };
  buckets: ChartBucket[];
  subscriptionHealth: ChartHealth;
  performance: {
    current: PeriodMetrics;
    previous: PeriodMetrics;
    activeSubscriptions: number;
  };
  needsAttention: AttentionRow[];
  recentSales: RecentSale[];
  topProducts: TopProduct[];
  setup: {
    hasActivity: boolean;
    paymentLinks: number;
    plans: number;
    latestPaymentLink: SetupResource | null;
    latestPlan: SetupResource | null;
  };
}

function usdc(stroops: string) {
  return `${formatUsdc(BigInt(stroops))} USDC`;
}

function formatRelative(value: string) {
  const then = new Date(value).getTime();
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(then);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function MetricCard({
  label,
  value,
  comparisonText,
  comparisonTone = "muted",
}: {
  label: string;
  value: React.ReactNode;
  comparisonText: string;
  comparisonTone?: "positive" | "negative" | "muted";
}) {
  const tone =
    comparisonTone === "positive"
      ? "text-emerald-700"
      : comparisonTone === "negative"
        ? "text-amber-700"
        : "text-[var(--sp-muted)]";
  return (
    <div className="rounded-2xl border border-[var(--sp-border)] bg-white p-5 shadow-[0_16px_42px_rgba(15,19,25,0.045)]">
      <p className="text-sm font-medium text-[var(--sp-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-[var(--sp-ink)]">{value}</p>
      <p className={`mt-2 text-xs font-medium ${tone}`}>{comparisonText}</p>
    </div>
  );
}

async function fetchDashboard(range: DashboardRange): Promise<Dashboard> {
  const response = await fetch(`/api/dashboard?range=${range}`);
  if (!response.ok) throw new Error("Dashboard data could not be loaded.");
  const next = (await response.json()) as Dashboard;
  if (!next?.performance || !next?.period) throw new Error("Dashboard data is incomplete.");
  return next;
}

export default function PlatformOverviewPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [range, setRange] = useState<DashboardRange>(30);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchDashboard(range);
      setData(next);
    } catch (cause) {
      setData(null);
      setError(cause instanceof Error ? cause.message : "Dashboard data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    let active = true;
    fetchDashboard(range)
      .then((next) => {
        if (active) setData(next);
      })
      .catch((cause) => {
        if (!active) return;
        setData(null);
        setError(cause instanceof Error ? cause.message : "Dashboard data could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [range]);

  async function copyCheckout(path: string, key: string) {
    await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    setCopied(key);
    window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1800);
  }

  if (loading) return <DashboardLoading />;
  if (error || !data) return <DashboardError message={error ?? "Dashboard data could not be loaded."} retry={load} />;
  if (!data.setup.hasActivity) {
    return <FirstRun setup={data.setup} copied={copied} copyCheckout={copyCheckout} />;
  }

  const volumeComparison = compareDashboardPeriods(
    data.performance.current.volumeReceived,
    data.performance.previous.volumeReceived,
    data.period.range,
  );
  const paymentComparison = compareDashboardPeriods(
    data.performance.current.successfulPayments,
    data.performance.previous.successfulPayments,
    data.period.range,
  );
  const recurringComparison = compareDashboardPeriods(
    data.performance.current.recurringVolume,
    data.performance.previous.recurringVolume,
    data.period.range,
  );

  return (
    <div className="mx-auto max-w-7xl">
      <header className="flex flex-col gap-3 border-b border-[var(--sp-border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--sp-green)]">Platform overview</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--sp-ink)]">Your business at a glance</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--sp-muted)]">
            Actual money received, customer activity, and anything that needs action.
          </p>
        </div>
        <p className="text-xs font-medium text-[var(--sp-muted)]">
          Updated {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.period.current.end))}
        </p>
      </header>

      <section className="mt-7" aria-labelledby="performance-heading">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 id="performance-heading" className="text-lg font-semibold text-[var(--sp-ink)]">Performance pulse</h2>
            <p className="mt-0.5 text-sm text-[var(--sp-muted)]">Last {data.period.range} days compared with the previous {data.period.range} days</p>
          </div>
          <div className="flex rounded-full border border-[var(--sp-border)] bg-white p-1" aria-label="Dashboard date range">
            {([7, 30, 90] as const).map((days) => <button key={days} type="button" onClick={() => { if (days === range) return; setLoading(true); setError(null); setRange(days); }} aria-pressed={range === days} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sp-green)] ${range === days ? "bg-[var(--sp-ink)] text-white" : "text-[var(--sp-muted)] hover:bg-[var(--sp-mist)]"}`}>{days}d</button>)}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Volume received"
            value={usdc(data.performance.current.volumeReceived)}
            comparisonText={volumeComparison.text}
            comparisonTone={volumeComparison.tone}
          />
          <MetricCard
            label="Successful payments"
            value={data.performance.current.successfulPayments}
            comparisonText={paymentComparison.text}
            comparisonTone={paymentComparison.tone}
          />
          <MetricCard
            label="Recurring collected"
            value={usdc(data.performance.current.recurringVolume)}
            comparisonText={recurringComparison.text}
            comparisonTone={recurringComparison.tone}
          />
          <MetricCard
            label="Active subscriptions"
            value={data.performance.activeSubscriptions}
            comparisonText="Current active total"
          />
        </div>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <CollectionsChart buckets={data.buckets} />
        <PaymentsChart buckets={data.buckets} />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.7fr)] xl:items-start">
        <SubscriptionHealthChart health={data.subscriptionHealth} />
        <ActionQueue rows={data.needsAttention} flush />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.8fr)]">
        <RecentSales rows={data.recentSales} />
        <TopProductsChart products={data.topProducts} range={data.period.range} />
      </div>

      <ContextualActions setup={data.setup} copied={copied} copyCheckout={copyCheckout} />
    </div>
  );
}

function ActionQueue({ rows, flush = false }: { rows: AttentionRow[]; flush?: boolean }) {
  return (
    <section className={flush ? "" : "mt-8"} aria-labelledby="attention-heading">
      <div className="mb-3">
        <h2 id="attention-heading" className="text-lg font-semibold text-[var(--sp-ink)]">Action queue</h2>
        <p className="mt-0.5 text-sm text-[var(--sp-muted)]">Subscription issues that may need follow-up</p>
      </div>
      {rows.length === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700" aria-hidden="true">✓</span>
          <div>
            <p className="text-sm font-semibold text-emerald-900">Everything is running normally</p>
            <p className="text-xs text-emerald-700">No subscriptions are past due, retrying, or waiting for approval.</p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-[0_16px_42px_rgba(15,19,25,0.045)]">
          <ul className="divide-y divide-[var(--sp-border)]">
            {rows.map((row) => {
              const cause = row.status === "PastDue"
                ? { title: "Payment is past due", detail: "The latest collection did not complete.", pill: "Past due" }
                : row.retryCount > 0 || row.nextRetryAt
                  ? {
                      title: "Payment retry in progress",
                      detail: row.nextRetryAt ? `Next attempt ${formatDateTime(row.nextRetryAt)}.` : "Another collection attempt is pending.",
                      pill: `Retry ${row.retryCount}/2`,
                    }
                  : { title: "Customer approval needs renewing", detail: "The billing allowance expired or ran out; funds were not marked insufficient.", pill: "Needs approval" };
              return (
                <li key={row.extId}>
                  <Link
                    href={`/app/billing/subscriptions/${row.onChainId}`}
                    className="grid gap-3 px-4 py-4 transition-colors hover:bg-[var(--sp-mist)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[var(--sp-ink)]">{cause.title}</p>
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">{cause.pill}</span>
                      </div>
                      <p className="mt-1 text-sm text-[var(--sp-muted)]">{cause.detail}</p>
                      <p className="mt-1 truncate text-xs text-[var(--sp-muted)]">
                        {row.productName} · {row.payerName || truncateAddress(row.subscriber)}
                        {row.payerEmail ? ` · ${row.payerEmail}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-5 sm:justify-end">
                      <span className="text-sm font-semibold text-[var(--sp-ink)]">{usdc(row.amount)}</span>
                      <span className="text-sm font-semibold text-[var(--sp-green)]">Review →</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

const SALE_LABELS: Record<string, string> = {
  "payment.settled": "One-time payment",
  "subscription.created": "New subscription",
  "subscription.charged": "Subscription renewal",
  "subscription.past_due": "Subscription payment failed",
  "subscription.canceled": "Subscription canceled",
  "subscription.needs_reauthorization": "Approval needs renewing",
};

function SaleStatus({ status }: { status: RecentSale["status"] }) {
  if (status === "succeeded") return <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Succeeded</span>;
  if (status === "canceled") return <span className="rounded-full bg-[var(--sp-mist)] px-2.5 py-1 text-xs font-semibold text-[var(--sp-muted)]">Canceled</span>;
  return <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">Needs attention</span>;
}

function RecentSales({ rows }: { rows: RecentSale[] }) {
  return (
    <section aria-labelledby="sales-heading">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 id="sales-heading" className="text-lg font-semibold text-[var(--sp-ink)]">Recent sales</h2>
          <p className="mt-0.5 text-sm text-[var(--sp-muted)]">Payments and subscription activity</p>
        </div>
        <Link href="/app/payments" className="text-sm font-semibold text-[var(--sp-green)] hover:underline">View payments</Link>
      </div>
      <div className="overflow-hidden rounded-2xl border border-[var(--sp-border)] bg-white shadow-[0_16px_42px_rgba(15,19,25,0.045)]">
        {rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-[var(--sp-muted)]">No sales activity yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--sp-border)]">
            {rows.map((row) => {
              const content = (
                <div className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-[var(--sp-ink)]">{row.productName}</p>
                      <span className="text-xs text-[var(--sp-muted)]">{row.paymentType === "one_time" ? "One-time" : "Recurring"}</span>
                    </div>
                    <p className="mt-1 truncate text-sm text-[var(--sp-muted)]">
                      {row.customerName || row.customerEmail || "Customer details unavailable"}
                      {row.customerName && row.customerEmail ? ` · ${row.customerEmail}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-[var(--sp-muted)]">{SALE_LABELS[row.eventType] ?? "Activity"} · {formatRelative(row.createdAt)}</p>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <SaleStatus status={row.status} />
                    <span className="min-w-24 text-right text-sm font-semibold text-[var(--sp-ink)]">{row.amount ? usdc(row.amount) : "—"}</span>
                  </div>
                </div>
              );
              return <li key={row.extId}>{row.href ? <Link href={row.href} className="block transition-colors hover:bg-[var(--sp-mist)]">{content}</Link> : content}</li>;
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function ContextualActions({
  setup,
  copied,
  copyCheckout,
}: {
  setup: Dashboard["setup"];
  copied: string | null;
  copyCheckout: (path: string, key: string) => Promise<void>;
}) {
  return (
    <section className="mt-8 rounded-2xl border border-[var(--sp-border)] bg-[var(--sp-paper)] px-5 py-4" aria-labelledby="next-step-heading">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 id="next-step-heading" className="text-sm font-semibold text-[var(--sp-ink)]">Keep selling</h2>
          <p className="mt-1 text-sm text-[var(--sp-muted)]">Create a new checkout or share one that is already active.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {setup.latestPaymentLink?.numericId ? (
            <button onClick={() => copyCheckout(`/pay/${setup.latestPaymentLink?.numericId}`, "payment")} className="rounded-full border border-[var(--sp-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--sp-ink)] hover:border-[var(--sp-green)]">
              {copied === "payment" ? "Link copied" : "Copy latest payment link"}
            </button>
          ) : null}
          {setup.latestPlan?.onChainId ? (
            <button onClick={() => copyCheckout(`/subscribe/${setup.latestPlan?.onChainId}`, "plan")} className="rounded-full border border-[var(--sp-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--sp-ink)] hover:border-[var(--sp-green)]">
              {copied === "plan" ? "Link copied" : "Copy latest plan"}
            </button>
          ) : null}
          <Link href="/app/payments/new" className="rounded-full bg-[var(--sp-ink)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--sp-green)]">New payment link</Link>
          <Link href="/app/billing/plans/new" className="rounded-full border border-[var(--sp-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--sp-ink)] hover:border-[var(--sp-green)]">New plan</Link>
        </div>
      </div>
    </section>
  );
}

function FirstRun({
  setup,
  copied,
  copyCheckout,
}: {
  setup: Dashboard["setup"];
  copied: string | null;
  copyCheckout: (path: string, key: string) => Promise<void>;
}) {
  const hasCheckout = setup.paymentLinks > 0 || setup.plans > 0;
  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm font-semibold text-[var(--sp-green)]">Platform overview</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--sp-ink)]">{hasCheckout ? "Your checkout is ready to share" : "Set up your first sale"}</h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--sp-muted)]">
        {hasCheckout
          ? "You have an active payment link or plan. Share it with a customer; performance and activity will appear here after the first successful payment."
          : "Create a payment link for a one-time sale or a plan for recurring billing. You can start without writing integration code."}
      </p>
      <div className="mt-7 rounded-3xl border border-[var(--sp-border)] bg-white p-6 shadow-[0_20px_55px_rgba(15,19,25,0.055)] sm:p-8">
        <div className="grid gap-4 sm:grid-cols-3">
          {["Create a checkout", "Share it with a customer", "Track real collections here"].map((label, index) => (
            <div key={label} className="rounded-2xl bg-[var(--sp-mist)]/65 p-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs font-bold text-[var(--sp-green)]">{index + 1}</span>
              <p className="mt-3 text-sm font-semibold text-[var(--sp-ink)]">{label}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          {!hasCheckout ? (
            <>
              <Link href="/app/payments/new" className="rounded-full bg-[var(--sp-ink)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--sp-green)]">Create payment link</Link>
              <Link href="/app/billing/plans/new" className="rounded-full border border-[var(--sp-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--sp-ink)] hover:border-[var(--sp-green)]">Create subscription plan</Link>
            </>
          ) : (
            <>
              {setup.latestPaymentLink?.numericId ? <button onClick={() => copyCheckout(`/pay/${setup.latestPaymentLink?.numericId}`, "payment")} className="rounded-full bg-[var(--sp-ink)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--sp-green)]">{copied === "payment" ? "Link copied" : "Copy payment link"}</button> : null}
              {setup.latestPlan?.onChainId ? <button onClick={() => copyCheckout(`/subscribe/${setup.latestPlan?.onChainId}`, "plan")} className="rounded-full bg-[var(--sp-ink)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--sp-green)]">{copied === "plan" ? "Link copied" : "Copy subscription link"}</button> : null}
              <Link href="/app/payments" className="rounded-full border border-[var(--sp-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--sp-ink)] hover:border-[var(--sp-green)]">Manage checkouts</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DashboardLoading() {
  return (
    <div className="mx-auto max-w-7xl" aria-label="Loading Platform overview">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-3 h-9 w-80 max-w-full" />
      <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <div key={item} className="rounded-2xl border border-[var(--sp-border)] bg-white p-5"><Skeleton className="h-4 w-28" /><Skeleton className="mt-4 h-8 w-36" /><Skeleton className="mt-3 h-3 w-32" /></div>)}
      </div>
      <div className="mt-8 rounded-2xl border border-[var(--sp-border)] bg-white p-5"><Skeleton className="h-5 w-36" /><Skeleton className="mt-4 h-14 w-full" /></div>
    </div>
  );
}

function DashboardError({ message, retry }: { message: string; retry: () => Promise<void> }) {
  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-white p-8 shadow-[0_16px_42px_rgba(15,19,25,0.045)]">
      <p className="text-sm font-semibold text-amber-800">Platform overview unavailable</p>
      <h1 className="mt-2 text-2xl font-semibold text-[var(--sp-ink)]">We could not load your business activity</h1>
      <p className="mt-2 text-sm text-[var(--sp-muted)]">{message} Your payment data has not been changed.</p>
      <button onClick={() => void retry()} className="mt-5 rounded-full bg-[var(--sp-ink)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--sp-green)]">Try again</button>
    </div>
  );
}
