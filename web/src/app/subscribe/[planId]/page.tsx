"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Networks } from "@stellar/stellar-sdk";
import { MobileWalletConnect } from "@stellarpay/sdk";
import { MobileWalletQr } from "@stellarpay/sdk/react";
import { useWallet } from "@/lib/wallet-context";
import {
  getPlan,
  getCurrentLedger,
  buildApproveXdr,
  buildSubscribeXdr,
  submitAndWait,
  submitAndWaitWithResult,
  formatUsdc,
  truncateAddress,
  type Plan,
} from "@/lib/stellar";
import { saveSubscription } from "@/lib/plans";
import { recordDurable } from "@/lib/settlement-outbox";
import { snowflakeU64 } from "@/lib/ids";
import {
  firstNextChargeAt,
  toUnixSeconds,
  type Interval,
  type IntervalUnit,
} from "@/lib/billing-schedule";

type Step = "idle" | "approving" | "subscribing" | "done" | "error";

const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

type RegisteredPlan = {
  onChainId: string;
  merchant: string;
  amount: string;
  productName?: string;
  description?: string | null;
  interval: number;
  intervalUnit?: IntervalUnit;
  intervalCount?: number;
  intervalLabel?: string;
};

type LoadedPlan = { plan: Plan; interval: Interval; intervalLabel: string; productName?: string; description?: string | null };

async function loadPlan(planId: string): Promise<LoadedPlan> {
  const res = await fetch(`/api/plans/${planId}`);
  if (res.ok) {
    const registeredPlan = (await res.json()) as RegisteredPlan;
    const interval: Interval = {
      unit: registeredPlan.intervalUnit ?? "month",
      count: registeredPlan.intervalCount ?? 1,
    };
    return {
      plan: {
        id: BigInt(registeredPlan.onChainId),
        merchant: registeredPlan.merchant,
        asset: process.env.NEXT_PUBLIC_TEST_USDC_SAC!,
        amount: BigInt(registeredPlan.amount),
        min_interval_secs: registeredPlan.interval,
        active: true,
      },
      interval,
      intervalLabel: registeredPlan.intervalLabel ?? `${interval.count} ${interval.unit}`,
      productName: registeredPlan.productName,
      description: registeredPlan.description,
    };
  }

  const plan = await getPlan(BigInt(planId));
  // Fallback when the plan isn't registered in the DB: reconstruct an approximate
  // interval from the on-chain floor so date math still works.
  const days = Math.max(1, Math.round(plan.min_interval_secs / 86_400));
  return { plan, interval: { unit: "day", count: days }, intervalLabel: `${days} day(s)` };
}

