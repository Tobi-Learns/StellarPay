"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { formatUsdc, truncateAddress } from "@/lib/stellar";

type PaymentDetail = {
  extId?: string;
  txHash: string;
  createdAt: string;
  data: {
    payerName?: string;
    payerEmail?: string;
    payerWallet?: string;
    amount?: string;
    merchant?: string;
    linkId?: string;
    productName?: string;
  };
  paymentLink?: {
    extId: string;
    numericId: string;
    productName: string;
    description?: string | null;
    amount: string;
    merchant: string;
  } | null;
};

function formatDateTime(value?: string | number | null) {
  if (!value) return "Unavailable";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function PaymentReceivedManagePage({
  params,
}: {
  params: Promise<{ txHash: string }>;
}) {
  const { txHash } = use(params);

  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const explorerTxUrl = `https://stellar.expert/explorer/testnet/tx/${txHash}`;

  useEffect(() => {
    let active = true;
    fetch(`/api/events/${encodeURIComponent(txHash)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((row: PaymentDetail | null) => {
        if (active) setPayment(row);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [txHash]);

  function copy(label: string, value: string) {
    navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  const link = payment?.paymentLink;
  const productName = link?.productName ?? payment?.data.productName ?? "Unknown product or service";
  const description = link?.description ?? "";
  const amount = payment?.data.amount ?? link?.amount;
  const merchant = link?.merchant ?? payment?.data.merchant ?? "";
  const payerName = payment?.data.payerName || truncateAddress(payment?.data.payerWallet ?? "");
  const payerEmail = payment?.data.payerEmail ?? "";

  return (
    <div className="max-w-6xl">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/app/payments" className="text-sm text-neutral-400 hover:text-neutral-700">
          &larr; Payments
        </Link>
        <span className="text-neutral-300">/</span>
        <span className="text-sm font-mono">{payment?.extId ?? truncateAddress(txHash)}</span>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-400">Loading payment...</p>
      ) : !payment ? (
        <p className="text-sm text-neutral-500">Payment not found.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-semibold">{payerName || "Unknown payer"}</h1>
              <p className="text-sm text-neutral-500 mt-1">
                {productName} · {amount ? formatUsdc(BigInt(amount)) : "0"} USDC · Purchased {formatDateTime(payment.createdAt)}
              </p>
            </div>
            <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">Settled</span>
          </div>

          <div className="grid gap-4 lg:grid-cols-3 mb-6">
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Amount</p>
              <p className="text-sm font-medium">{amount ? formatUsdc(BigInt(amount)) : "0"} USDC</p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Purchased</p>
              <p className="text-sm font-medium">{formatDateTime(payment.createdAt)}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Status</p>
              <p className="text-sm font-medium">Settled</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="space-y-6">
              <div className="rounded-lg border border-neutral-200 bg-white p-5">
                <h2 className="text-sm font-medium text-neutral-900 mb-4">Details</h2>
                <dl className="grid gap-3 text-sm sm:grid-cols-[180px_minmax(0,1fr)]">
                  <dt className="text-neutral-400">Name</dt>
                  <dd>{payment.data.payerName || "Not provided"}</dd>
                  <dt className="text-neutral-400">Email</dt>
                  <dd>{payerEmail || "Not provided"}</dd>
                  <dt className="text-neutral-400">Product or service</dt>
                  <dd>{productName}</dd>
                  <dt className="text-neutral-400">Description</dt>
                  <dd>{description || "No description"}</dd>
                  <dt className="text-neutral-400">Amount</dt>
                  <dd>{amount ? formatUsdc(BigInt(amount)) : "0"} USDC</dd>
                  <dt className="text-neutral-400">Purchased</dt>
                  <dd>{formatDateTime(payment.createdAt)}</dd>
                  <dt className="text-neutral-400">Payer wallet</dt>
                  <dd className="font-mono text-xs break-all">{payment.data.payerWallet || "Unavailable"}</dd>
                  <dt className="text-neutral-400">Merchant wallet</dt>
                  <dd className="font-mono text-xs break-all">{merchant || "Unavailable"}</dd>
                </dl>
              </div>
            </section>

            <aside className="rounded-lg border border-neutral-200 bg-white p-5 h-fit">
              <h2 className="text-sm font-medium text-neutral-900 mb-4">Integration</h2>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-xs text-neutral-400 mb-1">Transaction hash</p>
                  <p className="font-mono text-xs break-all mb-2">{txHash}</p>
                  <button
                    onClick={() => copy("txHash", txHash)}
                    className="text-xs px-3 py-1.5 rounded border border-neutral-200 hover:bg-neutral-50 transition-colors"
                  >
                    {copied === "txHash" ? "Copied!" : "Copy tx hash"}
                  </button>
                </div>

                <div>
                  <p className="text-xs text-neutral-400 mb-1">Event ID</p>
                  <p className="font-mono text-xs break-all mb-2">{payment.extId ?? "evt_pending"}</p>
                  {payment.extId && (
                    <button
                      onClick={() => copy("extId", payment.extId!)}
                      className="text-xs px-3 py-1.5 rounded border border-neutral-200 hover:bg-neutral-50 transition-colors"
                    >
                      {copied === "extId" ? "Copied!" : "Copy event ID"}
                    </button>
                  )}
                </div>

                {link ? (
                  <div>
                    <p className="text-xs text-neutral-400 mb-1">Payment link</p>
                    <p className="font-mono text-xs break-all mb-1">{link.extId}</p>
                    <p className="font-mono text-xs break-all text-neutral-400 mb-2">on-chain {link.numericId}</p>
                    <Link
                      href={`/app/payments/${link.numericId}`}
                      className="inline-block text-xs px-3 py-1.5 rounded border border-neutral-200 hover:bg-neutral-50 transition-colors"
                    >
                      Manage payment link
                    </Link>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-neutral-400 mb-1">Payment link</p>
                    <p className="text-xs text-neutral-400">Not linked to a current payment link.</p>
                  </div>
                )}

                <a
                  href={explorerTxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center text-xs px-3 py-2 rounded border border-neutral-200 hover:bg-neutral-50 transition-colors"
                >
                  View tx onchain
                </a>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
