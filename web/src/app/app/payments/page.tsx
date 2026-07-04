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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--sp-muted)]">Sales</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal text-[var(--sp-ink)]">Payments</h1>
          <p className="mt-1 text-sm text-[var(--sp-muted)]">Track customer purchases and manage checkout links.</p>
        </div>
        <Link
          href="/app/payments/new"
          className="rounded-full bg-[var(--sp-ink)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--sp-green)]"
        >
          New payment link
        </Link>
      </div>

      <div className="mb-7 flex flex-wrap gap-3 rounded-2xl border border-[var(--sp-border)] bg-white p-3 shadow-[0_18px_48px_rgba(7,19,17,0.05)]">
        <input
          type="search"
          placeholder="Search name, email, product, or id"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-[260px] flex-1 rounded-xl border border-[var(--sp-border)] bg-white px-3 py-2 text-sm text-[var(--sp-ink)] outline-none transition focus:border-[var(--sp-green)] focus:ring-4 focus:ring-[var(--sp-mint)]"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-[var(--sp-border)] bg-white px-3 py-2 text-sm text-[var(--sp-ink)] outline-none transition focus:border-[var(--sp-green)] focus:ring-4 focus:ring-[var(--sp-mint)]"
        >
          <option value="all">All statuses</option>
          <option value="settled">Settled payments</option>
          <option value="active">Active links</option>
          <option value="archived">Archived links</option>
        </select>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-normal text-[var(--sp-muted)]">Payments received</h2>
        {loading ? (
          <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg bg-white">
            {[...Array(3)].map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : filteredSettledRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--sp-border)] bg-white py-12 text-center text-sm text-[var(--sp-muted)]">
            No payments match this view.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[var(--sp-border)] bg-white shadow-[0_18px_48px_rgba(7,19,17,0.05)]">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-[#fdfeff] text-xs uppercase tracking-normal text-[var(--sp-muted)]">
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
              <tbody className="divide-y divide-[#eaebef]">
                {filteredSettledRows.map((event) => (
                  <tr key={event.txHash}>
                    <td className="px-4 py-4 font-medium text-[var(--sp-ink)]">{event.payerName || "Unknown payer"}</td>
                    <td className="px-4 py-4 text-[var(--sp-muted)]">{event.payerEmail || "Not provided"}</td>
                    <td className="px-4 py-4 text-[var(--sp-ink)]">{event.productName}</td>
                    <td className="px-4 py-4 font-medium text-[var(--sp-ink)]">{event.amount ? formatUsdc(BigInt(event.amount)) : "0"} USDC</td>
                    <td className="px-4 py-4 text-[var(--sp-muted)]">{formatDateTime(event.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-[var(--sp-mist)] px-2.5 py-1 text-xs font-semibold text-[var(--sp-green)]">Settled</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/app/payments/received/${event.txHash}`}
                        className="rounded-full border border-[var(--sp-border)] px-3 py-1.5 text-xs font-semibold text-[var(--sp-ink)] transition-colors hover:border-[var(--sp-green)] hover:bg-[var(--sp-mist)]"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-normal text-[var(--sp-muted)]">Payment links</h2>
        {loading ? (
          <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg bg-white">
            {[...Array(3)].map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : filteredLinks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--sp-border)] bg-white py-12 text-center text-sm text-[var(--sp-muted)]">
            No payment links match this view.{" "}
            <Link href="/app/payments/new" className="underline">Create one.</Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[var(--sp-border)] bg-white shadow-[0_18px_48px_rgba(7,19,17,0.05)]">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-[#fdfeff] text-xs uppercase tracking-normal text-[var(--sp-muted)]">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Product or service</th>
                  <th className="text-left font-medium px-4 py-3">Amount (USDC)</th>
                  <th className="text-left font-medium px-4 py-3">Created</th>
                  <th className="text-left font-medium px-4 py-3">Status</th>
                  <th className="text-right font-medium px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eaebef]">
                {filteredLinks.map((link) => (
                  <tr key={link.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[var(--sp-ink)]">{link.productName || link.description || "Untitled product or service"}</p>
                      {link.extId && <p className="mt-0.5 font-mono text-xs text-[var(--sp-muted)]/65">{link.extId}</p>}
                    </td>
                    <td className="px-4 py-4 font-medium text-[var(--sp-ink)]">{formatUsdc(BigInt(link.amount))} USDC</td>
                    <td className="px-4 py-4 text-[var(--sp-muted)]">{formatDateTime(link.createdAt)}</td>
                    <td className="px-4 py-3">
                      {link.archivedAt ? (
                        <span className="rounded-full bg-[#eceef2] px-2.5 py-1 text-xs font-semibold text-[var(--sp-muted)]">Archived</span>
                      ) : (
                        <span className="rounded-full bg-[var(--sp-mist)] px-2.5 py-1 text-xs font-semibold text-[var(--sp-green)]">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => copy(link)}
                          className="rounded-full border border-[var(--sp-border)] px-3 py-1.5 text-xs font-semibold text-[var(--sp-ink)] transition-colors hover:border-[var(--sp-green)] hover:bg-[var(--sp-mist)]"
                        >
                          {copiedId === link.id ? "Copied!" : "Copy link"}
                        </button>
                        <Link
                          href={`/app/payments/${link.id}`}
                          className="rounded-full border border-[var(--sp-border)] px-3 py-1.5 text-xs font-semibold text-[var(--sp-ink)] transition-colors hover:border-[var(--sp-green)] hover:bg-[var(--sp-mist)]"
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
          </div>
        )}
      </section>
    </div>
  );
}
