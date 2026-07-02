import { useState } from "react";
import { StellarPayClient } from "./client";
import type { StellarPayConfig } from "./types";

type Status = "idle" | "connecting" | "setup" | "building" | "signing" | "submitting" | "success" | "error";

const STATUS_LABEL: Record<Status, string> = {
  idle: "Pay now",
  connecting: "Connecting wallet…",
  setup: "Adding USDC to wallet…",
  building: "Preparing…",
  signing: "Sign in wallet…",
  submitting: "Submitting…",
  success: "Payment sent!",
  error: "Try again",
};

export interface StellarPayButtonProps {
  /** SDK config — spread TESTNET and add your apiBase. */
  config: StellarPayConfig;
  /**
   * Payer's Stellar address. If omitted, Freighter is queried on click.
   * Requires `@stellar/freighter-api` ≥ 6 to be installed.
   */
  payer?: string;
  merchant: string;
  /** Amount in stroops (bigint). Use parseUsdc() to convert from a display string. */
  amount: bigint;
  /** Numeric link ID passed to the contract — matches the numericId on the PaymentLink record. */
  linkId: bigint;
  /**
   * Custom signing function — escape hatch for non-Freighter wallets.
   * Receives an unsigned XDR string, must return a signed XDR string.
   * If omitted, the button signs via Freighter internally.
   * Requires `@stellar/freighter-api` ≥ 6 to be installed.
   */
  signXdr?: (xdr: string) => Promise<string>;
  /**
   * Customer name shown on the merchant dashboard. When provided (with or
   * without payerEmail), the button records the payment.settled event with
   * the platform after settlement — no separate event post needed.
   */
  payerName?: string;
  /** Customer email, recorded alongside payerName. */
  payerEmail?: string;
  onSuccess?: (txHash: string) => void;
  onError?: (error: Error) => void;
  /** Override the button label for each status. Merged with defaults. */
  labels?: Partial<Record<Status, string>>;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

export function StellarPayButton({
  config,
  payer,
  merchant,
  amount,
  linkId,
  signXdr,
  payerName,
  payerEmail,
  onSuccess,
  onError,
  labels,
  children,
  className,
  style,
  disabled,
}: StellarPayButtonProps) {
  const [status, setStatus] = useState<Status>("idle");

  const resolvedLabels = { ...STATUS_LABEL, ...labels };
  const isLoading = status !== "idle" && status !== "success" && status !== "error";

  async function handleClick() {
    if (isLoading) return;

    const c = new StellarPayClient(config);

    try {
      // Discover payer address via Freighter when not provided externally
      let payerAddr = payer;
      if (!payerAddr) {
        setStatus("connecting");
        const freighter = await import("@stellar/freighter-api");
        const connResult = await freighter.isConnected();
        if ("error" in connResult || !connResult.isConnected) {
          throw new Error("Freighter is not installed. Get it at freighter.app");
        }
        const accessResult = await freighter.requestAccess();
        if ("error" in accessResult) throw new Error(accessResult.error);
        payerAddr = accessResult.address;
      }

      // Auto-setup trustline if the user's wallet doesn't have one yet.
      setStatus("setup");
      const trustlineXdr = await c.buildTrustlineXdr(payerAddr);
      if (trustlineXdr) {
        const freighter = await import("@stellar/freighter-api");
        const tlSign = await freighter.signTransaction(trustlineXdr, {
          networkPassphrase: config.networkPassphrase,
          address: payerAddr,
        });
        if ("error" in tlSign) throw new Error(tlSign.error);
        await c.submitAndWait(tlSign.signedTxXdr);
      }

      setStatus("building");
      const xdr = await c.buildPayXdr(payerAddr, merchant, amount, linkId);

      // Sign via provided function (escape hatch) or Freighter internally
      setStatus("signing");
      let signedXdr: string;
      if (signXdr) {
        signedXdr = await signXdr(xdr);
      } else {
        const freighter = await import("@stellar/freighter-api");
        const signResult = await freighter.signTransaction(xdr, {
          networkPassphrase: config.networkPassphrase,
          address: payerAddr,
        });
        if ("error" in signResult) throw new Error(signResult.error);
        signedXdr = signResult.signedTxXdr;
      }

      setStatus("submitting");
      const hash = await c.submitAndWait(signedXdr);

      // Record the settled payment with the platform so the merchant dashboard
      // and webhooks carry customer identity. Fire-and-forget: recording is
      // idempotent by txHash and must never fail an already-settled payment.
      if (payerName || payerEmail) {
        c.recordPaymentSettled({
          txHash: hash,
          merchant,
          amount: amount.toString(),
          linkId: linkId.toString(),
          payerName,
          payerEmail,
          payerWallet: payerAddr,
        }).catch(() => {});
      }

      setStatus("success");
      onSuccess?.(hash);
    } catch (err) {
      setStatus("error");
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isLoading}
      className={className}
      style={style}
    >
      {children ?? resolvedLabels[status]}
    </button>
  );
}
