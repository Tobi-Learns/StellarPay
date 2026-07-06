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

    QRCode.toString(session.uri, {
      type: "svg",
      errorCorrectionLevel: "L",
      margin: 4,
      width: 340,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((svg) => {
        if (!alive) return;
        setQrSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
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
    <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, padding: 16, background: "#fff", display: "grid", gridTemplateColumns: "minmax(260px, 340px) 1fr", gap: 16, alignItems: "center" }}>
      <div style={{ width: "100%", aspectRatio: "1 / 1", border: "1px solid #e7e5e4", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", padding: 8, boxSizing: "border-box" }}>
        {qrSrc ? <img alt={title} src={qrSrc} style={{ width: "100%", height: "100%", display: "block" }} /> : <span style={{ color: "#a8a29e", fontSize: 12 }}>Generating QR...</span>}
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
