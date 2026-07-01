"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet-context";
import { parseUsdc } from "@/lib/stellar";
import { encodeLink, saveLink } from "@/lib/payment-links";

export default function NewPaymentPage() {
  const { address } = useWallet();
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address || !amount) return;

    const id = Date.now().toString();
    const data = {
      id,
      merchant: address,
      amount: parseUsdc(amount).toString(),
      description: description.trim(),
      createdAt: Date.now(),
    };

    const encoded = encodeLink(data);
    const url = `${window.location.origin}/pay/${encoded}`;

    saveLink({ ...data, url });

    // Write-through to DB (fire-and-forget — link works without it)
    fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ encodedId: encoded, numericId: id, merchant: address, amount: data.amount, description: data.description }),
    }).catch(() => {});

    setLinkUrl(url);
  }

  function copy() {
    if (!linkUrl) return;
    navigator.clipboard.writeText(linkUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (linkUrl) {
    return (
      <div className="max-w-lg">
        <h1 className="text-xl font-semibold mb-6">Payment link created</h1>

        <div className="bg-white border border-neutral-200 rounded-lg p-4 mb-4">
          <p className="text-xs text-neutral-400 mb-1">Shareable URL</p>
          <p className="text-sm font-mono break-all text-neutral-800">{linkUrl}</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={copy}
            className="flex-1 py-2 rounded-lg bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-700 transition-colors"
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
          <button
            onClick={() => router.push("/app/payments")}
            className="flex-1 py-2 rounded-lg border border-neutral-200 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            View all links
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold mb-6">New payment link</h1>

      {!address ? (
        <p className="text-sm text-neutral-400">Connect your wallet first.</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Amount (USDC)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="10.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <input
              type="text"
              placeholder="e.g. Consulting invoice #42"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={120}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>

          <p className="text-xs text-neutral-400">
            Merchant: <span className="font-mono">{address}</span>
          </p>

          <button
            type="submit"
            className="w-full py-2.5 rounded-lg bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-700 transition-colors"
          >
            Generate link
          </button>
        </form>
      )}
    </div>
  );
}
