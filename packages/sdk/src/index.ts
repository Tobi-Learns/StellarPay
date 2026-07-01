export { StellarPayClient } from "./client";
export type {
  StellarPayConfig,
  Plan,
  Subscription,
  PaymentLinkRecord,
  PlanRecord,
  SubscriptionRecord,
} from "./types";

// ── Utils ─────────────────────────────────────────────────────────────────────

const USDC_DECIMALS = 7;

export function formatUsdc(stroops: bigint): string {
  const whole = stroops / BigInt(10 ** USDC_DECIMALS);
  const frac = stroops % BigInt(10 ** USDC_DECIMALS);
  return `${whole}.${frac.toString().padStart(USDC_DECIMALS, "0").replace(/0+$/, "") || "00"}`;
}

export function parseUsdc(display: string): bigint {
  const [whole = "0", frac = "0"] = display.split(".");
  const paddedFrac = frac.padEnd(USDC_DECIMALS, "0").slice(0, USDC_DECIMALS);
  return BigInt(whole) * BigInt(10 ** USDC_DECIMALS) + BigInt(paddedFrac);
}

// ── Presets ───────────────────────────────────────────────────────────────────

import { Networks } from "@stellar/stellar-sdk";
import type { StellarPayConfig } from "./types";

/** Ready-to-use config for the deployed testnet environment. */
export const TESTNET: Omit<StellarPayConfig, "apiBase"> = {
  contractId: "CDKBHMS7GYH7IIY6XAMQYF7HRXD62OR2B7ZEFWXFGREC6HP4BKOS5YNF",
  sacAddress: "CAKBCKBUE3ZRSNH6CDYAB62ZFWL7U7OX6NBZ6EUDFID22PRLICFJXHGS",
  rpcUrl: "https://soroban-testnet.stellar.org",
  horizonUrl: "https://horizon-testnet.stellar.org",
  networkPassphrase: Networks.TESTNET,
  // The classic USDC asset this SAC wraps. Used for automatic trustline setup.
  // Issuer = CRON_ADMIN_ADDRESS (GAUK4F5...) — this is the key that minted the USDC and
  // matches the asset the SAC was deployed against (verified: Asset.contractId === sacAddress).
  classicAsset: {
    code: "USDC",
    issuer: "GAUK4F5RUHGD2SSEBS4EVB7FJSFWU65ITJBV5PYPQNVNTYB2BWCFICEY",
  },
};
