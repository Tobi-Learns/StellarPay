import type { Metadata } from "next";

export const metadata: Metadata = { title: "Docs — StellarPay" };

const nav = [
  { id: "quickstart", label: "Quickstart" },
  { id: "client", label: "StellarPayClient" },
  { id: "payments", label: "One-time payments" },
  { id: "subscriptions", label: "Subscriptions" },
  { id: "rest-api", label: "REST API" },
  { id: "webhooks", label: "Webhooks" },
  { id: "types", label: "Types" },
];

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-lg font-semibold mt-12 mb-4 scroll-mt-8">
      {children}
    </h2>
  );
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
  return (
    <pre className="text-xs bg-neutral-900 text-neutral-100 rounded-lg p-4 overflow-x-auto mb-4 leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-neutral-600 mb-3 leading-relaxed">{children}</p>;
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

export default function DocsPage() {
  return (
    <div className="flex max-w-6xl mx-auto px-6 py-10 gap-12">

      {/* Sidebar */}
      <aside className="hidden lg:block w-44 shrink-0">
        <div className="sticky top-8">
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-3">On this page</p>
          <nav className="flex flex-col gap-1">
            {nav.map(({ id, label }) => (
              <a key={id} href={`#${id}`} className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors py-0.5">
                {label}
              </a>
            ))}
          </nav>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0 max-w-3xl">
        <h1 className="text-2xl font-bold mb-2">StellarPay Developer Docs</h1>
        <P>Accept one-time and recurring payments on Stellar via the JS/TS SDK or the REST API.</P>

        {/* ── Quickstart ───────────────────────────────────────────────── */}
        <H2 id="quickstart">Quickstart</H2>
        <Pre>{`npm install @stellarpay/sdk @stellar/stellar-sdk`}</Pre>
        <Pre>{`import { StellarPayClient, TESTNET } from "@stellarpay/sdk";

const client = new StellarPayClient({
  ...TESTNET,
  apiBase: "https://your-stellarpay-app.vercel.app",
});

// Build a pay XDR, sign it with the user's wallet, submit
const xdr    = await client.buildPayXdr(payer, merchant, 50_000_000n, linkId);
const signed = await yourWallet.sign(xdr);
const hash   = await client.submitAndWait(signed);`}</Pre>

        {/* ── StellarPayClient ─────────────────────────────────────────── */}
        <H2 id="client">StellarPayClient</H2>
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
          ]}
        />
        <P>Use the <Code>TESTNET</Code> preset to fill all fields except <Code>apiBase</Code>:</P>
        <Pre>{`import { TESTNET } from "@stellarpay/sdk";
// TESTNET = { contractId, sacAddress, rpcUrl, networkPassphrase }

const client = new StellarPayClient({ ...TESTNET, apiBase: "https://..." });`}</Pre>

        {/* ── One-time payments ────────────────────────────────────────── */}
        <H2 id="payments">One-time payments</H2>
        <H3>Create a payment link</H3>
        <Pre>{`const link = await client.createPaymentLink({
  numericId:   snowflakeU64().toString(),  // canonical link id → /pay/:numericId
  merchant:    "G...",
  amount:      "50000000",                 // stroops (5 USDC)
  description: "Coffee",
});`}</Pre>

        <H3>Build and submit a payment</H3>
        <Pre>{`const xdr    = await client.buildPayXdr(payerAddress, merchantAddress, 50_000_000n, BigInt(link.numericId));
const signed = await signXdr(xdr);   // your wallet integration
const hash   = await client.submitAndWait(signed);`}</Pre>

        <H3>List payment links</H3>
        <Pre>{`const links = await client.listPaymentLinks(merchantAddress);`}</Pre>

        {/* ── Subscriptions ────────────────────────────────────────────── */}
        <H2 id="subscriptions">Subscriptions</H2>
        <H3>Create a plan</H3>
        <Pre>{`// 1. Create the plan on-chain
const xdr = await client.buildCreatePlanXdr(
  merchantAddress,
  10_000_000n,  // 1 USDC per cycle (stroops)
  518_400       // interval in ledgers (~30 days; use 50 for testnet demo ~4 min)
);
const { returnValue } = await client.submitAndWaitWithResult(await signXdr(xdr));
const planId = returnValue as bigint;

// 2. Register in the hosted DB
await client.registerPlan({
  onChainId:     String(planId),
  merchant:      merchantAddress,
  amount:        "10000000",
  interval:      518_400,
  intervalLabel: "Monthly",
});`}</Pre>

        <H3>Subscribe</H3>
        <Pre>{`const ledger = await client.getCurrentLedger();

// Step 1: subscriber approves SAC allowance (one-time signature)
const approveXdr = await client.buildApproveXdr(
  subscriberAddress,
  10_000_000n * 1000n,     // cap = plan.amount × 1000
  ledger + 535_680         // expiry ~1 year from now
);
await client.submitAndWait(await signXdr(approveXdr));

// Step 2: subscribe (runs first charge immediately)
const subscribeXdr = await client.buildSubscribeXdr(subscriberAddress, planId);
const { returnValue } = await client.submitAndWaitWithResult(await signXdr(subscribeXdr));
const subId = returnValue as bigint;

// Step 3: register in DB
await client.registerSubscription({
  onChainId:     String(subId),
  planOnChainId: String(planId),
  subscriber:    subscriberAddress,
  merchant:      merchantAddress,
  amount:        "10000000",
  payerName:     "Alice",
  payerEmail:    "alice@example.com",
});`}</Pre>

        <H3>Cancel</H3>
        <Pre>{`const xdr = await client.buildCancelXdr(subscriberAddress, subId);
await client.submitAndWait(await signXdr(xdr));`}</Pre>

        <H3>Read views</H3>
        <Pre>{`const plan = await client.getPlan(planId);         // on-chain
const sub  = await client.getSubscription(subId);  // on-chain
const subs = await client.listSubscriptions({ merchant: merchantAddress });`}</Pre>

        {/* ── REST API ─────────────────────────────────────────────────── */}
        <H2 id="rest-api">REST API</H2>
        <P>All endpoints are relative to your <Code>apiBase</Code>. Request and response bodies are JSON.</P>

        <H3>Payment links</H3>
        <Table
          headers={["Method", "Path", "Description"]}
          rows={[
            ["GET",  "/api/payments?merchant=", "List payment links for a merchant"],
            ["POST", "/api/payments",           "Create a payment link"],
            ["GET",  "/api/payments/:linkId",   "Get a single link by numericId"],
          ]}
        />

        <H3>Plans</H3>
        <Table
          headers={["Method", "Path", "Description"]}
          rows={[
            ["GET",  "/api/plans?merchant=", "List plans for a merchant"],
            ["POST", "/api/plans",           "Register a plan (after on-chain create_plan)"],
            ["GET",  "/api/plans/:planId",   "Get a plan by onChainId"],
          ]}
        />

        <H3>Subscriptions</H3>
        <Table
          headers={["Method", "Path", "Description"]}
          rows={[
            ["GET",   "/api/subscriptions?merchant=",  "List subscriptions for a merchant"],
            ["GET",   "/api/subscriptions?subscriber=","List subscriptions for a subscriber"],
            ["POST",  "/api/subscriptions",            "Register a subscription"],
            ["GET",   "/api/subscriptions/:id",        "Get a subscription by onChainId"],
            ["PATCH", "/api/subscriptions/:id",        "Update subscription status"],
          ]}
        />

        <H3>Events</H3>
        <Table
          headers={["Method", "Path", "Description"]}
          rows={[
            ["GET",  "/api/events?merchant=&type=", "List events (filterable)"],
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

        {/* ── Webhooks ─────────────────────────────────────────────────── */}
        <H2 id="webhooks">Webhooks</H2>
        <P>StellarPay signs every webhook delivery with <Code>HMAC-SHA256</Code>. Verify the signature before processing.</P>

        <H3>Event types</H3>
        <Table
          headers={["Type", "Triggered when"]}
          rows={[
            ["payment.settled",        "A one-time payment is confirmed on-chain"],
            ["subscription.charged",   "A billing cycle is pulled successfully"],
            ["subscription.past_due",  "A charge attempt fails due to insufficient allowance"],
            ["subscription.canceled",  "A subscriber cancels on-chain"],
          ]}
        />

        <H3>Payload shape</H3>
        <Pre>{`{
  "type":    "subscription.charged",
  "data":    { "subId": "0", "txHash": "abc...", "status": "Active" },
  "created": 1751234567   // Unix seconds
}`}</Pre>

        <H3>Signature header</H3>
        <Pre>{`Stellarpay-Signature: t=1751234567,v1=<hmac_sha256_hex>`}</Pre>
        <P>The HMAC is computed over <Code>{"`${t}.${rawBody}`"}</Code> using your endpoint&apos;s signing secret (<Code>whsec_...</Code>).</P>

        <H3>Verification example</H3>
        <Pre>{`import { createHmac } from "node:crypto";

function verifySignature(rawBody: string, header: string, secret: string): boolean {
  const parts  = Object.fromEntries(header.split(",").map(p => p.split("=")));
  const expected = createHmac("sha256", secret)
    .update(\`\${parts.t}.\${rawBody}\`)
    .digest("hex");
  return expected === parts.v1;
}`}</Pre>

        {/* ── Types ────────────────────────────────────────────────────── */}
        <H2 id="types">Types</H2>
        <Pre>{`// SDK config
interface StellarPayConfig {
  apiBase:           string;
  contractId:        string;
  sacAddress:        string;
  rpcUrl:            string;
  networkPassphrase: string;
}

// On-chain types
interface Plan {
  id: bigint; merchant: string; asset: string;
  amount: bigint; interval: number; active: boolean;
}

interface Subscription {
  id: bigint; plan_id: bigint; subscriber: string;
  status: "Active" | "PastDue" | "Canceled";
  next_charge: number; created_at: number;
}

// DB record types
interface PaymentLinkRecord { id: string; extId: string; numericId: string;
  merchant: string; amount: string; description?: string; createdAt: string; }

interface PlanRecord { id: string; onChainId: string; merchant: string;
  amount: string; interval: number; intervalLabel: string; createdAt: string; }

interface SubscriptionRecord { id: string; onChainId: string; planOnChainId: string;
  subscriber: string; merchant: string; amount: string;
  payerName?: string; payerEmail?: string; status: string; createdAt: string; }`}</Pre>

        <H3>Amount helpers</H3>
        <Pre>{`import { formatUsdc, parseUsdc } from "@stellarpay/sdk";

parseUsdc("1.50")       // → 15_000_000n
formatUsdc(15_000_000n) // → "1.50"`}</Pre>

      </div>
    </div>
  );
}
