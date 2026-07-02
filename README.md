# StellarPay

A Stripe-style payments layer for Stellar â€” accept one-time and recurring payments in any Stellar asset via a hosted checkout link, an embeddable React button, or a headless JS/TS SDK. Non-custodial, wallet-to-wallet, near-zero fees.

## How it works

- **One-time payments** â€” merchant creates a payment link â†’ customer signs once via Freighter â†’ settles on-chain instantly
- **Subscriptions** â€” customer approves a capped SAC allowance once â†’ contract pulls each billing cycle automatically, no re-signing required
- **Fee split** â€” 1% platform fee on every `pay` and `charge`, split on-chain at settlement

## Monorepo structure

```
StellarPay/
â”œâ”€â”€ contracts/          # Rust / Soroban smart contracts
â”‚   â””â”€â”€ stellarpay/     # Production contract â€” pay, create_plan, subscribe, charge, cancel
â”œâ”€â”€ packages/
â”‚   â”œâ”€â”€ sdk/            # @stellarpay/sdk â€” JS/TS client + <StellarPayButton> React component
â”‚   â””â”€â”€ test-merchant/  # Reference merchant site (port 3001) â€” demos all 3 integration modes
â”œâ”€â”€ web/                # Next.js 15 â€” hosted StellarPay platform (port 3000)
â”‚   â”œâ”€â”€ src/app/        # Merchant dashboard, hosted checkout, subscription portal
â”‚   â””â”€â”€ prisma/         # Schema â€” PaymentLink, Plan, Subscription, Event, ApiKey, WebhookEndpoint
â””â”€â”€ scripts/            # Setup + deploy scripts
```

## Integration modes

| Mode | How |
|---|---|
| **Hosted link** | Server creates a link via API key â†’ customer redirects to StellarPay-hosted checkout |
| **Embedded widget** | Drop-in `<StellarPayButton>` handles wallet connect, trustline setup, and signing |
| **Headless / custom** | Build your own UI with raw SDK methods (`buildPayXdr`, `submitAndWait`, etc.) |

## SDK quickstart

```bash
npm install @stellarpay/sdk @stellar/stellar-sdk @stellar/freighter-api
```

```tsx
import { StellarPayButton, TESTNET, parseUsdc } from "@stellarpay/sdk/react";

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
| Recurring billing | Vercel Cron â€” auto-charges due subscriptions every minute |

## Deployed contracts (testnet)

| Contract | Address |
|---|---|
| StellarPay | `CAD3U6SL2ABFMX7GKFLTL7GQYDEGDEEPILYC26FCEKIGVQ5VCLCZ3CKG` |
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
create_plan(merchant, asset, amount, interval) -> u64
subscribe(subscriber, plan_id) -> u64
charge(invoker, sub_id)
cancel(subscriber, sub_id)
get_plan(plan_id) -> Plan
get_subscription(sub_id) -> Subscription
```
