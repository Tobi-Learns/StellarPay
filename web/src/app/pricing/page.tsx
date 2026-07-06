import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "StellarPay pricing: 1% all-in wallet-native payments on Stellar, with one-time checkout, subscriptions, SDK, and webhooks.",
};

const included = [
  "Hosted payment and subscription links",
  "Embeddable React button",
  "Headless SDK and XDR builders",
  "API keys and HMAC-signed webhooks",
  "Merchant dashboard and subscriber portal",
  "Automated subscription billing",
];

const comparisonRows = [
  {
    provider: "StellarPay",
    fee: "1%",
    detail: "Contract-enforced fee split, wallet-to-wallet settlement, one-time payments, subscriptions, SDK, webhooks.",
    emphasis: true,
  },
  {
    provider: "Stripe stablecoin payments",
    fee: "1.5%",
    detail: "Strong product surface, but available through Stripe merchant onboarding and supported-country access.",
  },
  {
    provider: "Stripe card payments",
    fee: "2.9% + 30 cents",
    detail: "Traditional baseline for online card acceptance, with card network and business-account requirements.",
  },
  {
    provider: "Low-fee crypto gateways",
    fee: "0.2%-1%",
    detail: "Some headline rates are lower, but most focus on one-time checkout and may add conversion, payout, or network layers.",
  },
];

const notes = [
  {
    title: "The headline is not the whole cost.",
    body: "A lower gateway fee can still become more expensive after conversion spreads, payout fees, fiat-settlement premiums, or high network fees.",
  },
  {
    title: "Subscriptions change the comparison.",
    body: "Many crypto gateways can receive a one-time payment. StellarPay includes recurring pulls from capped wallet allowances.",
  },
  {
    title: "Stellar rails keep the fee simple.",
    body: "Near-zero network fees let StellarPay keep the platform model at 1% without adding a separate payout layer.",
  },
];

const tierRows = [
  ["One-time payment links", "Included", "Included", "Included"],
  ["Subscription billing", "Included", "Included", "Included"],
  ["SDK, API keys, webhooks", "Included", "Included", "Included"],
  ["Business profile and logo", "Basic", "Email-verified", "Verified business"],
  ["Customer receipts and notifications", "Manual", "Planned", "Planned"],
  ["Fiat off-ramp eligibility", "Not included", "Not included", "Planned"],
];

