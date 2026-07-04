import Link from "next/link";

const integrationPaths = [
  {
    label: "Hosted checkout",
    title: "Create a link. Send it anywhere.",
    body: "Spin up a checkout page for one-time payments or subscriptions, then let the payer sign from their Stellar wallet.",
  },
  {
    label: "Embedded button",
    title: "Drop payments into your own flow.",
    body: "Use the React button to connect Freighter, set up trustlines, sign, submit, and record customer identity.",
  },
  {
    label: "Headless SDK",
    title: "Own the interface end to end.",
    body: "Build custom checkout with unsigned XDR builders, API records, webhooks, and on-chain settlement primitives.",
  },
];

const proofPoints = [
  "Wallet-to-wallet settlement on Stellar testnet",
  "One-time payments and recurring subscription pulls",
  "Typed resource IDs, webhooks, API keys, and dashboard records",
];

const steps = [
  ["Create", "A merchant creates a product link or subscription plan with a Stellar asset and amount."],
  ["Share", "Customers open a hosted checkout, embedded button, or custom SDK-powered flow."],
  ["Sign", "The payer authorizes the transaction once from their wallet. Subscriptions approve a capped allowance."],
  ["Settle", "Funds move on-chain, events are recorded, and webhooks keep the merchant stack in sync."],
];

export default function Home() {
  return (
    <div className="bg-[#f6f7f4] text-[#101817]">
      <section className="relative isolate min-h-[calc(100svh-8rem)] overflow-hidden">
        <div
          className="absolute inset-0 -z-20 bg-cover bg-center"
          style={{ backgroundImage: "url('/brand/landing-hero.png')" }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(5,14,18,0.94)_0%,rgba(5,14,18,0.86)_34%,rgba(5,14,18,0.44)_68%,rgba(5,14,18,0.18)_100%)]"
          aria-hidden="true"
        />

        <div className="mx-auto flex min-h-[calc(100svh-8rem)] max-w-7xl flex-col justify-between px-6 py-12 sm:px-8 lg:px-10">
          <div className="max-w-3xl pt-8 text-white sm:pt-14">
            <p className="mb-5 inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-[#d8f7ee] backdrop-blur">
              Payments infrastructure for Stellar
            </p>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[0.98] tracking-normal text-white sm:text-7xl lg:text-8xl">
              StellarPay
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/78 sm:text-xl">
              Accept one-time and recurring payments in Stellar assets with hosted checkout links, an embeddable React button, or a headless SDK.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/connect"
                className="inline-flex items-center justify-center rounded-md bg-[#eaf8f2] px-5 py-3 text-sm font-semibold text-[#0b1716] shadow-sm transition-colors hover:bg-white"
              >
                Create a payment link
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center justify-center rounded-md border border-white/30 px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-white/60 hover:bg-white/10"
              >
                Read the docs
              </Link>
            </div>
          </div>

          <div className="grid gap-3 pt-12 text-white/78 sm:grid-cols-3">
            {proofPoints.map((point) => (
              <div key={point} className="border-t border-white/20 pt-3 text-sm leading-6">
                {point}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[#d9ded7] bg-[#fbfcf8]">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-14 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-10">
          <div>
            <p className="text-sm font-semibold text-[#217669]">Built for merchant workflows</p>
            <h2 className="mt-3 max-w-xl text-3xl font-semibold leading-tight text-[#101817] sm:text-4xl">
              Checkout that feels simple, with settlement that stays transparent.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-[#d9ded7] bg-white p-5">
              <p className="text-sm font-semibold text-[#101817]">1% platform fee</p>
              <p className="mt-2 text-sm leading-6 text-[#596461]">
                Fee splitting happens in the contract, so merchants and the platform receive their shares automatically.
              </p>
            </div>
            <div className="rounded-lg border border-[#d9ded7] bg-white p-5">
              <p className="text-sm font-semibold text-[#101817]">Non-custodial by default</p>
              <p className="mt-2 text-sm leading-6 text-[#596461]">
                Payers sign with their own wallet. StellarPay coordinates checkout, records, and automation without holding funds.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 sm:px-8 lg:px-10">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-[#217669]">Three integration paths</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
            Start no-code, stay programmable.
          </h2>
        </div>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {integrationPaths.map((path) => (
            <article key={path.label} className="rounded-lg border border-[#d7ddd7] bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase text-[#217669]">{path.label}</p>
              <h3 className="mt-4 text-xl font-semibold text-[#101817]">{path.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#596461]">{path.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-[#101817] text-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:px-10">
          <div>
            <p className="text-sm font-semibold text-[#83d9c8]">How it works</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
              A short path from intent to settled payment.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {steps.map(([title, body], index) => (
              <div key={title} className="rounded-lg border border-white/12 bg-white/[0.04] p-5">
                <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-md bg-[#d6b66d] text-sm font-semibold text-[#101817]">
                  {index + 1}
                </div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/68">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-20 sm:px-8 lg:grid-cols-[1fr_1fr] lg:px-10">
        <div>
          <p className="text-sm font-semibold text-[#217669]">Subscriptions without re-signing</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
            Recurring billing on a wallet-native rail.
          </h2>
          <p className="mt-5 text-base leading-8 text-[#596461]">
            Customers approve a capped allowance once. The platform admin key can then charge each billing cycle automatically, while the contract enforces cadence and fee rules.
          </p>
        </div>
        <div className="rounded-lg border border-[#d7ddd7] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#e5e9e3] pb-4">
            <div>
              <p className="text-sm font-semibold">Pro subscription</p>
              <p className="mt-1 text-xs text-[#6a7470]">plan_01KWM...</p>
            </div>
            <span className="rounded-full bg-[#e8f7f2] px-3 py-1 text-xs font-semibold text-[#17695e]">
              Active
            </span>
          </div>
          <div className="grid gap-4 py-5 sm:grid-cols-3">
            <div>
              <p className="text-xs text-[#6a7470]">Amount</p>
              <p className="mt-1 font-semibold">25.00 USDC</p>
            </div>
            <div>
              <p className="text-xs text-[#6a7470]">Cadence</p>
              <p className="mt-1 font-semibold">Monthly</p>
            </div>
            <div>
              <p className="text-xs text-[#6a7470]">Next charge</p>
              <p className="mt-1 font-semibold">Aug 4</p>
            </div>
          </div>
          <div className="rounded-md bg-[#f6f7f4] p-4 text-sm leading-6 text-[#596461]">
            Webhooks notify the merchant stack when a subscription is charged, retried, past due, or canceled.
          </div>
        </div>
      </section>

      <section className="border-t border-[#d9ded7] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-14 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <div>
            <h2 className="text-3xl font-semibold leading-tight text-[#101817]">
              Build on Stellar without rebuilding checkout.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#596461]">
              Try the hosted platform first, then move deeper into the SDK as your product needs more control.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/connect"
              className="inline-flex items-center justify-center rounded-md bg-[#101817] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#24312f]"
            >
              Open the platform
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center justify-center rounded-md border border-[#cdd5cf] px-5 py-3 text-sm font-semibold text-[#101817] transition-colors hover:border-[#101817]"
            >
              Explore SDK docs
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
