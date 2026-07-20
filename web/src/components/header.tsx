"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { BrandLogo } from "@/components/brand";
import { useWallet } from "@/lib/wallet-context";
import { truncateAddress } from "@/lib/stellar";

export function Header() {
  const { data: session, status } = useSession();
  const { address, isConnecting, connect, disconnect } = useWallet();

  return (
    <header className="sticky top-0 z-40 flex min-h-16 items-center justify-between gap-4 border-b border-black/5 bg-white/88 px-4 py-3 shadow-[0_1px_24px_rgba(7,19,17,0.06)] backdrop-blur-xl sm:px-6">
      <BrandLogo showDescriptor className="min-w-0" />
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <Link href="/" className="hidden text-sm font-medium text-[var(--sp-muted)] hover:text-[var(--sp-ink)] sm:inline-flex">Home</Link>
        <Link href="/docs" className="hidden text-sm font-medium text-[var(--sp-muted)] hover:text-[var(--sp-ink)] sm:inline-flex">Docs</Link>
        <Link href="/pricing" className="hidden text-sm font-medium text-[var(--sp-muted)] hover:text-[var(--sp-ink)] md:inline-flex">Pricing</Link>

        {session?.user ? (
          <>
            <Link href="/app" className="rounded-full bg-[var(--sp-mist)] px-3 py-1.5 text-sm font-semibold text-[var(--sp-ink)] hover:bg-[var(--sp-mint)]">Platform</Link>
            {address ? (
              <>
                <span className="hidden rounded-full bg-[var(--sp-mist)] px-3 py-1 font-mono text-sm text-[var(--sp-muted)] lg:inline-flex">{truncateAddress(address)}</span>
                <button onClick={disconnect} className="hidden rounded-full px-2.5 py-1.5 text-sm font-medium text-[var(--sp-muted)] hover:bg-[var(--sp-mist)] sm:inline-flex">Disconnect wallet</button>
              </>
            ) : (
              <button onClick={connect} disabled={isConnecting} className="hidden rounded-full border border-[var(--sp-border)] px-3 py-1.5 text-sm font-semibold text-[var(--sp-ink)] disabled:opacity-50 sm:inline-flex">
                {isConnecting ? "Connecting…" : "Connect wallet"}
              </button>
            )}
            <button onClick={() => signOut({ callbackUrl: "/" })} className="rounded-full px-2.5 py-1.5 text-sm font-medium text-[var(--sp-muted)] hover:bg-[var(--sp-mist)]" title={session.user.email ?? "Signed in"}>Sign out</button>
          </>
        ) : status === "loading" ? (
          <span className="h-8 w-20 animate-pulse rounded-full bg-[var(--sp-mist)]" />
        ) : (
          <Link href="/signin" className="rounded-full bg-[var(--sp-ink)] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[var(--sp-green)]">Sign in</Link>
        )}
      </div>
    </header>
  );
}
