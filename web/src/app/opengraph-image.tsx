import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "StellarPay - turn every wallet into an online bank account.";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          color: "#f8fffc",
          background:
            "radial-gradient(circle at 80% 10%, rgba(142,232,208,0.34), transparent 32%), linear-gradient(135deg, #071311 0%, #10231f 48%, #e8f6ef 100%)",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: 0,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 14,
              background: "#d8f7ee",
              color: "#071311",
              fontSize: 28,
              fontWeight: 800,
            }}
          >
            SP
          </div>
          StellarPay
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ maxWidth: 920, fontSize: 76, fontWeight: 800, lineHeight: 0.95, letterSpacing: 0 }}>
            Turn every wallet into an online bank account.
          </div>
          <div style={{ maxWidth: 820, fontSize: 30, lineHeight: 1.35, color: "#d8f7ee" }}>
            Accept one-time payments and recurring subscriptions in Stellar assets.
          </div>
        </div>

        <div style={{ display: "flex", gap: 22, fontSize: 24, color: "#e8f6ef" }}>
          <span>Hosted checkout</span>
          <span>Embedded button</span>
          <span>Headless SDK</span>
        </div>
      </div>,
      size
  );
}
