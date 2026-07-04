import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "StellarPay - wallet-native payments on Stellar.";
export const size = {
  width: 1200,
  height: 675,
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
          padding: 78,
          color: "#f8fffc",
          background:
            "radial-gradient(circle at 78% 18%, rgba(142,232,208,0.38), transparent 30%), linear-gradient(135deg, #071311 0%, #10231f 52%, #e8f6ef 100%)",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 32, fontWeight: 800 }}>
          <div
            style={{
              width: 56,
              height: 56,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              borderRadius: 14,
              background: "#d8f7ee",
              color: "#071311",
              fontSize: 28,
              fontWeight: 800,
            }}
          >
            <div style={{ position: "absolute", left: 15, top: 14, width: 7, height: 7, borderRadius: 999, background: "#2fbda2" }} />
            <div style={{ position: "absolute", right: 17, top: 11, width: 3, height: 34, borderRadius: 999, background: "rgba(7,19,17,0.24)", transform: "rotate(25deg)" }} />
            S
          </div>
          StellarPay
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ maxWidth: 900, fontSize: 78, fontWeight: 800, lineHeight: 0.95, letterSpacing: 0 }}>
            Turn every wallet into an online bank account.
          </div>
          <div style={{ maxWidth: 800, fontSize: 31, lineHeight: 1.35, color: "#d8f7ee" }}>
            Wallet-native one-time payments and recurring subscriptions on Stellar.
          </div>
        </div>
        <div style={{ fontSize: 24, color: "#e8f6ef" }}>stellarpay.vercel.app</div>
      </div>,
      size
  );
}
