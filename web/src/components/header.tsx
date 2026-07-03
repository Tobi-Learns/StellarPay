"use client";

import Link from "next/link";
import { useWallet } from "@/lib/wallet-context";
import { truncateAddress } from "@/lib/stellar";

export function Header() {
  const { address, isConnecting, connect, disconnect } = useWallet();

  return (
    <header className="border-b border-neutral-200 bg-white px-6 py-3 flex items-center justify-between">
      <Link href="/" className="font-semibold text-neutral-900 tracking-tight">
        StellarPay
      </Link>

      <div className="flex items-center gap-4">
        <Link
          href="/docs"
          className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          Docs
        </Link>
        {address ? (
          <>
            <span className="text-sm font-mono text-neutral-500 bg-neutral-100 px-3 py-1 rounded-full">
              {truncateAddress(address)}
            </span>
            <button
              onClick={disconnect}
              className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            onClick={connect}
            disabled={isConnecting}
            className="text-sm bg-neutral-900 text-white px-4 py-1.5 rounded-full hover:bg-neutral-700 disabled:opacity-50 transition-colors"
          >
            {isConnecting ? "Connecting…" : "Connect Freighter"}
          </button>
        )}
      </div>
    </header>
  );
}