export default function PricingPage() {
  return (
    <div className="bg-[var(--background)] text-[var(--sp-ink)]">
      <section className="border-b border-[var(--sp-border)] bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 sm:px-8 lg:grid-cols-[1fr_0.8fr] lg:px-10 lg:py-20">
          <div>
            <p className="text-sm font-semibold text-[var(--sp-green)]">Pricing</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-normal sm:text-6xl">
              One percent for wallet-native payments and subscriptions.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-[var(--sp-muted)] sm:text-lg">
              StellarPay is priced for merchants who need more than a crypto donation button: hosted checkout, recurring billing, SDK integrations, webhooks, and automated settlement on Stellar.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/connect"
                className="inline-flex items-center justify-center rounded-md bg-[var(--sp-ink)] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--sp-green)]"
              >
                Start with a payment link
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center justify-center rounded-md border border-[var(--sp-border)] px-5 py-3 text-sm font-semibold text-[var(--sp-ink)] transition-colors hover:border-[var(--sp-ink)]"
              >
                Read integration docs
              </Link>
            </div>
          </div>

          <aside className="self-start rounded-lg border border-[var(--sp-border)] bg-[var(--sp-paper)] p-6 shadow-sm">
            <p className="text-sm font-semibold text-[var(--sp-muted)]">StellarPay fee</p>
            <div className="mt-4 flex items-end gap-2">
              <span className="text-7xl font-semibold leading-none">1%</span>
              <span className="pb-2 text-sm font-medium text-[var(--sp-muted)]">per successful transaction</span>
            </div>
            <p className="mt-5 text-sm leading-6 text-[var(--sp-muted)]">
              No monthly platform fee. No custody. No separate StellarPay payout fee. The fee split happens in the contract when the payment settles.
            </p>
            <div className="mt-6 grid gap-3 border-t border-[var(--sp-border)] pt-5 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-[var(--sp-muted)]">One-time payments</span>
                <span className="font-semibold">Included</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[var(--sp-muted)]">Subscriptions</span>
                <span className="font-semibold">Included</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[var(--sp-muted)]">Webhooks + API keys</span>
                <span className="font-semibold">Included</span>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <p className="text-sm font-semibold text-[var(--sp-green)]">What is included</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
              The processor surface, not just a payment address.
            </h2>
            <p className="mt-5 text-sm leading-7 text-[var(--sp-muted)]">
              StellarPay&apos;s 1% covers the workflow around the payment: checkout, subscription records, webhooks, dashboard state, and automated billing.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {included.map((item) => (
              <div key={item} className="rounded-lg border border-[var(--sp-border)] bg-white p-4 text-sm font-medium shadow-sm">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--sp-border)] bg-white">
        <div className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:px-10">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-[var(--sp-green)]">Comparison</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
              Do not compare only the headline fee.
            </h2>
            <p className="mt-5 text-sm leading-7 text-[var(--sp-muted)]">
              Some crypto gateways advertise lower transaction rates. The real question is whether the product includes subscriptions, whether payouts add another layer, and whether merchants can actually onboard.
            </p>
          </div>

          <div className="mt-10 overflow-hidden rounded-lg border border-[var(--sp-border)]">
            <div className="grid grid-cols-[0.75fr_0.45fr_1.3fr] bg-[var(--sp-mist)] px-4 py-3 text-xs font-semibold uppercase text-[var(--sp-muted)]">
              <span>Provider</span>
              <span>Headline fee</span>
              <span>What to know</span>
            </div>
            {comparisonRows.map((row) => (
              <div
                key={row.provider}
                className={`grid gap-3 border-t border-[var(--sp-border)] px-4 py-4 text-sm sm:grid-cols-[0.75fr_0.45fr_1.3fr] ${
                  row.emphasis ? "bg-[#f3fbf8]" : "bg-white"
                }`}
              >
                <span className="font-semibold text-[var(--sp-ink)]">{row.provider}</span>
                <span className="font-semibold text-[var(--sp-ink)]">{row.fee}</span>
                <span className="leading-6 text-[var(--sp-muted)]">{row.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:px-10">
        <div className="grid gap-4 lg:grid-cols-3">
          {notes.map((note) => (
            <article key={note.title} className="rounded-lg border border-[var(--sp-border)] bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold">{note.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--sp-muted)]">{note.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-[var(--sp-border)] bg-white">
        <div className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:px-10">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-[var(--sp-green)]">Access tiers</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
              Start permissionless. Add verification when the product needs it.
            </h2>
            <p className="mt-5 text-sm leading-7 text-[var(--sp-muted)]">
              The core payment fee stays simple. Verification tiers are about business profile, trust, limits, receipts, and future fiat services.
            </p>
          </div>

          <div className="mt-10 overflow-x-auto rounded-lg border border-[var(--sp-border)]">
            <table className="min-w-[760px] w-full border-collapse text-left text-sm">
              <thead className="bg-[var(--sp-mist)] text-xs uppercase text-[var(--sp-muted)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Feature</th>
                  <th className="px-4 py-3 font-semibold">Wallet account</th>
                  <th className="px-4 py-3 font-semibold">Tier 1 profile</th>
                  <th className="px-4 py-3 font-semibold">Verified merchant</th>
                </tr>
              </thead>
              <tbody>
                {tierRows.map(([feature, wallet, tierOne, verified]) => (
                  <tr key={feature} className="border-t border-[var(--sp-border)]">
                    <td className="px-4 py-4 font-semibold text-[var(--sp-ink)]">{feature}</td>
                    <td className="px-4 py-4 text-[var(--sp-muted)]">{wallet}</td>
                    <td className="px-4 py-4 text-[var(--sp-muted)]">{tierOne}</td>
                    <td className="px-4 py-4 text-[var(--sp-muted)]">{verified}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--sp-border)] bg-[#101817] text-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-6 py-14 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-center lg:px-10">
          <div>
            <h2 className="text-3xl font-semibold leading-tight">Build on Stellar without rebuilding checkout.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/68">
              Start with a hosted link. Add the SDK when you need a fully custom flow.
            </p>
          </div>
          <Link
            href="/connect"
            className="inline-flex items-center justify-center rounded-md bg-white px-5 py-3 text-sm font-semibold text-[#101817] transition-colors hover:bg-[#eaf8f2]"
          >
            Create a payment link
          </Link>
        </div>
      </section>
    </div>
  );
}
