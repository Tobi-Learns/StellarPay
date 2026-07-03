"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet-context";
import { buildCreatePlanXdr, submitAndWait, parseUsdc } from "@/lib/stellar";
import { INTERVALS, savePlan } from "@/lib/plans";
import { minIntervalSeconds } from "@/lib/billing-schedule";
import { snowflakeU64 } from "@/lib/ids";

export default function NewPlanPage() {
  const { address, signTransaction } = useWallet();
  const router = useRouter();

  const [amount, setAmount] = useState("");
  const [intervalIdx, setIntervalIdx] = useState(0);
  const [status, setStatus] = useState<"idle" | "signing" | "submitting" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address || !amount) return;

    const stroops = parseUsdc(amount);
    const interval = INTERVALS[intervalIdx];
    const minSecs = minIntervalSeconds({ unit: interval.unit, count: interval.count });

    setStatus("signing");
    setErrorMsg("");

    try {
      // Caller-supplied non-sequential id (Snowflake); the contract asserts uniqueness (3.2e).
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
        interval: minSecs,
        intervalLabel: interval.label,
        intervalUnit: interval.unit,
        intervalCount: interval.count,
        createdAt: Date.now(),
      };

      savePlan(planData);

      fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planData),
      }).catch(() => {});

      router.push("/app/billing");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to create plan");
    }
  }

  const busy = status === "signing" || status === "submitting";

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold mb-6">New subscription plan</h1>

      {!address ? (
        <p className="text-sm text-neutral-400">Connect your wallet first.</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
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
            {status === "signing" && "Waiting for signature…"}
            {status === "submitting" && "Creating plan on-chain…"}
            {(status === "idle" || status === "error") && "Create plan"}
          </button>
        </form>
      )}
    </div>
  );
}