export default function SubscribeCheckoutPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = use(params);
  const { address, connect, signTransaction } = useWallet();
  const router = useRouter();

  const [loaded, setLoaded] = useState<LoadedPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [payerName, setPayerName] = useState("");
  const [payerEmail, setPayerEmail] = useState("");

  // Mobile QR path (2.6c) — one WalletConnect session per page visit; both
  // signatures (approve + subscribe) arrive as sequential prompts on the phone.
  const connectorRef = useRef<MobileWalletConnect | null>(null);
  if (WC_PROJECT_ID && !connectorRef.current) {
    connectorRef.current = new MobileWalletConnect({
      projectId: WC_PROJECT_ID,
      networkPassphrase: Networks.TESTNET,
    });
  }
  const [mobileAddress, setMobileAddress] = useState<string | null>(null);
  const mobileStartedRef = useRef(false);

  const plan = loaded?.plan ?? null;

  useEffect(() => {
    loadPlan(planId)
      .then(setLoaded)
      .catch(() => setLoaded(null))
      .finally(() => setLoading(false));
  }, [planId]);

  // Browser and mobile run the same subscribe chain; only the signer differs.
  async function runSubscribe(
    subscriber: string,
    sign: (xdr: string) => Promise<string>,
    signingMethod: "mobile" | "web",
  ) {
    if (!loaded) return;
    const { plan, interval, intervalLabel } = loaded;

    setStep("approving");
    setErrorMsg("");

    try {
      // Step 1 — approve SAC allowance
      const currentLedger = await getCurrentLedger();
      const cap = plan.amount * BigInt(1000);
      const expiry = currentLedger + 1_000_000;

      const approveXdr = await buildApproveXdr(subscriber, cap, expiry);
      const signedApprove = await sign(approveXdr);
      await submitAndWaitWithResult(signedApprove);

      // Step 2 — subscribe. Anchor the schedule to now and pass the first
      // billing date (computed from the plan's real interval) to the contract.
      setStep("subscribing");
      const anchor = new Date();
      const nextChargeAt = toUnixSeconds(firstNextChargeAt(anchor, interval));
      // Caller-supplied non-sequential sub id (Snowflake); contract asserts uniqueness (3.2e).
      const subIdSnowflake = snowflakeU64();
      const subscribeXdr = await buildSubscribeXdr(subscriber, BigInt(planId), nextChargeAt, subIdSnowflake);
      const signedSubscribe = await sign(subscribeXdr);
      const subscribeTxHash = await submitAndWait(signedSubscribe);

      const subId = subIdSnowflake.toString();

      const subData = {
        onChainId: subId,
        planOnChainId: planId,
        subscriber,
        merchant: plan.merchant,
        amount: plan.amount.toString(),
        interval: plan.min_interval_secs,
        intervalLabel,
        intervalUnit: interval.unit,
        intervalCount: interval.count,
        planProductName: loaded.productName,
        planDescription: loaded.description ?? undefined,
        anchorAt: anchor.toISOString(),
        periodsCharged: 1,
        payerName: payerName.trim(),
        payerEmail: payerEmail.trim(),
        signingMethod,
        createdAt: Date.now(),
      };

      saveSubscription({ ...subData, planId });

      // Durable record (open bug B2): the subscription exists on-chain, so the
      // DB registration + created event must not be lost to a transient failure.
      // Register the sub first (the event resolves its subscription FK from it),
      // then the event; both retry inline and persist to the outbox on failure.
      await recordDurable({
        key: `sub:${subId}`,
        url: "/api/subscriptions",
        body: subData,
      });
      await recordDurable({
        key: `event:${subscribeTxHash}`,
        url: "/api/events",
        body: {
          type: "subscription.created",
          txHash: subscribeTxHash,
          data: { subId, planId, productName: loaded.productName, payerName: payerName.trim(), payerEmail: payerEmail.trim(), signingMethod },
        },
      });

      setStep("done");
      router.push(`/portal/${subId}`);
    } catch (err) {
      setStep("error");
      setErrorMsg(err instanceof Error ? err.message : "Subscription failed");
    }
  }

  function formComplete() {
    return Boolean(payerName.trim() && payerEmail.trim());
  }

  async function handleSubscribe() {
    if (!address || !loaded) return;
    if (!formComplete()) {
      setStep("error");
      setErrorMsg("Please enter your name and email before subscribing.");
      return;
    }
    await runSubscribe(address, signTransaction, "web");
  }

  const busy = step === "approving" || step === "subscribing";

  // Start the mobile subscribe chain once the wallet is connected AND the
  // identity form is complete — whichever happens last.
  useEffect(() => {
    if (!mobileAddress || mobileStartedRef.current || !formComplete() || !loaded) return;
    mobileStartedRef.current = true;
    void runSubscribe(mobileAddress, (xdr) => connectorRef.current!.signXdr(xdr), "mobile");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileAddress, payerName, payerEmail, loaded]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[calc(100vh-57px)]">
        <p className="text-sm text-neutral-400">Loading plan…</p>
      </div>
    );
  }

  if (!loaded || !plan) {
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
          {loaded.productName && <p className="text-sm font-medium text-neutral-900 mb-1">{loaded.productName}</p>}
          <p className="text-3xl font-bold mb-1">{formatUsdc(plan.amount)} USDC</p>
          <p className="text-sm text-neutral-500 mb-1">per cycle · {loaded.intervalLabel}</p>
          {loaded.description && <p className="text-sm text-neutral-600 mb-4">{loaded.description}</p>}
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

          {/* Mobile QR by default alongside the web-sign button (2.6c) */}
          {connectorRef.current && (
            <>
              <MobileWalletQr
                connector={connectorRef.current}
                onConnected={(addr) => setMobileAddress(addr)}
                title="Scan to subscribe from your phone"
                description="Scan with Freighter mobile, approve the connection, then confirm both prompts: the spending cap, then the subscription."
                connectedLabel={
                  mobileAddress && !formComplete()
                    ? "Connected — enter your name and email above to continue"
                    : "Connected — confirm both prompts on your phone"
                }
                size={180}
              />
              <div className="flex items-center gap-2 my-4">
                <span className="flex-1 h-px bg-neutral-200" />
                <span className="text-xs text-neutral-400">or subscribe in this browser</span>
                <span className="flex-1 h-px bg-neutral-200" />
              </div>
            </>
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
