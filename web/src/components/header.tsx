"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/brand";
import { useWallet } from "@/lib/wallet-context";
import { truncateAddress } from "@/lib/stellar";

export function Header() {
  const { address, isConnecting, connect, disconnect } = useWallet();

  return (
    <header className="flex items-center justify-between border-b border-[var(--sp-border)] bg-[var(--sp-paper)] px-6 py-3">
      <BrandLogo />

      <div className="flex items-center gap-4">
        <Link
          href="/docs"
          className="text-sm font-medium text-[var(--sp-muted)] transition-colors hover:text-[var(--sp-ink)]"
        >
          Docs
        </Link>
        {address ? (
          <>
            <span className="rounded-full bg-[var(--sp-mist)] px-3 py-1 font-mono text-sm text-[var(--sp-green)]">
              {truncateAddress(address)}
            </span>
            <button
              onClick={disconnect}
              className="text-sm font-medium text-[var(--sp-muted)] transition-colors hover:text-[var(--sp-ink)]"
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            onClick={connect}
            disabled={isConnecting}
            className="rounded-full bg-[var(--sp-ink)] px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--sp-green)] disabled:opacity-50"
          >
            {isConnecting ? "Connecting…" : "Connect Freighter"}
          </button>
        )}
      </div>
    </header>
  );
}
