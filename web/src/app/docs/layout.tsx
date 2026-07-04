import type { Metadata } from "next";

export const metadata: Metadata = { title: "Docs — StellarPay" };

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[calc(100vh-4rem)] bg-white">{children}</div>;
}
