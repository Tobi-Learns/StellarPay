import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/lib/wallet-context";
import { Header } from "@/components/header";
import { AuthProvider } from "@/components/auth-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_STELLARPAY_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://stellarpay.vercel.app");

const title = "StellarPay - Wallet-native payments on Stellar";
const description =
  "Turn every wallet into an online bank account. StellarPay helps merchants accept one-time and recurring payments in Stellar assets.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "StellarPay",
  title: {
    default: title,
    template: "%s - StellarPay",
  },
  description,
  keywords: [
    "StellarPay",
    "Stellar payments",
    "wallet payments",
    "recurring crypto payments",
    "Stellar subscriptions",
    "USDC payments",
  ],
  creator: "StellarPay",
  publisher: "StellarPay",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/icon", type: "image/png", sizes: "32x32" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: ["/favicon.ico"],
    apple: [{ url: "/apple-icon", type: "image/png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "StellarPay",
    title,
    description,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "StellarPay - turn every wallet into an online bank account.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/twitter-image"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-[var(--background)] text-[var(--foreground)]">
        <AuthProvider>
          <WalletProvider>
            <Header />
            <main className="flex-1">{children}</main>
          </WalletProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
