import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Repo root, not web/: @stellarpay/sdk is a file: dep living in
    // ../packages/sdk, and Turbopack resolves symlinked packages by their
    // real path - which must be inside the root.
    root: path.join(__dirname, ".."),
  },
};

export default nextConfig;
