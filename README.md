# StellarPay

A Stripe-style payments layer for Stellar — accept one-time and recurring payments in any Stellar asset via a hosted checkout link, an embeddable React button, or a headless JS/TS SDK. Non-custodial, wallet-to-wallet, near-zero fees.

## How it works

- **One-time payments** — merchant creates a payment link → customer signs once via Freighter → settles on-chain instantly
- **Subscriptions** — customer approves a capped SAC allowance once → contract pulls each billing cycle automatically, no re-signing required
- **Fee split** — 1% platform fee on every `pay` and `charge`, split on-chain at settlement

## Monorepo structure

```
StellarPay/
├── contracts/          # Rust / Soroban smart contracts
│   └── stellarpay/     # Production contract — pay, create_plan, subscribe, charge, cancel
├── packages/
│   ├── sdk/            # @stellarpay/sdk — JS/TS client + <StellarPayButton> React component
│   └── test-merchant/  # Reference merchant site (port 3001) — demos all 3 integration modes
├── web/                # Next.js 15 — hosted StellarPay platform (port 3000)
│   ├── src/app/        # Merchant dashboard, hosted checkout, subscription portal
│   └── prisma/         # Schema — PaymentLink, Plan, Subscription, Event, ApiKey, WebhookEndpoint
└── scripts/            # Setup + deploy scripts
```

## Integration modes

| Mode | How |
|---|---|
| **Hosted link** | Server creates a link via API key → customer redirects to StellarPay-hosted checkout |
| **Embedded widget** | Drop-in `<StellarPayButton>` handles wallet connect, trustline setup, and signing |
| **Headless / custom** | Build your own UI with raw SDK methods (`buildPayXdr`, `submitAndWait`, etc.) |

## SDK quickstart

```bash
npm install @stellarpay/sdk @stellar/stellar-sdk @stellar/freighter-api
```

```tsx
import { TESTNET, parseUsdc } from "@stellarpay/sdk";
import { StellarPayButton } from "@stellarpay/sdk/react";

<StellarPayButton
  config={{ ...TESTNET, apiBase: "https://your-stellarpay-instance.com" }}
  merchant="G..."
  amount={parseUsdc("5.00")}
  linkId={1n}
  onSuccess={(txHash) => console.log("paid:", txHash)}
/>
```

The button handles wallet connection, USDC trustline auto-setup, transaction building, Freighter signing, and submission.

## Stack

| Layer | Choice |
|---|---|
| Smart contract | Rust + Soroban SDK 22, Stellar testnet |
| Frontend | Next.js 15, React 18, Tailwind v4 |
| Wallet | Freighter via `@stellar/freighter-api` 6 |
| Stellar SDK | `@stellar/stellar-sdk` 16 |
| Database | Supabase (Postgres) + Prisma 7 |
| Recurring billing | GitHub Actions cron (charge every 15 min / retry every 3 min) using platform/admin key |

## Deployed contracts (testnet)

| Contract | Address |
|---|---|
| StellarPay | `CARTSXUCSVFYXFY2IRS6376C2E63A7WNZD5EXZLIFZPU2NEWUGYM3CKR` |
| Test USDC SAC | `CAKBCKBUE3ZRSNH6CDYAB62ZFWL7U7OX6NBZ6EUDFID22PRLICFJXHGS` |

## Running locally

```bash
# 1. Platform
cd web && npm install && npm run dev        # http://localhost:3000

# 2. SDK (build before test-merchant)
cd packages/sdk && npm install && npx tsc

# 3. Test merchant
cd packages/test-merchant
cp .env.local.example .env.local            # fill in values
npm install && npm run dev                  # http://localhost:3001
```

See `packages/test-merchant/.env.local.example` for required environment variables.

## Contract interface

```rust
initialize(admin, platform, fee_bps)
pay(payer, merchant, asset, amount, link_id)
create_plan(merchant, asset, amount, min_interval_secs) -> u64
subscribe(subscriber, plan_id, next_charge_at) -> u64   // first charge immediate; next_charge_at in UTC unix seconds
charge(invoker, sub_id, periods, new_next_charge_at)    // multi-period arrears; merchant OR admin signs
cancel(subscriber, sub_id)
get_plan(plan_id) -> Plan
get_subscription(sub_id) -> Subscription
```
