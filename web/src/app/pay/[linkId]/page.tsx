"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Networks } from "@stellar/stellar-sdk";
import { MobileWalletConnect } from "@stellarpay/sdk";
import { MobileWalletQr } from "@stellarpay/sdk/react";
import { useWallet } from "@/lib/wallet-context";
import { buildPayXdr, submitAndWait, formatUsdc, truncateAddress } from "@/lib/stellar";
import { decodeLink } from "@/lib/payment-links";

const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

interface MerchantProfile { displayName?: string | null; verified?: boolean }

// The link IS the numericId now; the page looks it up in the DB (like /subscribe
// resolves a plan by id), so the amount/merchant are server-authoritative, not
// read from a tamperable URL blob. Old self-contained blob links still decode as
// a fallback so anything shared before this change keeps working.
type LinkData = { id?: string; merchant: string; amount: string; numericId: string; productName?: string; description?: string };

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

  // Mobile QR path (2.6c) — one WalletConnect session per page visit. The QR
  // renders by default alongside the web-sign button; the wallet returns its
  // address at scan/connect, then the pay XDR is signed on the phone.
  const connectorRef = useRef<MobileWalletConnect | null>(null);
  if (WC_PROJECT_ID && !connectorRef.current) {
    connectorRef.current = new MobileWalletConnect({
      projectId: WC_PROJECT_ID,
      networkPassphrase: Networks.TESTNET,
    });
  }
  const [mobileAddress, setMobileAddress] = useState<string | null>(null);
  const mobileStartedRef = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      // Primary: resolve the link by numericId from the DB.
      try {
        const res = await fetch(`/api/payments/${encodeURIComponent(linkId)}`);
        if (res.ok) {
          const row = await res.json() as { id: string; merchant: string; amount: string; numericId: string; productName?: string | null; description?: string | null };
          if (active) {
            setLink({
              id: row.id,
              merchant: row.merchant,
              amount: row.amount,
              numericId: row.numericId,
              productName: row.productName ?? undefined,
              description: row.description ?? undefined,
            });
            setLoadState("ready");
          }
          return;
        }
      } catch { /* fall through to legacy decode */ }
      // Legacy fallback: old self-contained base64 blob links.
      try {
        const d = decodeLink(linkId);
        if (active) {
          setLink({
            merchant: d.merchant,
            amount: d.amount,
            numericId: String(d.id ?? ""),
            productName: d.productName,
            description: d.description,
          });
          setLoadState("ready");
        }
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

  // Start the mobile payment once the wallet is connected AND the identity
  // form is complete — whichever happens last. If the customer scans before
  // typing, the sign request fires as soon as the form is filled.
  // (Must sit above the early returns below — hooks can't be conditional.)
  useEffect(() => {
    if (!mobileAddress || mobileStartedRef.current || !link) return;
    if (!payerName.trim() || !payerEmail.trim()) return;
    mobileStartedRef.current = true;
    void settle(mobileAddress, (xdr) => connectorRef.current!.signXdr(xdr));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileAddress, payerName, payerEmail, link]);

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

  // Browser and mobile run the same settlement path; only the signer differs.
  async function settle(payerAddr: string, sign: (xdr: string) => Promise<string>) {
    if (!link) return;

    setStatus("signing");
    setErrorMsg("");

    try {
      if (!link.numericId) throw new Error("Payment link is missing its numeric id.");

      const xdr = await buildPayXdr(payerAddr, link.merchant, BigInt(link.amount), BigInt(link.numericId));
      const signedTxXdr = await sign(xdr);

      setStatus("submitting");
      const txHash = await submitAndWait(signedTxXdr);

      fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "payment.settled",
          txHash,
          paymentLinkId: link.id,
          data: {
            amount: link.amount,
            merchant: link.merchant,
            linkId,
            productName: link.productName,
            payerName: payerName.trim(),
            payerEmail: payerEmail.trim(),
            payerWallet: payerAddr,
          },
        }),
      }).catch(() => {});

      const qs = new URLSearchParams({
        amount: amountDisplay,
        merchant: merchant?.displayName ?? link.merchant,
        productName: link.productName ?? "",
        description: link.description ?? "",
      });
      router.push(`/receipt/${txHash}?${qs.toString()}`);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Payment failed");
    }
  }

  function formComplete() {
    return Boolean(payerName.trim() && payerEmail.trim());
  }

  async function handlePay() {
    if (!address || !link) return;
    if (!formComplete()) {
      setStatus("error");
      setErrorMsg("Please enter your name and email before paying.");
      return;
    }
    await settle(address, signTransaction);
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
          {link.productName && <p className="text-sm font-medium text-neutral-900 mb-1">{link.productName}</p>}
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

          {/* Mobile QR by default alongside the web-sign button (2.6c) */}
          {connectorRef.current && (
            <>
              <MobileWalletQr
                connector={connectorRef.current}
                onConnected={(addr) => setMobileAddress(addr)}
                title="Scan to pay from your phone"
                description="Scan with Freighter mobile, approve the connection, then confirm the payment on your phone."
                connectedLabel={
                  mobileAddress && !formComplete()
                    ? "Connected — enter your name and email above to continue"
                    : "Connected — confirm the payment on your phone"
                }
                size={180}
              />
              <div className="flex items-center gap-2 my-4">
                <span className="flex-1 h-px bg-neutral-200" />
                <span className="text-xs text-neutral-400">or pay in this browser</span>
                <span className="flex-1 h-px bg-neutral-200" />
              </div>
            </>
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
