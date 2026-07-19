"use client";

import Link from "next/link";
import { formatUsdc } from "@/lib/stellar";

export interface ChartBucket {
  start: string;
  end: string;
  label: string;
  volumeReceived: string;
  oneTimeVolume: string;
  recurringVolume: string;
  successfulPayments: number;
}

export interface ChartProduct {
  key: string;
  productName: string;
  volumeReceived: string;
  payments: number;
  customers: number;
  href: string | null;
}

export interface ChartHealth {
  active: number;
  retrying: number;
  pastDue: number;
  needsApproval: number;
}

function money(value: string | bigint) {
  return `${formatUsdc(BigInt(value))} USDC`;
}

function percent(value: bigint, maximum: bigint) {
  if (maximum === BigInt(0)) return 0;
  return Number((value * BigInt(10_000)) / maximum) / 100;
}

function ChartCard({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-3xl border border-[var(--sp-border)] bg-white p-5 shadow-[0_18px_48px_rgba(15,19,25,0.05)] sm:p-6 ${className}`}>
      <div>
        <h2 className="text-base font-semibold text-[var(--sp-ink)]">{title}</h2>
        <p className="mt-1 text-sm text-[var(--sp-muted)]">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function CollectionsChart({ buckets }: { buckets: ChartBucket[] }) {
  const maximum = buckets.reduce((max, bucket) => {
    const value = BigInt(bucket.volumeReceived);
    return value > max ? value : max;
  }, BigInt(0));
  const half = maximum / BigInt(2);
  const visibleLabels = new Set([0, Math.floor((buckets.length - 1) / 2), buckets.length - 1]);

  return (
    <ChartCard title="Collections over time" description="Actual USDC received, split by payment type" className="xl:col-span-2">
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-[var(--sp-muted)]" aria-label="Collections chart legend">
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--sp-green)]" />One-time</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-[#9ba8bc]" />Recurring</span>
      </div>
      {maximum === BigInt(0) ? (
        <div className="mt-5 flex h-64 items-center justify-center rounded-2xl border border-dashed border-[var(--sp-border)] bg-[var(--sp-paper)] px-6 text-center">
          <div><p className="text-sm font-semibold text-[var(--sp-ink)]">No collections in this range</p><p className="mt-1 text-xs text-[var(--sp-muted)]">Successful payments will form the chart as they arrive.</p></div>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-[auto_minmax(0,1fr)] gap-3">
          <div className="flex h-64 flex-col justify-between pb-7 text-right text-[10px] font-medium text-[var(--sp-muted)]" aria-hidden="true">
            <span>{money(maximum)}</span><span>{money(half)}</span><span>0</span>
          </div>
          <div className="relative h-64 border-b border-l border-[var(--sp-border)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-[var(--sp-border)]" />
            <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-[var(--sp-border)]" />
            <div className="absolute inset-0 flex items-end gap-[clamp(2px,0.55vw,8px)] px-2 pb-7 pt-1">
              {buckets.map((bucket, index) => {
                const oneTime = BigInt(bucket.oneTimeVolume);
                const recurring = BigInt(bucket.recurringVolume);
                const oneTimeHeight = percent(oneTime, maximum);
                const recurringHeight = percent(recurring, maximum);
                return (
                  <div key={bucket.start} className="group relative flex h-full min-w-0 flex-1 items-end">
                    <button
                      type="button"
                      className="flex h-full w-full items-end rounded-t-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--sp-green)] focus-visible:ring-offset-2"
                      aria-label={`${bucket.label}: ${money(bucket.volumeReceived)} total; ${money(bucket.oneTimeVolume)} one-time; ${money(bucket.recurringVolume)} recurring`}
                    >
                      <span className="flex w-full flex-col-reverse overflow-hidden rounded-t-sm transition-opacity group-hover:opacity-80 group-focus-within:opacity-80" style={{ height: `${oneTimeHeight + recurringHeight}%`, minHeight: oneTime + recurring > BigInt(0) ? 3 : 0 }} aria-hidden="true">
                        {oneTime > BigInt(0) ? <span className="w-full bg-[var(--sp-green)]" style={{ height: `${(oneTimeHeight / (oneTimeHeight + recurringHeight)) * 100}%` }} /> : null}
                        {recurring > BigInt(0) ? <span className="w-full bg-[#9ba8bc]" style={{ height: `${(recurringHeight / (oneTimeHeight + recurringHeight)) * 100}%` }} /> : null}
                      </span>
                    </button>
                    <span className={`pointer-events-none absolute bottom-[calc(100%+8px)] z-10 hidden w-44 rounded-xl bg-[var(--sp-ink)] px-3 py-2 text-left text-[11px] leading-5 text-white shadow-xl group-hover:block group-focus-within:block ${index === 0 ? "left-0" : index === buckets.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2"}`}>
                      <strong className="block">{bucket.label} · {money(bucket.volumeReceived)}</strong>
                      One-time {money(bucket.oneTimeVolume)}<br />Recurring {money(bucket.recurringVolume)}
                    </span>
                    {visibleLabels.has(index) ? <span className={`absolute -bottom-6 whitespace-nowrap text-[10px] text-[var(--sp-muted)] ${index === 0 ? "left-0" : index === buckets.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2"}`} aria-hidden="true">{bucket.label}</span> : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </ChartCard>
  );
}

export function PaymentsChart({ buckets }: { buckets: ChartBucket[] }) {
  const maximum = Math.max(0, ...buckets.map((bucket) => bucket.successfulPayments));
  const width = 640;
  const height = 190;
  const inset = 18;
  const points = buckets.map((bucket, index) => ({
    bucket,
    x: buckets.length === 1 ? width / 2 : inset + (index * (width - inset * 2)) / (buckets.length - 1),
    y: maximum === 0 ? height - inset : height - inset - (bucket.successfulPayments / maximum) * (height - inset * 2),
  }));
  const path = points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");

  return (
    <ChartCard title="Successful payments" description="Completed one-time and recurring charges">
      {maximum === 0 ? (
        <div className="mt-5 flex h-64 items-center justify-center rounded-2xl border border-dashed border-[var(--sp-border)] bg-[var(--sp-paper)] px-6 text-center text-sm text-[var(--sp-muted)]">No successful payments in this range.</div>
      ) : (
        <div className="mt-6">
          <div className="flex items-baseline justify-between"><p className="text-3xl font-semibold tracking-tight text-[var(--sp-ink)]">{buckets.reduce((sum, bucket) => sum + bucket.successfulPayments, 0)}</p><p className="text-xs font-medium text-[var(--sp-muted)]">Peak {maximum}</p></div>
          <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 h-48 w-full overflow-visible" role="img" aria-label="Successful payments trend">
            <title>Successful payments over the selected period</title>
            {[inset, height / 2, height - inset].map((y) => <line key={y} x1={inset} x2={width - inset} y1={y} y2={y} stroke="var(--sp-border)" strokeDasharray="4 6" />)}
            <path d={path} fill="none" stroke="var(--sp-green)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {points.map(({ bucket, x, y }) => (
              <circle key={bucket.start} cx={x} cy={y} r="5" fill="white" stroke="var(--sp-green)" strokeWidth="3" tabIndex={0} role="img" aria-label={`${bucket.label}: ${bucket.successfulPayments} successful payment${bucket.successfulPayments === 1 ? "" : "s"}`} className="outline-none focus:[filter:drop-shadow(0_0_4px_var(--sp-green))]">
                <title>{bucket.label}: {bucket.successfulPayments} successful payment{bucket.successfulPayments === 1 ? "" : "s"}</title>
              </circle>
            ))}
          </svg>
          <div className="flex justify-between text-[10px] font-medium text-[var(--sp-muted)]" aria-hidden="true"><span>{buckets[0]?.label}</span><span>{buckets.at(-1)?.label}</span></div>
        </div>
      )}
    </ChartCard>
  );
}

