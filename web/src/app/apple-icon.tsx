import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          borderRadius: 34,
          background: "#071311",
          color: "#d8f7ee",
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: 84,
          fontWeight: 800,
        }}
      >
        <div style={{ position: "absolute", left: 53, top: 48, width: 14, height: 14, borderRadius: 999, background: "#2fbda2" }} />
        <div style={{ position: "absolute", right: 56, top: 34, width: 5, height: 112, borderRadius: 999, background: "rgba(216,247,238,0.28)", transform: "rotate(25deg)" }} />
        S
      </div>,
      size
  );
}
