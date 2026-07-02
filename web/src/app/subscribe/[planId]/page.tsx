"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet-context";
import {
  getPlan,
  getCurrentLedger,
  buildApproveXdr,
  buildSubscribeXdr,
  submitAndWaitWithResult,
  formatUsdc,
  truncateAddress,
  type Plan,
} from "@/lib/stellar";
import { loadPlans, saveSubscription } from "@/lib/plans";

type Step = "idle" | "approving" | "subscribing" | "done" | "error";

type RegisteredPlan = {
  onChainId: string;
  merchant: string;
  amount: string;
  interval: number;
};

async function loadPlan(planId: string): Promise<Plan> {
  const res = await fetch(`/api/plans/${planId}`);
  if (res.ok) {
    const registeredPlan = (await res.json()) as RegisteredPlan;
    return {
      id: BigInt(registeredPlan.onChainId),
      merchant: registeredPlan.merchant,
      asset: process.env.NEXT_PUBLIC_TEST_USDC_SAC!,
      amount: BigInt(registeredPlan.amount),
      interval: registeredPlan.interval,
      active: true,
    };
  }

  return getPlan(BigInt(planId));
}

export default function SubscribeCheckoutPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = use(params);
  const { address, connect, signTransaction } = useWallet();
  const router = useRouter();

  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [payerName, setPayerName] = useState("");
  const [payerEmail, setPayerEmail] = useState("");

  useEffect(() => {
    loadPlan(planId)
      .then(setPlan)
      .catch(() => setPlan(null))
      .finally(() => setLoading(false));
  }, [planId]);

  async function handleSubscribe() {
    if (!address || !plan) return;
    if (!payerName.trim() || !payerEmail.trim()) {
      setStep("error");
      setErrorMsg("Please enter your name and email before subscribing.");
      return;
    }

    setStep("approving");
    setErrorMsg("");

    try {
      // Step 1 — approve SAC allowance
      const currentLedger = await getCurrentLedger();
      const cap = plan.amount * BigInt(1000);
      const expiry = currentLedger + 1_000_000;

      const approveXdr = await buildApproveXdr(address, cap, expiry);
      const signedApprove = await signTransaction(approveXdr);
      await submitAndWaitWithResult(signedApprove);

      // Step 2 — subscribe
      setStep("subscribing");
      const subscribeXdr = await buildSubscribeXdr(address, BigInt(planId));
      const signedSubscribe = await signTransaction(subscribeXdr);
      const { hash: subscribeTxHash, returnValue } = await submitAndWaitWithResult(signedSubscribe);

      const subId = String(returnValue as bigint);
      const storedPlan = loadPlans().find((p) => p.onChainId === planId);

      const subData = {
        onChainId: subId,
        planOnChainId: planId,
        subscriber: address,
        merchant: plan.merchant,
        amount: plan.amount.toString(),
        interval: Number(plan.interval),
        intervalLabel: storedPlan?.intervalLabel ?? `${plan.interval} ledgers`,
        payerName: payerName.trim(),
        payerEmail: payerEmail.trim(),
        createdAt: Date.now(),
      };

      saveSubscription({ ...subData, planId });

      fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subData),
      }).then(() =>
        fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "subscription.created",
            txHash: subscribeTxHash,
            data: { subId, planId, payerName: payerName.trim(), payerEmail: payerEmail.trim() },
          }),
        })
      ).catch(() => {});

      setStep("done");
      router.push(`/portal/${subId}`);
    } catch (err) {
      setStep("error");
      setErrorMsg(err instanceof Error ? err.message : "Subscription failed");
    }
  }

  const busy = step === "approving" || step === "subscribing";

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[calc(100vh-57px)]">
        <p className="text-sm text-neutral-400">Loading plan…</p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[calc(100vh-57px)]">
        <p className="text-sm text-neutral-500">Plan not found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center min-h-[calc(100vh-57px)]">
      <div className="max-w-sm w-full mx-auto px-6">
        <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm">
          <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">Subscription</p>
          <p className="text-3xl font-bold mb-1">{formatUsdc(plan.amount)} USDC</p>
          <p className="text-sm text-neutral-500 mb-1">per cycle</p>
          <p className="text-xs text-neutral-400 mb-6">
            Merchant: <span className="font-mono">{truncateAddress(plan.merchant)}</span>
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

          {/* Two-step progress */}
          <div className="flex gap-2 mb-5">
            {["Approve allowance", "Confirm subscription"].map((label, i) => {
              const active = (i === 0 && step === "approving") || (i === 1 && step === "subscribing");
              const done = (i === 0 && (step === "subscribing" || step === "done")) || (i === 1 && step === "done");
              return (
                <div
                  key={label}
                  className={`flex-1 rounded px-2 py-1.5 text-xs text-center ${
                    done ? "bg-green-50 text-green-700" : active ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-400"
                  }`}
                >
                  {done ? "✓ " : ""}{label}
                </div>
              );
            })}
          </div>

          {step === "error" && (
            <p className="text-xs text-red-500 mb-3">{errorMsg}</p>
          )}

          {address ? (
            <button
              onClick={handleSubscribe}
              disabled={busy}
              className="w-full py-3 rounded-lg bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {step === "approving" && "Step 1 — waiting for signature…"}
              {step === "subscribing" && "Step 2 — waiting for signature…"}
              {(step === "idle" || step === "error") && "Subscribe"}
            </button>
          ) : (
            <button
              onClick={connect}
              className="w-full py-3 rounded-lg border border-neutral-200 text-sm font-medium hover:bg-neutral-50 transition-colors"
            >
              Connect wallet to subscribe
            </button>
          )}

          <p className="mt-4 text-xs text-center text-neutral-400">
            First charge is immediate. You can cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