export function TopProductsChart({ products, range }: { products: ChartProduct[]; range: number }) {
  const maximum = products.reduce((max, product) => BigInt(product.volumeReceived) > max ? BigInt(product.volumeReceived) : max, BigInt(0));
  return (
    <ChartCard title="Top products" description={`Actual collected volume in the last ${range} days`}>
      {products.length === 0 ? <div className="mt-5 flex h-48 items-center justify-center rounded-2xl border border-dashed border-[var(--sp-border)] text-sm text-[var(--sp-muted)]">No product sales in this range.</div> : (
        <ol className="mt-5 space-y-5">
          {products.map((product) => {
            const content = <><div className="flex items-end justify-between gap-4"><div className="min-w-0"><p className="truncate text-sm font-semibold text-[var(--sp-ink)]">{product.productName}</p><p className="mt-0.5 text-xs text-[var(--sp-muted)]">{product.payments} payment{product.payments === 1 ? "" : "s"} · {product.customers} customer{product.customers === 1 ? "" : "s"}</p></div><p className="shrink-0 text-sm font-semibold text-[var(--sp-ink)]">{money(product.volumeReceived)}</p></div><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[var(--sp-mist)]"><div className="h-full rounded-full bg-[var(--sp-green)]" style={{ width: `${percent(BigInt(product.volumeReceived), maximum)}%` }} /></div></>;
            return <li key={product.key}>{product.href ? <Link href={product.href} className="block rounded-lg outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--sp-green)] focus-visible:ring-offset-4">{content}</Link> : content}</li>;
          })}
        </ol>
      )}
    </ChartCard>
  );
}

const HEALTH_SEGMENTS = [
  { key: "active" as const, label: "Active", color: "#217669" },
  { key: "retrying" as const, label: "Retrying", color: "#d49a35" },
  { key: "pastDue" as const, label: "Past due", color: "#b65b4a" },
  { key: "needsApproval" as const, label: "Needs approval", color: "#78869a" },
];

export function SubscriptionHealthChart({ health }: { health: ChartHealth }) {
  const total = HEALTH_SEGMENTS.reduce((sum, segment) => sum + health[segment.key], 0);
  return (
    <ChartCard title="Subscription health" description="Current billing state across subscriptions">
      {total === 0 ? <div className="mt-5 flex h-36 items-center justify-center rounded-2xl border border-dashed border-[var(--sp-border)] text-sm text-[var(--sp-muted)]">No active or actionable subscriptions.</div> : <>
        <div className="mt-6 flex h-4 overflow-hidden rounded-full bg-[var(--sp-mist)]" role="img" aria-label={HEALTH_SEGMENTS.map((segment) => `${segment.label}: ${health[segment.key]}`).join(", ")}>
          {HEALTH_SEGMENTS.map((segment) => health[segment.key] ? <span key={segment.key} style={{ width: `${(health[segment.key] / total) * 100}%`, backgroundColor: segment.color }} /> : null)}
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3">
          {HEALTH_SEGMENTS.map((segment) => <div key={segment.key} className="rounded-xl bg-[var(--sp-paper)] p-3"><dt className="flex items-center gap-2 text-xs font-medium text-[var(--sp-muted)]"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: segment.color }} />{segment.label}</dt><dd className="mt-1 text-xl font-semibold text-[var(--sp-ink)]">{health[segment.key]}</dd></div>)}
        </dl>
      </>}
    </ChartCard>
  );
}
