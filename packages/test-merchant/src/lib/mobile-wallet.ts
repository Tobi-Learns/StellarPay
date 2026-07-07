"use client";

// Freighter mobile signing over WalletConnect v2 (Phase 2.5/3.4 pivot, 2026-07-07).
//
// The QR shown to the customer is the short WalletConnect pairing URI — not a
// transaction. The wallet returns its address when the customer approves the
// connection, and only then do we build/simulate the Soroban XDR with the real
// payer address. Sign requests are then pushed to the phone over the session
// (`stellar_signXDR`), so one scan covers a whole chain of signatures
// (trustline → approve → subscribe).

import { StellarWalletsKit, Networks } from "@creit.tech/stellar-wallets-kit";
import {
  WalletConnectModule,
  WALLET_CONNECT_ID,
  WalletConnectTargetChain,
} from "@creit.tech/stellar-wallets-kit/modules/wallet-connect";
import { TESTNET } from "@stellarpay/sdk";

const PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

let initiated = false;

// The kit rejects with plain `{ code, message }` objects (its parseError),
// not Error instances — normalize so callers can render `.message`.
function toError(e: unknown): Error {
  if (e instanceof Error) return e;
  const msg = (e as { message?: string })?.message;
  return new Error(msg || (typeof e === "string" ? e : "Wallet connection failed"));
}

/** Initialize the kit with only the WalletConnect module. Browser-only, idempotent. */
export function initMobileWallet(): void {
  if (typeof window === "undefined" || initiated) return;
  if (!PROJECT_ID) return; // surfaced as a clear error on connect instead
  StellarWalletsKit.init({
    modules: [
      new WalletConnectModule({
        projectId: PROJECT_ID,
        metadata: {
          name: "Stellar Roast",
          description: "StellarPay demo shop — pay with your mobile Stellar wallet",
          url: window.location.origin,
          icons: [`${window.location.origin}/favicon.ico`],
        },
        allowedChains: [WalletConnectTargetChain.TESTNET],
      }),
    ],
    selectedWalletId: WALLET_CONNECT_ID,
    network: Networks.TESTNET,
  });
  initiated = true;
}

/**
 * Open the WalletConnect QR modal and resolve with the wallet's address once
 * the customer scans and approves the connection in Freighter mobile.
 */
export async function connectMobileWallet(): Promise<string> {
  if (!PROJECT_ID) {
    throw new Error(
      "Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID — create a free project at https://cloud.reown.com and set it in .env.local.",
    );
  }
  // Freighter mobile hard-rejects sign requests from http:// or localhost
  // dapps (getHostname in its source returns null for both). Fail fast with
  // guidance instead of letting the wallet reject with a cryptic toast.
  const { protocol, hostname } = window.location;
  if (protocol !== "https:" || hostname === "localhost" || hostname === "127.0.0.1") {
    throw new Error(
      `Freighter mobile only signs for HTTPS dapps on a real domain — this page is served from ${window.location.origin}. Open the HTTPS tunnel URL (or the deployed site) and retry from there.`,
    );
  }
  initMobileWallet();

  // The WalletConnect SignClient boots asynchronously inside the module
  // constructor; give it a moment before the first connect attempt.
  let cleared = false;
  for (let attempt = 0; ; attempt++) {
    try {
      if (!cleared) {
        // WalletConnect persists sessions across page reloads, and abandoned
        // attempts pile up stale sessions for the same address. The kit signs
        // over the FIRST session matching the address, so a stale one makes
        // the wallet reject with "this domain is not connected". Start every
        // connect from a clean slate: exactly one live session.
        try {
          await StellarWalletsKit.disconnect();
        } catch {
          // no sessions to clear
        }
        // disconnect() resets the kit's wallet selection — re-select WC
        StellarWalletsKit.setWallet(WALLET_CONNECT_ID);
        cleared = true;
      }
      const { address } = await StellarWalletsKit.fetchAddress();
      return address;
    } catch (e) {
      const err = toError(e);
      if ((err.message.includes("not been started") || err.message.includes("not running yet")) && attempt < 20) {
        await new Promise((r) => setTimeout(r, 250));
        continue;
      }
      throw err;
    }
  }
}

/** Push a sign request to the connected phone over the WalletConnect session. */
export async function signWithMobileWallet(xdr: string, address: string): Promise<string> {
  try {
    const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
      networkPassphrase: TESTNET.networkPassphrase,
      address,
    });
    return signedTxXdr;
  } catch (e) {
    throw toError(e);
  }
}

/** Close any open WalletConnect sessions (fresh QR on the next connect). */
export async function disconnectMobileWallet(): Promise<void> {
  if (!initiated) return;
  try {
    await StellarWalletsKit.disconnect();
  } catch {
    // no active session — nothing to do
  }
}
