"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet-context";
import { parseUsdc } from "@/lib/stellar";
import { saveLink } from "@/lib/payment-links";
import { snowflakeU64 } from "@/lib/ids";

export default function NewPaymentPage() {
  const { address } = useWallet();
  const router = useRouter();
  const [productName, setProductName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address) return;
    if (!productName.trim() || !amount) {
      setError("Add a product or service name and amount.");
      return;
    }

    const id = snowflakeU64().toString();
    const data = {
      id,
      merchant: address,
      amount: parseUsdc(amount).toString(),
      productName: productName.trim(),
      description: description.trim(),
      createdAt: Date.now(),
    };

    const url = `${window.location.origin}/pay/${id}`;

    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numericId: id,
        merchant: address,
        amount: data.amount,
        productName: data.productName,
        description: data.description,
      }),
    }).catch(() => null);

    if (res && !res.ok) {
      setError("Payment link could not be saved. Please try again.");
      return;
    }

    saveLink({ ...data, url });
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
          <p className="text-sm font-medium text-neutral-900">{productName}</p>
          <p className="text-sm text-neutral-500 mb-4">{amount} USDC</p>
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
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">New payment link</h1>
        <p className="text-sm text-neutral-500 mt-1">Create a hosted checkout URL for a one-time product or service.</p>
      </div>

      {!address ? (
        <p className="text-sm text-neutral-400">Connect your wallet first.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Product or service name</label>
              <input
                type="text"
                placeholder="e.g. Premium Coffee Bundle"
                value={productName}
                onChange={(e) => {
                  setProductName(e.target.value);
                  setError("");
                }}
                required
                maxLength={80}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Amount (USDC)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="10.00"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError("");
                }}
                required
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                placeholder="What will the customer receive?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={240}
                rows={4}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
              />
            </div>

            <p className="text-xs text-neutral-400">
              Merchant: <span className="font-mono">{address}</span>
            </p>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-700 transition-colors"
            >
              Generate link
            </button>
          </form>

          <aside className="rounded-lg border border-neutral-200 bg-white p-4 h-fit">
            <p className="text-xs text-neutral-400 uppercase tracking-wide mb-3">Checkout preview</p>
            <p className="text-sm font-medium text-neutral-900">{productName.trim() || "Product or service name"}</p>
            <p className="text-2xl font-semibold mt-2">{amount || "0.00"} USDC</p>
            {description.trim() && <p className="text-sm text-neutral-500 mt-3">{description.trim()}</p>}
          </aside>
        </div>
      )}
    </div>
  );
}
