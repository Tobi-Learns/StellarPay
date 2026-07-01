import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stellar Roast — Specialty Coffee",
  description: "Premium coffee, delivered. Powered by StellarPay.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0, fontFamily: "'Inter', system-ui, sans-serif", background: "#fafaf9", color: "#1c1917" }}>
        {children}
      </body>
    </html>
  );
}
