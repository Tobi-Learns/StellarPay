"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand";
import { useWallet } from "@/lib/wallet-context";

export default function ConnectPage() {
  const { address, isConnecting, error, connect } = useWallet();
  const router = useRouter();

  useEffect(() => {
    if (address) router.replace("/app");
  }, [address, router]);

  return (
    <div className="flex min-h-[calc(100vh-57px)] flex-1 items-center justify-center bg-[var(--sp-paper)]">
      <div className="mx-auto w-full max-w-sm px-6 text-center">
        <div className="mb-8 flex justify-center">
          <BrandLogo href="" showDescriptor />
        </div>
        <div className="mb-8">
          <h1 className="mb-2 text-2xl font-semibold text-[var(--sp-ink)]">
            Connect your wallet
          </h1>
          <p className="text-sm leading-relaxed text-[var(--sp-muted)]">
            Manage customer payments, subscription plans, and your merchant wallet.
          </p>
        </div>

        <button
          onClick={connect}
          disabled={isConnecting}
          className="w-full rounded-xl bg-[var(--sp-ink)] py-3 font-semibold text-white transition-colors hover:bg-[var(--sp-green)] disabled:opacity-50"
        >
          {isConnecting ? "Connecting…" : "Connect Freighter"}
        </button>

        {error && (
          <p className="mt-4 text-sm text-red-500">{error}</p>
        )}

        <p className="mt-6 text-xs text-[var(--sp-muted)]/75">
          Don&apos;t have Freighter?{" "}
          <a
            href="https://freighter.app"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[var(--sp-green)]"
          >
            Install it here
          </a>
        </p>
      </div>
    </div>
  );
}
