"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { StellarWalletsKit, Networks, KitEventType } from "@creit.tech/stellar-wallets-kit";
import { FreighterModule, FREIGHTER_ID } from "@creit.tech/stellar-wallets-kit/modules/freighter";
import { TransactionBuilder } from "@stellar/stellar-sdk";
import { flushOutbox } from "./settlement-outbox";

// ── kit init (singleton, browser-only) ───────────────────────────────────────

function initKit() {
  StellarWalletsKit.init({
    modules: [new FreighterModule()],
    selectedWalletId: FREIGHTER_ID,
    network: Networks.TESTNET,
  });
}

// ── context ───────────────────────────────────────────────────────────────────

interface WalletState {
  address: string | null;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signTransaction: (xdr: string) => Promise<string>;
}

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kitReady, setKitReady] = useState(false);

  // Init kit on mount (browser only)
  useEffect(() => {
    initKit();
    setKitReady(true);

    // Self-heal any settlement records that failed to deliver on a prior visit
    // (open bug B2): re-attempt every persisted outbox write on app load.
    void flushOutbox();

    // Restore session if wallet was previously connected
    StellarWalletsKit.getAddress()
      .then(({ address }) => setAddress(address))
      .catch(() => {/* no prior session */});

    // Listen for disconnect events
    const unsub = StellarWalletsKit.on(KitEventType.DISCONNECT, () => {
      setAddress(null);
    });
    return () => { unsub?.(); };
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const { address } = await StellarWalletsKit.authModal();
      setAddress(address);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    await StellarWalletsKit.disconnect();
    setAddress(null);
  }, []);

  const signTransaction = useCallback(async (xdr: string): Promise<string> => {
    // Guard against a stale connected address: if the active Freighter account no
    // longer matches the account this tx was built for (e.g. the user switched
    // accounts without reconnecting), signing would produce a cryptic txBadAuth
    // at submission. Catch it here with a clear message and resync the UI.
    try {
      const { address: current } = await StellarWalletsKit.getAddress();
      const parsed = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
      const txSource = "innerTransaction" in parsed ? parsed.feeSource : parsed.source;
      if (current && txSource !== current) {
        setAddress(current);
        throw new Error("Connected wallet changed — please reconnect and try again.");
      }
    } catch (e) {
      // Re-throw our own guard error; ignore failures from getAddress/parsing so
      // signing can still surface its own error path.
      if (e instanceof Error && e.message.startsWith("Connected wallet changed")) throw e;
    }

    const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
      networkPassphrase: Networks.TESTNET,
    });
    return signedTxXdr;
  }, []);

  return (
    <WalletContext.Provider
      value={{ address, isConnecting, error, connect, disconnect, signTransaction }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}
