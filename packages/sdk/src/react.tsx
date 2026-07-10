import { useCallback, useEffect, useRef, useState } from "react";
import * as QRCode from "qrcode";
import { StellarPayClient } from "./client";
import { MobileWalletConnect } from "./mobile";
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
   * WalletConnect Cloud project id (free at https://cloud.reown.com).
   * When set, the component renders the mobile QR by default alongside the
   * web-sign button (mobile-banking checkout pattern): the customer either
   * scans with a mobile Stellar wallet or signs in the browser. When unset,
   * only the plain browser-signing button renders (previous behavior).
   */
  walletConnectProjectId?: string;
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
  walletConnectProjectId,
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
  // One WalletConnect session per mounted checkout.
  const connectorRef = useRef<MobileWalletConnect | null>(null);
  if (walletConnectProjectId && !connectorRef.current) {
    connectorRef.current = new MobileWalletConnect({
      projectId: walletConnectProjectId,
      networkPassphrase: config.networkPassphrase,
    });
  }

  const resolvedLabels = { ...STATUS_LABEL, ...labels };
  const isLoading = status !== "idle" && status !== "success" && status !== "error";

  // The browser and mobile paths run the same flow; only the signer differs.
  async function runPay(payerAddr: string, sign: (xdr: string) => Promise<string>) {
    const c = new StellarPayClient(config);

    // Auto-setup trustline if the user's wallet doesn't have one yet.
    setStatus("setup");
    const trustlineXdr = await c.buildTrustlineXdr(payerAddr);
    if (trustlineXdr) {
      const tlSigned = await sign(trustlineXdr);
      await c.submitAndWait(tlSigned);
    }

    setStatus("building");
    const xdr = await c.buildPayXdr(payerAddr, merchant, amount, linkId);

    setStatus("signing");
    const signedXdr = await sign(xdr);

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
  }

  async function signWithFreighter(xdr: string, address: string): Promise<string> {
    const freighter = await import("@stellar/freighter-api");
    const result = await freighter.signTransaction(xdr, {
      networkPassphrase: config.networkPassphrase,
      address,
    });
    if ("error" in result) throw new Error(result.error);
    return result.signedTxXdr;
  }

  function fail(err: unknown) {
    setStatus("error");
    onError?.(err instanceof Error ? err : new Error(String(err)));
  }

  async function handleClick() {
    if (isLoading) return;

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

      const addr = payerAddr;
      await runPay(addr, (xdr) => (signXdr ? signXdr(xdr) : signWithFreighter(xdr, addr)));
    } catch (err) {
      fail(err);
    }
  }

  async function handleMobileConnected(address: string) {
    try {
      await runPay(address, (xdr) => connectorRef.current!.signXdr(xdr));
    } catch (err) {
      fail(err);
    }
  }

  const button = (
    <button
      onClick={handleClick}
      disabled={disabled || isLoading}
      className={className}
      style={style}
    >
      {children ?? resolvedLabels[status]}
    </button>
  );

  // Without a WalletConnect project id, behave exactly as before: one button.
  if (!connectorRef.current) return button;

  // Mobile-banking checkout pattern: QR displayed by default alongside the
  // web-sign button. The customer picks scan-with-phone or sign-in-browser.
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <MobileWalletQr
        connector={connectorRef.current}
        onConnected={handleMobileConnected}
        onError={fail}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ flex: 1, height: 1, background: "#e5e5e5" }} />
        <span style={{ fontSize: 11, color: "#8a8a8a" }}>or</span>
        <span style={{ flex: 1, height: 1, background: "#e5e5e5" }} />
      </div>
      {button}
    </div>
  );
}

// ── Mobile wallet QR (2.6b) ──────────────────────────────────────────────────
//
// Inline, displayed-by-default WalletConnect pairing QR — the mobile-banking
// checkout pattern. Renders on mount, counts down to pairing expiry (~5 min),
// offers refresh, and hands the connected wallet to the parent flow via
// onConnected. On http/localhost origins (where Freighter mobile refuses to
// sign) it renders an explanatory note instead of a dead QR.

export type MobileQrPhase =
  | "unsupported"
  | "generating"
  | "scan"
  | "expired"
  | "connected"
  | "error";

