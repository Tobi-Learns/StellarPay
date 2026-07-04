import Link from "next/link";

export default function AppOverviewPage() {
  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <p className="text-sm font-semibold text-[var(--sp-muted)]">Overview</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-normal text-[var(--sp-ink)]">Dashboard</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/app/payments/new"
          className="block rounded-lg border border-[var(--sp-border)] bg-white p-5 transition-colors hover:border-[var(--sp-green)]"
        >
          <div className="mb-1 text-sm font-semibold text-[var(--sp-ink)]">Create payment link</div>
          <div className="text-xs text-[var(--sp-muted)]">One-time checkout</div>
        </Link>
        <Link
          href="/app/billing/plans/new"
          className="block rounded-lg border border-[var(--sp-border)] bg-white p-5 transition-colors hover:border-[var(--sp-green)]"
        >
          <div className="mb-1 text-sm font-semibold text-[var(--sp-ink)]">Create subscription plan</div>
          <div className="text-xs text-[var(--sp-muted)]">Recurring billing</div>
        </Link>
        <Link
          href="/app/payments"
          className="block rounded-lg border border-[var(--sp-border)] bg-white p-5 transition-colors hover:border-[var(--sp-green)]"
        >
          <div className="mb-1 text-sm font-semibold text-[var(--sp-ink)]">Payments</div>
          <div className="text-xs text-[var(--sp-muted)]">View payment history</div>
        </Link>
        <Link
          href="/app/billing"
          className="block rounded-lg border border-[var(--sp-border)] bg-white p-5 transition-colors hover:border-[var(--sp-green)]"
        >
          <div className="mb-1 text-sm font-semibold text-[var(--sp-ink)]">Subscriptions</div>
          <div className="text-xs text-[var(--sp-muted)]">Plans and customers</div>
        </Link>
      </div>
    </div>
  );
}
