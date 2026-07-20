"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet-context";
import { buildCreatePlanXdr, submitAndWait, parseUsdc } from "@/lib/stellar";
import { INTERVALS, savePlan } from "@/lib/plans";
import { minIntervalSeconds } from "@/lib/billing-schedule";
import { snowflakeU64 } from "@/lib/ids";

export default function NewPlanPage() {
  const { address, isConnecting, connect, signTransaction } = useWallet();
  const router = useRouter();

  const [productName, setProductName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [intervalIdx, setIntervalIdx] = useState(0);
  const [status, setStatus] = useState<"idle" | "signing" | "submitting" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [defaultWallet, setDefaultWallet] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/business")
      .then((response) => response.json())
      .then((data) => {
        const wallet = data.business?.wallets?.find((candidate: { isDefault: boolean }) => candidate.isDefault);
        setDefaultWallet(wallet?.address ?? null);
      })
      .catch(() => setDefaultWallet(null));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address || address !== defaultWallet) {
      setStatus("error");
      setErrorMsg("Connect the Business's current settlement wallet before creating a plan.");
      return;
    }
    if (!productName.trim() || !amount) {
      setStatus("error");
      setErrorMsg("Add a product or service name and amount.");
      return;
    }

    const stroops = parseUsdc(amount);
    const interval = INTERVALS[intervalIdx];
    const minSecs = minIntervalSeconds({ unit: interval.unit, count: interval.count });

    setStatus("signing");
    setErrorMsg("");

    try {
      const planIdSnowflake = snowflakeU64();
      const xdr = await buildCreatePlanXdr(address, stroops, minSecs, planIdSnowflake);
      const signedXdr = await signTransaction(xdr);

      setStatus("submitting");
      await submitAndWait(signedXdr);

      const onChainId = planIdSnowflake.toString();

      const planData = {
        onChainId,
        merchant: address,
        amount: stroops.toString(),
        productName: productName.trim(),
        description: description.trim(),
        interval: minSecs,
        intervalLabel: interval.label,
        intervalUnit: interval.unit,
        intervalCount: interval.count,
        createdAt: Date.now(),
      };

      savePlan(planData);

      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planData),
      }).catch(() => null);

      if (res && !res.ok) {
        setStatus("error");
        setErrorMsg("Plan was created on-chain, but could not be saved to the platform.");
        return;
      }

      router.push("/app/billing");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to create plan");
    }
  }

  const interval = INTERVALS[intervalIdx];
  const busy = status === "signing" || status === "submitting";

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">New subscription plan</h1>
        <p className="text-sm text-neutral-500 mt-1">Create a recurring checkout link for a product or service.</p>
      </div>

      {!address ? (
        <button onClick={connect} disabled={isConnecting} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {isConnecting ? "Connecting…" : "Connect settlement wallet"}
        </button>
      ) : defaultWallet && address !== defaultWallet ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Connected wallet does not match the current settlement wallet. Switch accounts in Freighter and reconnect.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Product or service name</label>
              <input
                type="text"
                placeholder="e.g. Coffee Club Subscription"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                required
                maxLength={80}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Amount per cycle (USDC)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="9.99"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Billing interval</label>
              <select
                value={intervalIdx}
                onChange={(e) => setIntervalIdx(Number(e.target.value))}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900"
              >
                {INTERVALS.map((iv, i) => (
                  <option key={iv.label} value={i}>{iv.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                placeholder="What does this subscription include?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={240}
                rows={4}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
              />
            </div>

            {status === "error" && (
              <p className="text-xs text-red-500">{errorMsg}</p>
            )}

            <p className="text-xs text-neutral-400">
              Merchant: <span className="font-mono">{address}</span>
            </p>

            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 rounded-lg bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {status === "signing" && "Waiting for signature..."}
              {status === "submitting" && "Creating plan on-chain..."}
              {(status === "idle" || status === "error") && "Create plan"}
            </button>
          </form>

          <aside className="rounded-lg border border-neutral-200 bg-white p-4 h-fit">
            <p className="text-xs text-neutral-400 uppercase tracking-wide mb-3">Plan preview</p>
            <p className="text-sm font-medium text-neutral-900">{productName.trim() || "Product or service name"}</p>
            <p className="text-2xl font-semibold mt-2">{amount || "0.00"} USDC</p>
            <p className="text-sm text-neutral-500 mt-1">{interval.label}</p>
            {description.trim() && <p className="text-sm text-neutral-500 mt-3">{description.trim()}</p>}
          </aside>
        </div>
      )}
    </div>
  );
}
