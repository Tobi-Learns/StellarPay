"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@/lib/wallet-context";
import { loadLinks, type PaymentLink } from "@/lib/payment-links";
import { formatUsdc, truncateAddress } from "@/lib/stellar";
import { SkeletonRow } from "@/components/skeleton";

type PaymentLinkRow = PaymentLink & {
  numericId?: string;
  settledCount?: number;
  totalVolume?: string;
};

interface SettledPayment {
  extId?: string;
  txHash: string;
  createdAt: string;
  paymentLink?: {
    extId: string;
    numericId: string;
    productName: string;
    amount: string;
    description?: string | null;
  } | null;
  data: {
    payerName?: string;
    payerEmail?: string;
    payerWallet?: string;
    amount?: string;
    linkId?: string;
    productName?: string;
  };
}

function formatDateTime(value: string | number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function linkUrl(numericId: string) {
  return `${window.location.origin}/pay/${numericId}`;
}

export default function PaymentsPage() {
  const { address } = useWallet();
  const [links, setLinks] = useState<PaymentLinkRow[]>([]);
  const [settled, setSettled] = useState<SettledPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!address) return;

    const enc = encodeURIComponent(address);

    Promise.all([
      fetch(`/api/payments?merchant=${enc}`).then((r) => r.json()).catch(() => []),
      fetch(`/api/events?merchant=${enc}&type=payment.settled`).then((r) => r.json()).catch(() => []),
    ]).then(([rows, events]) => {
      if (Array.isArray(rows) && rows.length > 0) {
        setLinks(rows.map((r: {
          extId: string;
          numericId: string;
          merchant: string;
          amount: string;
          productName?: string | null;
          description: string | null;
          archivedAt?: string | null;
          createdAt: string;
          settledCount?: number;
          totalVolume?: string;
        }) => ({
          id: r.numericId,
          numericId: r.numericId,
          extId: r.extId,
          merchant: r.merchant,
          amount: r.amount,
          productName: r.productName ?? "Untitled product or service",
          description: r.description ?? "",
          archivedAt: r.archivedAt ?? null,
          createdAt: new Date(r.createdAt).getTime(),
          url: linkUrl(r.numericId),
          settledCount: r.settledCount ?? 0,
          totalVolume: r.totalVolume ?? "0",
        })));
      } else {
        setLinks(loadLinks().filter((l) => l.merchant === address));
      }
      if (Array.isArray(events)) setSettled(events);
    }).finally(() => setLoading(false));
  }, [address]);

  const settledRows = useMemo(() => settled.map((event) => {
    const link = event.paymentLink;
    return {
      ...event,
      productName: link?.productName ?? event.data.productName ?? "Unknown product or service",
      amount: event.data.amount ?? link?.amount,
      payerName: event.data.payerName ?? truncateAddress(event.data.payerWallet ?? ""),
      payerEmail: event.data.payerEmail ?? "",
    };
  }), [settled]);

  const filteredSettledRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (statusFilter !== "all" && statusFilter !== "settled") return [];
    return settledRows.filter((event) => {
      if (!q) return true;
      return [
        event.payerName,
        event.payerEmail,
        event.productName,
        event.extId,
        event.txHash,
        event.paymentLink?.extId,
        event.paymentLink?.numericId,
      ].some((value) => value?.toLowerCase().includes(q));
    });
  }, [query, settledRows, statusFilter]);

  const filteredLinks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return links.filter((link) => {
      const active = link.archivedAt ? "archived" : "active";
      if (statusFilter !== "all" && statusFilter !== active) return false;
      if (!q) return true;
      return [
        link.productName,
        link.description,
        link.extId,
        link.numericId,
        link.id,
      ].some((value) => value?.toLowerCase().includes(q));
    });
  }, [links, query, statusFilter]);

  function copy(link: PaymentLinkRow) {
    navigator.clipboard.writeText(link.url);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold">Payments</h1>
          <p className="text-sm text-neutral-500 mt-1">Track one-time purchases and manage hosted payment links.</p>
        </div>
        <Link
          href="/app/payments/new"
          className="text-sm bg-neutral-900 text-white px-4 py-2 rounded-lg hover:bg-neutral-700 transition-colors"
        >
          New payment link
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="search"
          placeholder="Search name, email, product, or id"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-[260px] flex-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900"
        >
          <option value="all">All statuses</option>
          <option value="settled">Settled payments</option>
          <option value="active">Active links</option>
          <option value="archived">Archived links</option>
        </select>
      </div>

      <section className="mb-8">
        <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wide mb-3">Payments received</h2>
        {loading ? (
          <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg bg-white">
            {[...Array(3)].map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : filteredSettledRows.length === 0 ? (
          <div className="text-center py-12 text-sm text-neutral-400 border border-dashed border-neutral-200 rounded-lg bg-white">
            No payments match this view.
          </div>
        ) : (
          <div className="overflow-x-auto border border-neutral-200 rounded-lg bg-white">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Name</th>
                  <th className="text-left font-medium px-4 py-3">Email</th>
                  <th className="text-left font-medium px-4 py-3">Product or service</th>
                  <th className="text-left font-medium px-4 py-3">Amount (USDC)</th>
                  <th className="text-left font-medium px-4 py-3">Purchased</th>
                  <th className="text-left font-medium px-4 py-3">Status</th>
                  <th className="text-right font-medium px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredSettledRows.map((event) => (
                  <tr key={event.txHash}>
                    <td className="px-4 py-3 text-neutral-900">{event.payerName || "Unknown payer"}</td>
                    <td className="px-4 py-3 text-neutral-600">{event.payerEmail || "Not provided"}</td>
                    <td className="px-4 py-3 text-neutral-900">{event.productName}</td>
                    <td className="px-4 py-3 text-neutral-900">{event.amount ? formatUsdc(BigInt(event.amount)) : "0"} USDC</td>
                    <td className="px-4 py-3 text-neutral-600">{formatDateTime(event.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">Settled</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/app/payments/received/${event.txHash}`}
                        className="text-xs px-3 py-1.5 rounded border border-neutral-200 hover:bg-neutral-50 transition-colors"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wide mb-3">Payment links</h2>
        {loading ? (
          <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg bg-white">
            {[...Array(3)].map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : filteredLinks.length === 0 ? (
          <div className="text-center py-12 text-sm text-neutral-400 border border-dashed border-neutral-200 rounded-lg bg-white">
            No payment links match this view.{" "}
            <Link href="/app/payments/new" className="underline">Create one.</Link>
          </div>
        ) : (
          <div className="overflow-x-auto border border-neutral-200 rounded-lg bg-white">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Product or service</th>
                  <th className="text-left font-medium px-4 py-3">Amount (USDC)</th>
                  <th className="text-left font-medium px-4 py-3">Created</th>
                  <th className="text-left font-medium px-4 py-3">Status</th>
                  <th className="text-right font-medium px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredLinks.map((link) => (
                  <tr key={link.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-900">{link.productName || link.description || "Untitled product or service"}</p>
                      {link.extId && <p className="text-xs font-mono text-neutral-400 mt-0.5">{link.extId}</p>}
                    </td>
                    <td className="px-4 py-3 text-neutral-900">{formatUsdc(BigInt(link.amount))} USDC</td>
                    <td className="px-4 py-3 text-neutral-600">{formatDateTime(link.createdAt)}</td>
                    <td className="px-4 py-3">
                      {link.archivedAt ? (
                        <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600">Archived</span>
                      ) : (
                        <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => copy(link)}
                          className="text-xs px-3 py-1.5 rounded border border-neutral-200 hover:bg-neutral-50 transition-colors"
                        >
                          {copiedId === link.id ? "Copied!" : "Copy link"}
                        </button>
                        <Link
                          href={`/app/payments/${link.id}`}
                          className="text-xs px-3 py-1.5 rounded border border-neutral-200 hover:bg-neutral-50 transition-colors"
                        >
                          Manage
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
