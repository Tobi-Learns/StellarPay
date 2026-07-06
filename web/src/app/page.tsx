import Link from "next/link";
import { BrandLogo } from "@/components/brand";

const proofPoints = [
  "Hosted links, embedded button, and headless SDK",
  "One-time checkout plus recurring subscription pulls",
  "Live billing automation, webhooks, API keys, and dashboard records",
];

const integrationPaths = [
  {
    label: "Hosted checkout",
    title: "Create a link. Send it anywhere.",
    body: "Use StellarPay's hosted checkout for one-time payments or subscriptions without building payment UI.",
  },
  {
    label: "Embedded button",
    title: "Drop payments into your own flow.",
    body: "Add a React button that connects Freighter, prepares trustlines, signs, submits, and records customer identity.",
  },
  {
    label: "Headless SDK",
    title: "Own the interface end to end.",
    body: "Build custom checkout with XDR builders, typed API records, HMAC webhooks, and on-chain settlement primitives.",
  },
];

const steps = [
  ["Create", "Connect a merchant wallet and create a payment link or subscription plan."],
  ["Share", "Send a hosted URL, embed a button, or route customers through your own SDK-powered checkout."],
  ["Sign", "Customers sign once to pay. Subscriptions sign approve plus subscribe, then renew without repeat signatures."],
  ["Settle", "Funds move wallet to wallet on Stellar; events, receipts, webhooks, and dashboard records update around the transaction."],
];

const comparisonRows = [
  ["Crypto gateways", "Fast no-KYC onboarding, usually one-time checkout only."],
  ["Stripe", "Excellent subscriptions, but business registration and country gates still decide who gets in."],
  ["StellarPay", "A wallet is the merchant account: one-time payments, subscriptions, SDK, webhooks, and automated billing."],
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
          className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(5,14,18,0.95)_0%,rgba(5,14,18,0.88)_34%,rgba(5,14,18,0.48)_68%,rgba(5,14,18,0.2)_100%)]"
          aria-hidden="true"
        />

        <div className="mx-auto flex min-h-[calc(100svh-8rem)] max-w-7xl flex-col justify-between px-6 py-12 sm:px-8 lg:px-10">
          <div className="max-w-3xl pt-8 text-white sm:pt-14">
            <BrandLogo tone="light" showDescriptor className="mb-6" />
            <h1 className="max-w-3xl text-5xl font-semibold leading-[0.98] tracking-normal text-white sm:text-7xl lg:text-8xl">
              StellarPay
            </h1>
            <p className="mt-7 max-w-2xl text-xl font-medium leading-9 text-white sm:text-2xl">
              Turn every wallet into an online bank account.
            </p>
            <p className="mt-5 max-w-xl border-l-2 border-[#8ee8d0] pl-4 text-sm font-medium leading-6 text-[#d8f7ee]/90 sm:text-base sm:leading-7">
              StellarPay bridges the adoption gap by letting customers pay, subscribe, and repay from wallets they own.
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
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-10">
          <div>
            <p className="text-sm font-semibold text-[#217669]">The wedge</p>
            <h2 className="mt-3 max-w-xl text-3xl font-semibold leading-tight text-[#101817] sm:text-4xl">
              Small businesses need Stripe&apos;s workflow, without Stripe&apos;s gate.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-8 text-[#596461]">
              Crypto gateways can onboard quickly, but most stop at one-time payments. Stripe has subscriptions, but access still depends on registration, banking, and geography. StellarPay combines permissionless wallet onboarding with a complete processor surface.
            </p>
          </div>
          <div className="self-start overflow-hidden rounded-lg border border-[#d9ded7] bg-white shadow-sm">
            {comparisonRows.map(([label, body], index) => (
              <div
                key={label}
                className={`grid gap-3 p-5 sm:grid-cols-[11rem_1fr] ${index > 0 ? "border-t border-[#e5e9e3]" : ""}`}
              >
                <p className="text-sm font-semibold text-[#101817]">{label}</p>
                <p className="text-sm leading-6 text-[#596461]">{body}</p>
              </div>
            ))}
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
            Bank-Style Subscriptions for Wallets.
          </h2>
          <p className="mt-5 text-base leading-8 text-[#596461]">
            StellarPay treats every connected wallet like an online bank account for subscriptions. Customers approve once, just like saving a card for recurring payments, then repayments run automatically each cycle with no repeat signatures and no manual follow-up.
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
            The allowance remains capped on-chain, and webhooks notify the merchant stack when a subscription is charged, retried, past due, reauthorized, or canceled.
          </div>
        </div>
      </section>

      <section className="border-t border-[#d9ded7] bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-6 py-14 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-center lg:px-10">
          <div>
            <h2 className="text-3xl font-semibold leading-tight text-[#101817]">
              One percent, no payout layer, no custody.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#596461]">
              Price is not the whole product. The point is simple: wallet-native checkout, recurring billing, and an all-in fee model on Stellar rails.
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
              href="/pricing"
              className="inline-flex items-center justify-center rounded-md border border-[#cdd5cf] px-5 py-3 text-sm font-semibold text-[#101817] transition-colors hover:border-[#101817]"
            >
              Compare pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