export interface MobileWalletQrProps {
  /** The session to pair — create one MobileWalletConnect per checkout. */
  connector: MobileWalletConnect;
  /**
   * Called once the customer approves the connection in their wallet.
   * Build the transaction with this address, then sign via connector.signXdr —
   * each call pops a sign prompt on the phone over the same session.
   */
  onConnected: (address: string) => void | Promise<void>;
  onError?: (error: Error) => void;
  /** Shown above the QR. Default: "Scan to pay from your phone". */
  title?: string;
  /** Shown under the title while scannable. */
  description?: string;
  /** Status line once connected. Default: "Connected — continue on your phone". */
  connectedLabel?: string;
  /** QR square size in px. Default 220. */
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function MobileWalletQr({
  connector,
  onConnected,
  onError,
  title = "Scan to pay from your phone",
  description = "Scan with a WalletConnect-capable Stellar wallet (Freighter mobile), approve the connection, then confirm on your phone.",
  connectedLabel = "Connected — continue on your phone",
  size = 220,
  className,
  style,
}: MobileWalletQrProps) {
  const [phase, setPhase] = useState<MobileQrPhase>("generating");
  const [qrSrc, setQrSrc] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  // Increment to abandon a stale pairing and start a new one.
  const [generation, setGeneration] = useState(0);
  const connectedRef = useRef(false);

  const refresh = useCallback(() => {
    connectedRef.current = false;
    setGeneration((g) => g + 1);
  }, []);

  // Disconnect this checkout's WalletConnect session when the component
  // unmounts (customer closes/navigates away), so sessions don't linger in
  // the wallet's "Connected Apps" and accumulate across visits. Keyed only on
  // `connector` (stable), so it runs on unmount — not on QR refresh, where
  // createPairing already resets sessions.
  useEffect(() => {
    return () => {
      void connector.disconnect();
    };
  }, [connector]);

  useEffect(() => {
    const support = MobileWalletConnect.isSupportedOrigin();
    if (!support.ok) {
      setPhase("unsupported");
      setErrorMsg(support.reason);
      return;
    }

    let alive = true;
    let expiryTimer: ReturnType<typeof setInterval> | undefined;
    setPhase("generating");
    setQrSrc("");
    setErrorMsg("");

    (async () => {
      try {
        const pairing = await connector.createPairing();
        if (!alive) return;

        const svg = await QRCode.toString(pairing.uri, {
          type: "svg",
          errorCorrectionLevel: "M",
          margin: 2,
          color: { dark: "#000000", light: "#ffffff" },
        });
        if (!alive) return;
        setQrSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
        setPhase("scan");

        expiryTimer = setInterval(() => {
          const left = Math.max(0, Math.round((pairing.expiresAt.getTime() - Date.now()) / 1000));
          setSecondsLeft(left);
          if (left === 0 && !connectedRef.current) {
            setPhase((p) => (p === "scan" ? "expired" : p));
          }
        }, 1000);

        const address = await pairing.approval;
        if (!alive) return;
        connectedRef.current = true;
        setPhase("connected");
        await onConnected(address);
      } catch (e) {
        if (!alive || connectedRef.current) return;
        const err = e instanceof Error ? e : new Error(String(e));
        // Proposal expiry surfaces as a rejection — show the refresh state
        // rather than a hard error.
        if (/expir/i.test(err.message)) {
          setPhase("expired");
        } else {
          setPhase("error");
          setErrorMsg(err.message);
          onError?.(err);
        }
      }
    })();

    return () => {
      alive = false;
      if (expiryTimer) clearInterval(expiryTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connector, generation]);

  const mmss = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;

  return (
    <div className={className} style={{ textAlign: "center", ...style }}>
      <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600 }}>{title}</p>

      {phase === "unsupported" && (
        <p style={{ margin: 0, fontSize: 12, color: "#8a8a8a", maxWidth: size + 40, marginInline: "auto" }}>
          {errorMsg}
        </p>
      )}

      {(phase === "generating" || phase === "scan") && (
        <>
          <div
            style={{
              width: size,
              height: size,
              margin: "8px auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid #e5e5e5",
              borderRadius: 8,
              background: "#fff",
              padding: 6,
              boxSizing: "content-box",
            }}
          >
            {qrSrc ? (
              <img src={qrSrc} alt={title} style={{ width: "100%", height: "100%", display: "block" }} />
            ) : (
              <span style={{ fontSize: 12, color: "#8a8a8a" }}>Generating QR…</span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "#8a8a8a", maxWidth: size + 40, marginInline: "auto" }}>
            {description}
          </p>
          {phase === "scan" && secondsLeft > 0 && (
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#8a8a8a" }}>QR expires in {mmss}</p>
          )}
        </>
      )}

      {phase === "expired" && (
        <div style={{ margin: "8px auto", maxWidth: size + 40 }}>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "#8a8a8a" }}>This QR code expired.</p>
          <button
            onClick={refresh}
            style={{ padding: "8px 16px", fontSize: 13, borderRadius: 6, border: "1px solid #d4d4d4", background: "#fff", cursor: "pointer" }}
          >
            Show a new QR
          </button>
        </div>
      )}

      {phase === "connected" && (
        <p style={{ margin: "8px 0 0", fontSize: 13, fontWeight: 600, color: "#217669" }}>{connectedLabel}</p>
      )}

      {phase === "error" && (
        <div style={{ margin: "8px auto", maxWidth: size + 40 }}>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "#b91c1c", overflowWrap: "anywhere" }}>{errorMsg}</p>
          <button
            onClick={refresh}
            style={{ padding: "8px 16px", fontSize: 13, borderRadius: 6, border: "1px solid #d4d4d4", background: "#fff", cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
