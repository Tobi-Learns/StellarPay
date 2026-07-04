import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          borderRadius: 6,
          background: "#071311",
          color: "#d8f7ee",
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: 15,
          fontWeight: 800,
        }}
      >
        <div style={{ position: "absolute", left: 9, top: 8, width: 3, height: 3, borderRadius: 999, background: "#2fbda2" }} />
        <div style={{ position: "absolute", right: 10, top: 6, width: 1, height: 20, borderRadius: 999, background: "rgba(216,247,238,0.28)", transform: "rotate(25deg)" }} />
        S
      </div>,
      size
  );
}
