"use client";

import { Suspense, use } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { truncateAddress } from "@/lib/stellar";

function ReceiptContent({ txId }: { txId: string }) {
  const searchParams = useSearchParams();

  const amount = searchParams.get("amount");
  const merchant = searchParams.get("merchant");
  const description = searchParams.get("description");

  const explorerUrl = `https://stellar.expert/explorer/testnet/tx/${txId}`;

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm text-center">
      <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
        <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h1 className="text-xl font-semibold mb-1">Payment confirmed</h1>

      {amount && (
        <p className="text-3xl font-bold mt-3 mb-1">{amount} USDC</p>
      )}
      {description && (
        <p className="text-sm text-neutral-500 mb-1">{description}</p>
      )}
      {merchant && (
        <p className="text-xs text-neutral-400 mb-4">
          To: <span className="font-mono">{truncateAddress(merchant)}</span>
        </p>
      )}

      <div className="bg-neutral-50 rounded-lg px-3 py-2 mb-5 text-left">
        <p className="text-xs text-neutral-400 mb-0.5">Transaction hash</p>
        <p className="text-xs font-mono text-neutral-700 break-all">{txId}</p>
      </div>

      <div className="flex flex-col gap-2">
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block py-2.5 rounded-lg bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-700 transition-colors"
        >
          View on Stellar Expert
        </a>
        <Link
          href="/"
          className="block py-2.5 rounded-lg border border-neutral-200 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
        >
          Done
        </Link>
      </div>
    </div>
  );
}

export default function ReceiptPage({
  params,
}: {
  params: Promise<{ txId: string }>;
}) {
  const { txId } = use(params);

  return (
    <div className="flex flex-1 items-center justify-center min-h-[calc(100vh-57px)]">
      <div className="max-w-sm w-full mx-auto px-6">
        <Suspense fallback={<p className="text-sm text-neutral-400 text-center">Loading…</p>}>
          <ReceiptContent txId={txId} />
        </Suspense>
      </div>
    </div>
  );
}
