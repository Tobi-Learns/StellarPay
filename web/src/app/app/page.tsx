import Link from "next/link";

export default function AppOverviewPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4">
        <Link
          href="/app/payments/new"
          className="block border border-neutral-200 rounded-xl p-5 bg-white hover:border-neutral-400 transition-colors"
        >
          <div className="text-sm font-medium mb-1">Create payment link</div>
          <div className="text-xs text-neutral-500">One-time checkout</div>
        </Link>
        <Link
          href="/app/billing/plans/new"
          className="block border border-neutral-200 rounded-xl p-5 bg-white hover:border-neutral-400 transition-colors"
        >
          <div className="text-sm font-medium mb-1">Create subscription plan</div>
          <div className="text-xs text-neutral-500">Recurring billing</div>
        </Link>
        <Link
          href="/app/payments"
          className="block border border-neutral-200 rounded-xl p-5 bg-white hover:border-neutral-400 transition-colors"
        >
          <div className="text-sm font-medium mb-1">Payments</div>
          <div className="text-xs text-neutral-500">View payment history</div>
        </Link>
        <Link
          href="/app/billing"
          className="block border border-neutral-200 rounded-xl p-5 bg-white hover:border-neutral-400 transition-colors"
        >
          <div className="text-sm font-medium mb-1">Billing</div>
          <div className="text-xs text-neutral-500">Plans and subscribers</div>
        </Link>
      </div>
    </div>
  );
}
