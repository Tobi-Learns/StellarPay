"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet-context";

export default function ConnectPage() {
  const { address, isConnecting, error, connect } = useWallet();
  const router = useRouter();

  useEffect(() => {
    if (address) router.replace("/app");
  }, [address, router]);

  return (
    <div className="flex flex-1 items-center justify-center min-h-[calc(100vh-57px)]">
      <div className="max-w-sm w-full mx-auto px-6 text-center">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-neutral-900 mb-2">
            Welcome to StellarPay
          </h1>
          <p className="text-neutral-500 text-sm leading-relaxed">
            Accept one-time and recurring payments on Stellar.
            Connect your wallet to get started.
          </p>
        </div>

        <button
          onClick={connect}
          disabled={isConnecting}
          className="w-full bg-neutral-900 text-white py-3 rounded-xl font-medium hover:bg-neutral-700 disabled:opacity-50 transition-colors"
        >
          {isConnecting ? "Connecting…" : "Connect Freighter"}
        </button>

        {error && (
          <p className="mt-4 text-sm text-red-500">{error}</p>
        )}

        <p className="mt-6 text-xs text-neutral-400">
          Don&apos;t have Freighter?{" "}
          <a
            href="https://freighter.app"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-neutral-600"
          >
            Install it here
          </a>
        </p>
      </div>
    </div>
  );
}
