"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet } from "@/lib/wallet-context";
import { loadLinks, type PaymentLink } from "@/lib/payment-links";
import { formatUsdc, truncateAddress } from "@/lib/stellar";
import { SkeletonRow } from "@/components/skeleton";

interface SettledPayment {
  txHash: string;
  createdAt: string;
  data: {
    payerName?: string;
    payerEmail?: string;
    payerWallet?: string;
    amount?: string;
    linkId?: string;
  };
}

export default function PaymentsPage() {
  const { address } = useWallet();
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [settled, setSettled] = useState<SettledPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;

    const enc = encodeURIComponent(address);

    Promise.all([
      fetch(`/api/payments?merchant=${enc}`).then((r) => r.json()).catch(() => []),
      fetch(`/api/events?merchant=${enc}&type=payment.settled`).then((r) => r.json()).catch(() => []),
    ]).then(([rows, events]) => {
      if (Array.isArray(rows) && rows.length > 0) {
        setLinks(rows.map((r: { encodedId: string; numericId: string; merchant: string; amount: string; description: string | null; createdAt: string }) => ({
          id: r.numericId,
          encodedId: r.encodedId,
          merchant: r.merchant,
          amount: r.amount,
          description: r.description ?? "",
          createdAt: new Date(r.createdAt).getTime(),
          url: `${window.location.origin}/pay/${r.encodedId}`,
        })));
      } else {
        setLinks(loadLinks().filter((l) => l.merchant === address));
      }
      if (Array.isArray(events)) setSettled(events);
    }).finally(() => setLoading(false));
  }, [address]);

  function copy(link: PaymentLink) {
    navigator.clipboard.writeText(link.url);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Payments</h1>
        <Link
          href="/app/payments/new"
          className="text-sm bg-neutral-900 text-white px-4 py-2 rounded-lg hover:bg-neutral-700 transition-colors"
        >
          New payment link
        </Link>
      </div>

      {/* Settled payments — who actually paid */}
      {settled.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wide mb-3">Payments received</h2>
          <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg bg-white">
            {settled.map((e) => (
              <div key={e.txHash} className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {e.data.payerName ?? truncateAddress(e.data.payerWallet ?? "")}
                  </p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {e.data.payerEmail && <span>{e.data.payerEmail} · </span>}
                    {e.data.amount && <span>{formatUsdc(BigInt(e.data.amount))} USDC · </span>}
                    {new Date(e.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${e.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs px-3 py-1.5 rounded border border-neutral-200 hover:bg-neutral-50 transition-colors"
                >
                  View tx
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment links */}
      <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wide mb-3">Payment links</h2>
      {loading ? (
        <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg bg-white">
          {[...Array(3)].map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : links.length === 0 ? (
        <div className="text-center py-16 text-sm text-neutral-400">
          No payment links yet.{" "}
          <Link href="/app/payments/new" className="underline">Create one.</Link>
        </div>
      ) : (
        <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg bg-white">
          {links.map((link) => (
            <div key={link.id} className="flex items-center gap-4 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {link.description || "No description"}
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {formatUsdc(BigInt(link.amount))} USDC · {new Date(link.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => copy(link)}
                className="shrink-0 text-xs px-3 py-1.5 rounded border border-neutral-200 hover:bg-neutral-50 transition-colors"
              >
                {copiedId === link.id ? "Copied!" : "Copy link"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
