"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet-context";
import { buildPayXdr, submitAndWait, formatUsdc, truncateAddress } from "@/lib/stellar";
import { decodeLink } from "@/lib/payment-links";

interface MerchantProfile { displayName?: string | null; verified?: boolean }

// The link IS the numericId now; the page looks it up in the DB (like /subscribe
// resolves a plan by id), so the amount/merchant are server-authoritative, not
// read from a tamperable URL blob. Old self-contained blob links still decode as
// a fallback so anything shared before this change keeps working.
type LinkData = { merchant: string; amount: string; numericId: string; description?: string };

export default function CheckoutPage({
  params,
}: {
  params: Promise<{ linkId: string }>;
}) {
  const { linkId } = use(params);
  const { address, connect, signTransaction } = useWallet();
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "signing" | "submitting" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [merchant, setMerchant] = useState<MerchantProfile | null>(null);
  const [payerName, setPayerName] = useState("");
  const [payerEmail, setPayerEmail] = useState("");
  const [link, setLink] = useState<LinkData | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "invalid">("loading");

  useEffect(() => {
    let active = true;
    (async () => {
      // Primary: resolve the link by numericId from the DB.
      try {
        const res = await fetch(`/api/payments/${encodeURIComponent(linkId)}`);
        if (res.ok) {
          const row = await res.json() as { merchant: string; amount: string; numericId: string; description?: string | null };
          if (active) { setLink({ merchant: row.merchant, amount: row.amount, numericId: row.numericId, description: row.description ?? undefined }); setLoadState("ready"); }
          return;
        }
      } catch { /* fall through to legacy decode */ }
      // Legacy fallback: old self-contained base64 blob links.
      try {
        const d = decodeLink(linkId);
        if (active) { setLink({ merchant: d.merchant, amount: d.amount, numericId: String(d.id ?? ""), description: d.description }); setLoadState("ready"); }
        return;
      } catch { /* not a blob either */ }
      if (active) setLoadState("invalid");
    })();
    return () => { active = false; };
  }, [linkId]);

  useEffect(() => {
    if (!link) return;
    fetch(`/api/merchants/${link.merchant}`)
      .then((r) => r.json())
      .then((m) => { if (!m.error) setMerchant(m); })
      .catch(() => {});
  }, [link?.merchant]);

  if (loadState === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[calc(100vh-57px)]">
        <div className="max-w-sm w-full mx-auto px-6 text-center">
          <p className="text-sm text-neutral-400">Loading payment link…</p>
        </div>
      </div>
    );
  }

  if (loadState === "invalid" || !link) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[calc(100vh-57px)]">
        <div className="max-w-sm w-full mx-auto px-6 text-center">
          <p className="text-sm text-neutral-500">Invalid payment link.</p>
        </div>
      </div>
    );
  }

  const amountDisplay = formatUsdc(BigInt(link.amount));

  async function handlePay() {
    if (!address || !link) return;
    if (!payerName.trim() || !payerEmail.trim()) {
      setStatus("error");
      setErrorMsg("Please enter your name and email before paying.");
      return;
    }

    setStatus("signing");
    setErrorMsg("");

    try {
      if (!link.numericId) throw new Error("Payment link is missing its numeric id.");

      const xdr = await buildPayXdr(address, link.merchant, BigInt(link.amount), BigInt(link.numericId));
      const signedTxXdr = await signTransaction(xdr);

      setStatus("submitting");
      const txHash = await submitAndWait(signedTxXdr);

      fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "payment.settled",
          txHash,
          data: {
            amount: link.amount,
            merchant: link.merchant,
            linkId,
            payerName: payerName.trim(),
            payerEmail: payerEmail.trim(),
            payerWallet: address,
          },
        }),
      }).catch(() => {});

      const qs = new URLSearchParams({
        amount: amountDisplay,
        merchant: merchant?.displayName ?? link.merchant,
        description: link.description ?? "",
      });
      router.push(`/receipt/${txHash}?${qs.toString()}`);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Payment failed");
    }
  }

  const busy = status === "signing" || status === "submitting";

  return (
    <div className="flex flex-1 items-center justify-center min-h-[calc(100vh-57px)]">
      <div className="max-w-sm w-full mx-auto px-6">
        <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <p className="text-sm font-medium text-neutral-700">
              {merchant?.displayName ?? truncateAddress(link.merchant)}
            </p>
            <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium">
              Verified
            </span>
          </div>

          <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Payment request</p>
          <p className="text-3xl font-bold mb-1">{amountDisplay} USDC</p>
          {link.description && (
            <p className="text-sm text-neutral-600 mb-4">{link.description}</p>
          )}
          <p className="text-xs text-neutral-400 mb-6">
            To: <span className="font-mono">{truncateAddress(link.merchant)}</span>
          </p>

          {/* Customer details */}
          <div className="space-y-3 mb-5">
            <input
              type="text"
              placeholder="Full name"
              value={payerName}
              onChange={(e) => setPayerName(e.target.value)}
              disabled={busy}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50"
            />
            <input
              type="email"
              placeholder="Email address"
              value={payerEmail}
              onChange={(e) => setPayerEmail(e.target.value)}
              disabled={busy}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50"
            />
          </div>

          {status === "error" && (
            <p className="text-xs text-red-500 mb-3">{errorMsg}</p>
          )}

          {address ? (
            <button
              onClick={handlePay}
              disabled={busy}
              className="w-full py-3 rounded-lg bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {status === "signing" && "Waiting for signature…"}
              {status === "submitting" && "Submitting…"}
              {(status === "idle" || status === "error") && `Pay ${amountDisplay} USDC`}
            </button>
          ) : (
            <button
              onClick={connect}
              className="w-full py-3 rounded-lg border border-neutral-200 text-sm font-medium hover:bg-neutral-50 transition-colors"
            >
              Connect wallet to pay
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
