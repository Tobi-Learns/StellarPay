# StellarPay

A Stripe-style payments layer for Stellar — accept one-time and recurring payments in any Stellar asset via a hosted checkout link, an embeddable React button, or a headless JS/TS SDK. Non-custodial, wallet-to-wallet, near-zero fees, with scan-to-pay mobile QR by default.

## Problem

Getting paid online is still hard for small merchants in the Philippines. Card rails have low penetration and high fees, cross-border remittance is expensive and slow, and **recurring billing is effectively unavailable** to most sellers — the payment gateways that do exist are one-time-only, custodial, or priced for enterprises.

Stellar already solves cheap, fast, cross-border value transfer, but a raw wallet transfer is not a checkout: there is no product/amount context, no recurring pulls, no merchant dashboard, no receipts. StellarPay closes that gap — it turns any Stellar wallet into an online merchant account, so a seller can accept a one-time payment **or a subscription** in stablecoin with a shareable link, an embedded button, or an SDK, at an all-in **1%** cost. Subscriptions pull automatically each cycle **without the customer re-signing**, and customers can pay from their phone by scanning a QR against a desktop checkout.

## Track

**Track 2 — Financial Inclusion & Everyday Payments.**

## How it works

- **One-time payments** — merchant creates a payment link → customer signs once (Freighter in-browser, or by scanning a QR with a mobile wallet) → settles on-chain instantly
- **Subscriptions** — customer approves a capped SAC allowance once → the contract pulls each billing cycle automatically, no re-signing required
- **Mobile scan-to-pay** — every checkout surface shows a WalletConnect QR by default alongside the browser-sign button; the customer picks scan-with-phone or sign-in-browser
- **Fee split** — 1% platform fee on every `pay` and `charge`, split on-chain at settlement

## How it uses Stellar

Stellar is core to the product, not cosmetic:

- **Soroban smart contract** (`contracts/stellarpay/`) — owns `pay`, `create_plan`, `subscribe`, `charge`, and `cancel`, and performs the merchant/platform **fee split on-chain** at settlement.
- **Stellar Asset Contract (SAC) allowances** — subscriptions use `approve` + `transfer_from`: the customer approves a capped allowance once, then the contract pulls each cycle **without a new customer signature**. This is the primitive that makes non-custodial recurring billing possible.
- **Classic assets + trustlines** — settlement is in USDC (classic asset wrapped as a SAC); checkout auto-creates the USDC trustline on first use.
- **WalletConnect v2** — mobile signing pushes sign requests to Freighter mobile over a WalletConnect session; **Freighter** is the browser signing path.
- **Network** — Stellar **testnet** (see [Network & deployment](#network--deployment)).

## Integration modes

| Mode | How |
|---|---|
| **Hosted link** | Server creates a link via API key → customer redirects to StellarPay-hosted checkout (QR + browser sign) |
| **Embedded widget** | Drop-in `<StellarPayButton>` handles wallet connect, trustline setup, signing, and the mobile QR panel |
| **Headless / custom** | Build your own UI with raw SDK methods (`buildPayXdr`, `submitAndWait`, etc.) |

## Monorepo structure

```
StellarPay/
├── contracts/          # Rust / Soroban smart contracts
│   └── stellarpay/     # Production contract — pay, create_plan, subscribe, charge, cancel
├── packages/
│   ├── sdk/            # @stellarpay/sdk — JS/TS client + <StellarPayButton> + mobile QR (WalletConnect)
│   └── test-merchant/  # Reference merchant site (port 3001) — demos all 3 integration modes
├── web/                # Next.js 16 — hosted StellarPay platform (port 3000)
│   ├── src/app/        # Merchant dashboard, hosted checkout, subscription portal
│   └── prisma/         # Schema — PaymentLink, Plan, Subscription, Event, ApiKey, WebhookEndpoint
└── scripts/            # Setup + deploy scripts
```

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
  walletConnectProjectId="..."   // optional — renders the scan-to-pay QR alongside the button
  onSuccess={(txHash) => console.log("paid:", txHash)}
/>
```

The button handles wallet connection, USDC trustline auto-setup, transaction building, Freighter signing, and submission. Passing `walletConnectProjectId` turns it into a checkout panel with the mobile QR shown by default.

## Stack

| Layer | Choice |
|---|---|
| Smart contract | Rust + Soroban SDK 22, Stellar testnet |
| Platform frontend | Next.js 16, React 19, Tailwind v4 |
| Wallet (browser) | Freighter via `@creit.tech/stellar-wallets-kit` 2.5 |
| Wallet (mobile) | WalletConnect v2 via `@walletconnect/sign-client` — scan-to-pay QR |
| Stellar SDK | `@stellar/stellar-sdk` 16 |
| Database | Supabase (Postgres) + Prisma 7 |
| Recurring billing | External uptime cron ([cron-job.org](https://cron-job.org)) — charge every 15 min / retry every 5 min — signs with the platform/admin key |

## Network & deployment

- **Network:** Stellar **testnet**
- **Soroban RPC:** `https://soroban-testnet.stellar.org`
- **Horizon:** `https://horizon-testnet.stellar.org`

| Resource | Address |
|---|---|
| StellarPay contract | `CARTSXUCSVFYXFY2IRS6376C2E63A7WNZD5EXZLIFZPU2NEWUGYM3CKR` |
| Test USDC SAC | `CAKBCKBUE3ZRSNH6CDYAB62ZFWL7U7OX6NBZ6EUDFID22PRLICFJXHGS` |
| Test USDC issuer (classic) | `GAUK4F5RUHGD2SSEBS4EVB7FJSFWU65ITJBV5PYPQNVNTYB2BWCFICEY` |

The contract is initialized with `fee_bps = 100` (1%). These values are also exported from the SDK's `TESTNET` preset.

## Running locally

**Prerequisites:** Node 20+, Rust (stable), `stellar-cli` 27, the Freighter browser extension on testnet.

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

`web/.env` ships with testnet values, so the platform connects to the deployed contract with no extra setup. See `packages/test-merchant/.env.local.example` for the test-merchant environment variables.

> **Mobile QR note:** Freighter mobile refuses to sign for `http`/`localhost` origins by design. To exercise scan-to-pay on a real device, serve the site over HTTPS on a real domain (e.g. `cloudflared tunnel --url http://localhost:3001`). Browser signing works on localhost.

## Contract interface

```rust
initialize(admin, platform, fee_bps)
pay(payer, merchant, asset, amount, link_id)
create_plan(merchant, asset, amount, min_interval_secs, plan_id) -> u64  // plan_id caller-supplied, asserted unique
subscribe(subscriber, plan_id, next_charge_at, sub_id) -> u64            // first charge immediate; next_charge_at in UTC unix seconds
charge(invoker, sub_id, periods, new_next_charge_at)                     // multi-period arrears; merchant OR admin signs
cancel(subscriber, sub_id)
get_plan(plan_id) -> Plan
get_subscription(sub_id) -> Subscription
```

Billing runs on UTC unix seconds: the backend owns exact calendar dates (anchored, month-end aware) while the contract enforces a per-plan cadence floor and chains any multi-period catch-up charge to schedule advancement.

## Team

- **Nickjohn Ibuyat** — [@Tobi-Learns](https://github.com/Tobi-Learns)

## License

MIT — see [LICENSE](./LICENSE).
