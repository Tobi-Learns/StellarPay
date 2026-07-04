"use client";

import { useState } from "react";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold mb-4">{children}</h2>;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold mt-6 mb-2">{children}</h3>;
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="text-xs bg-neutral-100 text-neutral-800 px-1.5 py-0.5 rounded font-mono">
      {children}
    </code>
  );
}

function Pre({ children }: { children: string }) {
  // Color is set inline rather than via `text-neutral-100`: that class is used
  // nowhere else in the app, so Tailwind's content scan never emits it and the
  // code text would fall back to the dark body color (invisible on the dark bg).
  return (
    <pre
      className="text-xs bg-neutral-900 rounded-lg p-4 overflow-x-auto mb-4 leading-relaxed"
      style={{ color: "#e5e5e5" }}
    >
      <code>{children}</code>
    </pre>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-neutral-600 mb-3 leading-relaxed">{children}</p>;
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-sm text-neutral-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 leading-relaxed">
      {children}
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto mb-6">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-neutral-200">
            {headers.map((h) => (
              <th key={h} className="text-left py-2 pr-4 text-neutral-500 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-neutral-100">
              {row.map((cell, j) => (
                <td key={j} className="py-2 pr-4 align-top font-mono text-neutral-700">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const sections: { id: string; label: string; description: string; content: React.ReactNode }[] = [
  {
    id: "quickstart",
    label: "Quickstart",
    description:
      "Install the SDK and take your first payment in a few lines — build an unsigned XDR, have the payer's wallet sign it, and submit on-chain.",
    content: (
      <>
        <Pre>{`npm install @stellarpay/sdk @stellar/stellar-sdk`}</Pre>
        <Pre>{`import { StellarPayClient, TESTNET, parseUsdc } from "@stellarpay/sdk";

const client = new StellarPayClient({
  ...TESTNET,                                  // deployed testnet config
  apiBase: "https://your-stellarpay-app.vercel.app",
});

// Build a pay XDR, sign it with the payer's wallet, submit on-chain
const xdr    = await client.buildPayXdr(payer, merchant, parseUsdc("5.00"), linkId);
const signed = await signWithWallet(xdr);      // Freighter today — see Limitations
const hash   = await client.submitAndWait(signed);`}</Pre>
        <P>Server-side calls that write to the hosted DB (creating links/plans, listing) authenticate with an API key generated from <Code>/app/developers</Code>. On-chain writes need no key — they&apos;re authorized by the wallet signature. Amounts are always <Code>bigint</Code> stroops (7 decimals); use <Code>parseUsdc</Code>/<Code>formatUsdc</Code> to convert.</P>
      </>
    ),
  },
  {
    id: "client",
    label: "StellarPayClient",
    description:
      "Configure the client every SDK call runs through — network preset, API base, and the one-time USDC trustline setup.",
    content: (
      <>
        <P>All SDK functionality is accessed through a <Code>StellarPayClient</Code> instance.</P>
        <Pre>{`new StellarPayClient(config: StellarPayConfig)`}</Pre>
        <Table
          headers={["Config field", "Type", "Description"]}
          rows={[
            ["apiBase", "string", "Base URL of your hosted StellarPay app"],
            ["contractId", "string", "Deployed StellarPay contract address"],
            ["sacAddress", "string", "SAC address of the accepted asset (test USDC)"],
            ["rpcUrl", "string", "Soroban RPC endpoint"],
            ["networkPassphrase", "string", "Stellar network passphrase"],
            ["horizonUrl?", "string", "Horizon REST base — enables automatic trustline setup"],
            ["classicAsset?", "{ code, issuer }", "The classic asset the SAC wraps — used for trustline detection"],
          ]}
        />
        <P>Use the <Code>TESTNET</Code> preset to fill everything except <Code>apiBase</Code>:</P>
        <Pre>{`import { TESTNET } from "@stellarpay/sdk";
// TESTNET = { contractId, sacAddress, rpcUrl, horizonUrl, networkPassphrase, classicAsset }

const client = new StellarPayClient({ ...TESTNET, apiBase: "https://..." });`}</Pre>
        <P>Before any payment or subscribe call, make sure the wallet has a USDC trustline. <Code>buildTrustlineXdr(address)</Code> returns a CHANGE_TRUST XDR to sign if one is missing, or <Code>null</Code> if it already exists:</P>
        <Pre>{`const trustlineXdr = await client.buildTrustlineXdr(payer);
if (trustlineXdr) await client.submitAndWait(await signWithWallet(trustlineXdr));`}</Pre>
      </>
    ),
  },
  {
    id: "payments",
    label: "One-time payments",
    description:
      "Accept a single payment three ways — hosted link, embedded button, or fully headless — all settling the same on-chain pay call.",
    content: (
      <>
        <P>Three integration patterns, simplest first. All settle the same <Code>pay</Code> contract call.</P>

        <H3>1 · Hosted link</H3>
        <P>Create a payment link server-side, then redirect the customer to the hosted checkout at <Code>/pay/:numericId</Code>. Zero front-end payment code.</P>
        <Pre>{`import { snowflakeU64, parseUsdc } from "@stellarpay/sdk";

const link = await client.createPaymentLink({
  numericId:   snowflakeU64().toString(),   // canonical link id → /pay/:numericId AND on-chain link_id
  merchant:    "G...",
  amount:      parseUsdc("5.00").toString(), // stroops, as a string
  productName: "Premium Coffee Bundle",      // required — shown across the dashboard
  description: "1kg single-origin",          // optional
});

// Redirect the customer to:  \`\${apiBase}/pay/\${link.numericId}\``}</Pre>

        <H3>2 · Embedded button</H3>
        <P>Drop <Code>{"<StellarPayButton>"}</Code> onto your page. It connects Freighter, auto-sets up the trustline, then builds, signs, and submits the payment inline — no signing code on your side.</P>
        <Pre>{`import { StellarPayButton } from "@stellarpay/sdk/react";
import { TESTNET, parseUsdc } from "@stellarpay/sdk";

<StellarPayButton
  config={{ ...TESTNET, apiBase: "https://your-app.vercel.app" }}
  merchant="G..."
  amount={parseUsdc("5.00")}
  linkId={BigInt(numericId)}
  payerName="Alice"                 // when provided, the button records the
  payerEmail="alice@example.com"    // payment.settled event for you (idempotent)
  onSuccess={(hash) => console.log("paid", hash)}
/>`}</Pre>
        <P>When <Code>payerName</Code>/<Code>payerEmail</Code> are set, the button fire-and-forgets <Code>recordPaymentSettled</Code> after settlement, so the merchant dashboard and webhooks carry customer identity. <Code>signXdr</Code> is an optional escape hatch for non-Freighter wallets.</P>

        <H3>3 · Headless</H3>
        <P>Build your own UI with the raw SDK methods — full control over UX.</P>
        <Pre>{`import { parseUsdc } from "@stellarpay/sdk";

// 1. Trustline (see StellarPayClient), then build + submit the payment
const xdr  = await client.buildPayXdr(payer, merchant, parseUsdc("5.00"), BigInt(numericId));
const hash = await client.submitAndWait(await signWithWallet(xdr));

// 2. Record the settled payment so the dashboard + webhooks see it
await client.recordPaymentSettled({
  txHash:      hash,
  merchant,
  amount:      parseUsdc("5.00").toString(),
  linkId:      numericId,          // same value passed to buildPayXdr
  payerName:   "Alice",
  payerEmail:  "alice@example.com",
  payerWallet: payer,
});`}</Pre>
        <P><Code>recordPaymentSettled</Code> is idempotent by <Code>txHash</Code> — recording the same payment twice is a no-op — and may be called cross-origin from the browser.</P>
      </>
    ),
  },
  {
    id: "subscriptions",
    label: "Subscriptions",
    description:
      "Set up recurring billing on real calendar time: the subscriber approves a spending allowance once, then the platform charges each cycle automatically.",
    content: (
      <>
        <P>Billing runs on real calendar time. A plan stores its interval as <Code>{"{ unit, count }"}</Code> (e.g. monthly); the contract only enforces a cadence floor (<Code>min_interval_secs</Code>) and the backend owns exact dates. After the subscriber approves a spending allowance once, the platform charges each cycle automatically — no further subscriber signature.</P>

        <H3>Create a plan</H3>
        <Pre>{`import { minIntervalSeconds, snowflakeU64, parseUsdc } from "@stellarpay/sdk";

const interval = { unit: "month", count: 1 };   // real calendar interval

// 1. Create on-chain (merchant signs). The caller supplies the Snowflake plan id.
const planId = snowflakeU64();
const xdr = await client.buildCreatePlanXdr(
  merchantAddress,
  parseUsdc("1.00"),               // amount per cycle (stroops)
  minIntervalSeconds(interval),    // on-chain cadence floor, in seconds
  planId,
);
await client.submitAndWait(await signWithWallet(xdr));

// 2. Register in the hosted DB (carries the real interval for date math)
await client.registerPlan({
  onChainId:     planId.toString(),
  merchant:      merchantAddress,
  amount:        parseUsdc("1.00").toString(),
  productName:   "Pro plan",
  interval:      minIntervalSeconds(interval),
  intervalLabel: "Monthly",
  intervalUnit:  interval.unit,
  intervalCount: interval.count,
});`}</Pre>

        <H3>Subscribe</H3>
        <Pre>{`import { firstNextChargeAt, toUnixSeconds, snowflakeU64, parseUsdc } from "@stellarpay/sdk";

// Step 1: subscriber approves a SAC allowance (one-time signature).
// The cap is in stroops; the expiry is a ledger sequence.
const ledger = await client.getCurrentLedger();
const approveXdr = await client.buildApproveXdr(
  subscriberAddress,
  parseUsdc("1.00") * 1000n,   // cap = amount × 1000 (headroom for many cycles)
  ledger + 535_680,            // ~1 year of ledgers
);
await client.submitAndWait(await signWithWallet(approveXdr));

// Step 2: subscribe — runs the first charge immediately.
// Anchor to now, compute the first next-charge date, supply a Snowflake sub id.
const anchor       = new Date();
const nextChargeAt = toUnixSeconds(firstNextChargeAt(anchor, interval));
const subId        = snowflakeU64();
const subscribeXdr = await client.buildSubscribeXdr(subscriberAddress, planId, nextChargeAt, subId);
await client.submitAndWait(await signWithWallet(subscribeXdr));

// Step 3: register in the DB. anchorAt is the origin for all future billing dates.
await client.registerSubscription({
  onChainId:     subId.toString(),
  planOnChainId: planId.toString(),
  subscriber:    subscriberAddress,
  merchant:      merchantAddress,
  amount:        parseUsdc("1.00").toString(),
  payerName:     "Alice",
  payerEmail:    "alice@example.com",
  anchorAt:      anchor.toISOString(),
});`}</Pre>
        <P>Recurring charges after the first are made server-side by the platform/admin key on a schedule — the merchant and subscriber never re-sign. Downtime is collected as one catch-up charge for all elapsed periods, bounded by the cadence floor and the approved allowance.</P>

        <H3>Cancel and read</H3>
        <Pre>{`// Cancel (subscriber signs)
const xdr = await client.buildCancelXdr(subscriberAddress, subId);
await client.submitAndWait(await signWithWallet(xdr));

// On-chain read views
const plan = await client.getPlan(planId);
// → { id, merchant, asset, amount, min_interval_secs, active }
const sub  = await client.getSubscription(subId);
// → { id, plan_id, subscriber, status, next_charge_at, created_at }  (unix seconds)`}</Pre>
      </>
    ),
  },
  {
    id: "identity",
    label: "Customer identity",
    description:
      "Attach the payer's name and email so purchases are identifiable on the merchant dashboard and in webhook payloads.",
    content: (
      <>
        <P>Attach who paid so it shows on the merchant dashboard and in webhook payloads. The fields are optional everywhere:</P>
        <Table
          headers={["Where", "Fields"]}
          rows={[
            ["<StellarPayButton>", "payerName, payerEmail props"],
            ["recordPaymentSettled()", "payerName, payerEmail, payerWallet"],
            ["registerSubscription()", "payerName, payerEmail"],
            ["Hosted checkout pages", "collected from the customer on /pay and /subscribe"],
          ]}
        />
      </>
    ),
  },
  {
    id: "rest-api",
    label: "REST API",
    description:
      "The HTTP endpoints behind the SDK for creating and listing payment links, plans, subscriptions, events, and API keys.",
    content: (
      <>
        <P>All endpoints are relative to your <Code>apiBase</Code>. Request and response bodies are JSON.</P>

        <H3>Payment links</H3>
        <Table
          headers={["Method", "Path", "Description"]}
          rows={[
            ["GET",   "/api/payments?merchant=", "List payment links (with settled counts + volume)"],
            ["POST",  "/api/payments",           "Create a link — requires numericId, merchant, amount, productName"],
            ["GET",   "/api/payments/:numericId","Get a single link by numericId"],
            ["PATCH", "/api/payments/:numericId","Archive/restore or edit productName/description"],
          ]}
        />

        <H3>Plans</H3>
        <Table
          headers={["Method", "Path", "Description"]}
          rows={[
            ["GET",   "/api/plans?merchant=", "List plans (with subscriber counts)"],
            ["POST",  "/api/plans",           "Register a plan (after on-chain create_plan)"],
            ["GET",   "/api/plans/:planId",   "Get a plan by onChainId (includes subscriptions)"],
            ["PATCH", "/api/plans/:planId",   "Archive/restore or edit productName/description"],
          ]}
        />

        <H3>Subscriptions</H3>
        <Table
          headers={["Method", "Path", "Description"]}
          rows={[
            ["GET",   "/api/subscriptions?merchant=",   "List subscriptions for a merchant"],
            ["GET",   "/api/subscriptions?subscriber=", "List subscriptions for a subscriber"],
            ["POST",  "/api/subscriptions",             "Register a subscription"],
            ["GET",   "/api/subscriptions/:id",         "Get by onChainId (joined plan + events)"],
            ["PATCH", "/api/subscriptions/:id",         "Update subscription status"],
          ]}
        />

        <H3>Events</H3>
        <Table
          headers={["Method", "Path", "Description"]}
          rows={[
            ["GET",  "/api/events?merchant=&type=", "List events (joined link/plan context)"],
            ["GET",  "/api/events/:txHash",         "Get a single settled payment by txHash"],
            ["POST", "/api/events",                 "Write an event (triggers webhooks)"],
          ]}
        />

        <H3>API keys</H3>
        <Table
          headers={["Method", "Path", "Description"]}
          rows={[
            ["GET",    "/api/keys?merchant=", "List active API keys"],
            ["POST",   "/api/keys",           "Generate a new key (secret returned once)"],
            ["DELETE", "/api/keys/:id",       "Revoke a key"],
          ]}
        />

        <H3>Webhooks</H3>
        <Table
          headers={["Method", "Path", "Description"]}
          rows={[
            ["GET",    "/api/webhooks?merchant=", "List active webhook endpoints"],
            ["POST",   "/api/webhooks",           "Register an endpoint (secret returned once)"],
            ["DELETE", "/api/webhooks/:id",       "Remove an endpoint"],
          ]}
        />
      </>
    ),
  },
  {
    id: "webhooks",
    label: "Webhooks",
    description:
      "Receive signed, real-time events when payments settle and subscriptions charge, go past due, or cancel.",
    content: (
      <>
        <P>StellarPay signs every delivery with <Code>HMAC-SHA256</Code>. Verify the signature before processing.</P>

        <H3>Event types</H3>
        <Table
          headers={["Type", "Triggered when"]}
          rows={[
            ["payment.settled",        "A one-time payment is confirmed on-chain"],
            ["subscription.charged",   "A billing cycle is pulled successfully"],
            ["subscription.past_due",  "A charge fails due to insufficient allowance/balance"],
            ["subscription.canceled",  "A subscriber cancels, or billing is canceled after failed retries"],
          ]}
        />

        <H3>Payload shape</H3>
        <P>The <Code>data</Code> object carries the event&apos;s <Code>evt_</Code> id, the <Code>txHash</Code>, and the event-specific fields.</P>
        <Pre>{`{
  "type": "subscription.charged",
  "data": {
    "id":     "evt_01KWMC2JJEN0XP5869S47403X8",  // evt_ external id
    "txHash": "abc123...",
    "subId":  "331376467167703055",              // on-chain subscription id
    "status": "Active"
  },
  "created": 1751234567                            // Unix seconds
}`}</Pre>

        <H3>Signature header</H3>
        <Pre>{`Stellarpay-Signature: t=1751234567,v1=<hmac_sha256_hex>`}</Pre>
        <P>The HMAC is computed over <Code>{"`${t}.${rawBody}`"}</Code> using your endpoint&apos;s signing secret (<Code>whsec_...</Code>).</P>

        <H3>Verification example</H3>
        <Pre>{`import { createHmac } from "node:crypto";

function verifySignature(rawBody: string, header: string, secret: string): boolean {
  const parts    = Object.fromEntries(header.split(",").map(p => p.split("=")));
  const expected = createHmac("sha256", secret)
    .update(\`\${parts.t}.\${rawBody}\`)
    .digest("hex");
  return expected === parts.v1;
}`}</Pre>
      </>
    ),
  },
  {
    id: "ids",
    label: "Resource IDs",
    description:
      "How StellarPay identifies objects — external typed ids for your app and API, and on-chain Snowflake ids for the contract.",
    content: (
      <>
        <P>Two ID planes. Don&apos;t mix them:</P>
        <Table
          headers={["Plane", "Format", "Used by"]}
          rows={[
            ["External", "plink_ / plan_ / sub_ / evt_  + ULID", "Dashboard, API responses, webhooks, support"],
            ["On-chain", "Snowflake u64 (bigint)", "Contract calls: link_id, plan_id, sub_id"],
          ]}
        />
        <P>External ids are opaque, typed, k-sortable strings generated with <Code>newId(prefix)</Code>. On-chain ids come from <Code>snowflakeU64()</Code> and exceed JS&apos;s safe integer range — always carry them as <Code>bigint</Code> or <Code>string</Code>, never <Code>Number</Code>. For payment links the same Snowflake is both the <Code>numericId</Code> (the <Code>/pay</Code> URL param) and the on-chain <Code>link_id</Code>.</P>
      </>
    ),
  },
  {
    id: "types",
    label: "Types",
    description:
      "The TypeScript shapes accepted and returned across the SDK — config, records, and enums.",
    content: (
      <>
        <Pre>{`// SDK config
interface StellarPayConfig {
  apiBase:           string;
  contractId:        string;
  sacAddress:        string;
  rpcUrl:            string;
  networkPassphrase: string;
  horizonUrl?:       string;
  classicAsset?:     { code: string; issuer: string };
}

// Billing interval (real calendar units)
interface Interval {
  unit:  "minute" | "day" | "week" | "month" | "year";
  count: number;
}

// On-chain types (read views)
interface Plan {
  id: bigint; merchant: string; asset: string;
  amount: bigint; min_interval_secs: number; active: boolean;
}

interface Subscription {
  id: bigint; plan_id: bigint; subscriber: string;
  status: "Active" | "PastDue" | "Canceled";
  next_charge_at: number; created_at: number;   // unix seconds
}

// DB record types (mirror the API responses)
interface PaymentLinkRecord {
  id: string; extId: string; numericId: string; merchant: string;
  amount: string; productName: string; description?: string;
  archivedAt?: string | null; createdAt: string;
}

interface PlanRecord {
  id: string; extId: string; onChainId: string; merchant: string;
  amount: string; productName: string; description?: string;
  interval: number; intervalLabel: string;
  intervalUnit: string; intervalCount: number;
  archivedAt?: string | null; createdAt: string;
}

interface SubscriptionRecord {
  id: string; extId: string; onChainId: string; planOnChainId: string;
  subscriber: string; merchant: string; amount: string;
  payerName?: string; payerEmail?: string; status: string;
  anchorAt?: string; periodsCharged?: number;
  createdAt: string; updatedAt: string;
}`}</Pre>

        <H3>Billing schedule helpers</H3>
        <Pre>{`import {
  minIntervalSeconds, firstNextChargeAt, billingDateAfter,
  computeCatchUp, toUnixSeconds,
} from "@stellarpay/sdk";

minIntervalSeconds({ unit: "month", count: 1 })         // on-chain cadence floor (seconds)
firstNextChargeAt(anchor, { unit: "month", count: 1 })  // Date of the first next charge
toUnixSeconds(date)                                     // Date → unix seconds`}</Pre>

        <H3>Amount helpers</H3>
        <Pre>{`import { formatUsdc, parseUsdc } from "@stellarpay/sdk";

parseUsdc("1.50")       // → 15_000_000n
formatUsdc(15_000_000n) // → "1.50"`}</Pre>
      </>
    ),
  },
  {
    id: "limitations",
    label: "Limitations & mobile",
    description:
      "What's supported today — Freighter browser signing — and what's coming next, including mobile and QR checkout.",
    content: (
      <>
        <Note>
          <strong>Signing is browser-wallet only today.</strong> The SDK returns unsigned XDR and you bring the signature — the current supported path is <Code>Freighter</Code> in a desktop browser. The hosted checkout pages require a browser wallet too.
        </Note>
        <P>Planned for Phase 5 (additive — no breaking changes to the calls above):</P>
        <Table
          headers={["Coming", "What it adds"]}
          rows={[
            ["SEP-0007 QR", "Encode a payment as a web+stellar: URI + QR on hosted checkout for mobile wallets"],
            ["WalletConnect v2", "LOBSTR + WalletConnect signing path for mobile payers"],
            ["Responsive checkout", "Hosted /pay and /subscribe adapt to narrow viewports"],
          ]}
        />
        <P>Everything runs on Stellar <strong>testnet</strong> today. Treat the deployed contract, SAC, and demo assets as disposable — do not send real value.</P>
      </>
    ),
  },
];

export default function DocsPage() {
  const [active, setActive] = useState(sections[0].id);
  const current = sections.find((s) => s.id === active) ?? sections[0];

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col lg:flex-row">

      {/* Full-height section sidebar */}
      <aside className="border-b border-[var(--sp-border)] bg-[var(--sp-paper)] px-4 py-3 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r lg:py-8">
        <p className="hidden px-3 pb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--sp-muted)]/70 lg:block">
          Documentation
        </p>
        <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-0.5 lg:overflow-visible">
          {sections.map(({ id, label }) => {
            const isActive = id === active;
            return (
              <button
                key={id}
                onClick={() => setActive(id)}
                aria-current={isActive ? "page" : undefined}
                className={`min-w-max rounded-md px-3 py-2 text-left text-sm transition-colors lg:min-w-0 ${
                  isActive
                    ? "bg-[var(--sp-mist)] font-medium text-[var(--sp-ink)]"
                    : "text-[var(--sp-muted)] hover:bg-[var(--sp-mist)]/60 hover:text-[var(--sp-ink)]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* White content — fills from the sidebar edge to the far right */}
      <div className="min-w-0 flex-1 bg-white px-6 py-8 sm:px-8 lg:px-12 lg:py-10">
        <div className="max-w-3xl">
          <p className="mb-2 text-sm font-semibold text-[var(--sp-muted)]">Documentation</p>
          <h1 className="mb-3 text-3xl font-bold tracking-tight text-[var(--sp-ink)]">{current.label}</h1>
          <p className="text-base leading-relaxed text-[var(--sp-muted)]">{current.description}</p>
          <div className="mt-10">{current.content}</div>
        </div>
      </div>
    </div>
  );
}
