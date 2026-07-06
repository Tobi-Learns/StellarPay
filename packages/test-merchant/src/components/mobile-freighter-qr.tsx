"use client";

import { useEffect, useState } from "react";
import * as QRCode from "qrcode";

type MobileSigningStatus = "pending" | "submitted" | "settled" | "rejected" | "expired";

export type MobileSigningSession = {
  id: string;
  uri: string;
  statusUrl: string;
};

type StatusResponse = {
  status: MobileSigningStatus;
  message?: string;
  txHash?: string;
  error?: string;
};

export function MobileFreighterQr({
  session,
  title,
  description,
  onSettled,
}: {
  session: MobileSigningSession | null;
  title: string;
  description: string;
  onSettled: (status: StatusResponse) => void | Promise<void>;
}) {
  const [qrSrc, setQrSrc] = useState("");
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [reportedSettled, setReportedSettled] = useState(false);

  useEffect(() => {
    let alive = true;
    setQrSrc("");
    setStatus(null);
    setReportedSettled(false);
    if (!session) return;

    QRCode.toDataURL(session.uri, { errorCorrectionLevel: "M", margin: 1, width: 220 })
      .then((src) => {
        if (alive) setQrSrc(src);
      })
      .catch((e) => {
        if (alive) setStatus({ status: "rejected", error: String(e) });
      });

    return () => {
      alive = false;
    };
  }, [session]);

  useEffect(() => {
    if (!session) return;
    let alive = true;

    async function poll() {
      try {
        const res = await fetch(session!.statusUrl, { cache: "no-store" });
        const body = await res.json() as StatusResponse;
        if (!alive) return;
        setStatus(body);
        if (body.status === "settled" && !reportedSettled) {
          setReportedSettled(true);
          void onSettled(body);
        }
      } catch (e) {
        if (alive) setStatus({ status: "rejected", error: String(e) });
      }
    }

    void poll();
    const timer = window.setInterval(() => void poll(), 2000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [session, onSettled, reportedSettled]);

  if (!session) return null;

  const waiting = !status || status.status === "pending" || status.status === "submitted";

  return (
    <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, padding: 16, background: "#fff", display: "grid", gridTemplateColumns: "auto 1fr", gap: 16, alignItems: "center" }}>
      <div style={{ width: 220, height: 220, border: "1px solid #e7e5e4", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" }}>
        {qrSrc ? <img alt={title} src={qrSrc} width={220} height={220} /> : <span style={{ color: "#a8a29e", fontSize: 12 }}>Generating QR...</span>}
      </div>
      <div>
        <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: "#1c1917" }}>{title}</p>
        <p style={{ margin: "0 0 12px", color: "#78716c", fontSize: 13, lineHeight: 1.5 }}>{description}</p>
        <p style={{ margin: 0, color: waiting ? "#d97706" : status?.status === "settled" ? "#059669" : "#dc2626", fontSize: 12, fontWeight: 700 }}>
          {status?.message ?? "Waiting for mobile Freighter scan..."}
        </p>
        {status?.error && (
          <p style={{ margin: "8px 0 0", color: "#dc2626", fontSize: 12, overflowWrap: "anywhere" }}>{status.error}</p>
        )}
      </div>
    </div>
  );
}
