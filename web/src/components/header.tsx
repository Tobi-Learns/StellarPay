"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/brand";
import { useWallet } from "@/lib/wallet-context";
import { truncateAddress } from "@/lib/stellar";

export function Header() {
  const { address, isConnecting, connect, disconnect } = useWallet();

  return (
    <header className="sticky top-0 z-40 flex min-h-16 items-center justify-between gap-4 border-b border-black/5 bg-white/88 px-4 py-3 shadow-[0_1px_24px_rgba(7,19,17,0.06)] backdrop-blur-xl sm:px-6">
      <BrandLogo showDescriptor className="min-w-0" />

      <div className="flex shrink-0 items-center gap-3">
        {address && (
          <Link
            href="/app"
            className="hidden rounded-full bg-[var(--sp-mist)] px-3 py-1.5 text-sm font-semibold text-[var(--sp-ink)] transition-colors hover:bg-[var(--sp-mint)] sm:inline-flex"
          >
            Platform
          </Link>
        )}
        <Link
          href="/docs"
          className="text-sm font-medium text-[var(--sp-muted)] transition-colors hover:text-[var(--sp-ink)]"
        >
          Docs
        </Link>
        {address ? (
          <>
            <span className="hidden rounded-full bg-[var(--sp-mist)] px-3 py-1 font-mono text-sm text-[var(--sp-muted)] sm:inline-flex">
              {truncateAddress(address)}
            </span>
            <button
              onClick={disconnect}
              className="rounded-full px-2.5 py-1.5 text-sm font-medium text-[var(--sp-muted)] transition-colors hover:bg-[var(--sp-mist)] hover:text-[var(--sp-ink)]"
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
