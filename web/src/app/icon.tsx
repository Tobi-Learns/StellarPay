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
          borderRadius: 6,
          background: "#071311",
          color: "#d8f7ee",
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: 15,
          fontWeight: 800,
        }}
      >
        S
      </div>,
      size
  );
}
