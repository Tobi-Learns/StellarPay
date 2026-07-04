"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { useWallet } from "@/lib/wallet-context";

const nav = [
  { href: "/app", label: "Overview", summary: "Sales snapshot" },
  { href: "/app/payments", label: "Payments", summary: "Customer purchases" },
  { href: "/app/billing", label: "Subscriptions", summary: "Recurring revenue" },
  { href: "/app/developers", label: "Integrations", summary: "Keys and webhooks" },
  { href: "/app/settings", label: "Business", summary: "Profile and wallet" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { address } = useWallet();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!address) router.replace("/connect");
  }, [address, router]);

  if (!address) return null;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-[#f3f6f2] lg:flex-row">
      <aside className="border-b border-black/5 bg-white/92 px-4 py-3 shadow-[0_12px_34px_rgba(7,19,17,0.05)] lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:w-72 lg:shrink-0 lg:border-b-0 lg:border-r lg:border-black/5 lg:bg-[var(--sp-ink)] lg:px-4 lg:py-5 lg:text-white lg:shadow-none">
        <div className="hidden items-center gap-3 pb-6 lg:flex">
          <BrandMark tone="light" />
          <div>
            <p className="text-sm font-semibold text-white">Merchant dashboard</p>
            <p className="mt-0.5 text-xs text-white/55">Sales and subscriptions</p>
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1 lg:overflow-visible">
          {nav.map(({ href, label, summary }) => {
            const isActive = href === "/app" ? pathname === href : pathname.startsWith(href);

            return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`min-w-max rounded-lg px-3 py-2 text-left text-sm transition-colors lg:min-w-0 lg:px-3.5 lg:py-3 ${
                isActive
                  ? "bg-[var(--sp-ink)] text-white shadow-sm lg:bg-white lg:text-[var(--sp-ink)]"
                  : "text-[var(--sp-muted)] hover:bg-[var(--sp-mist)] hover:text-[var(--sp-ink)] lg:text-white/62 lg:hover:bg-white/8 lg:hover:text-white"
              }`}
            >
              <span className="block font-semibold">{label}</span>
              <span className={`hidden text-xs lg:block ${isActive ? "text-white/62 lg:text-[var(--sp-muted)]" : "text-[var(--sp-muted)] lg:text-white/42"}`}>
                {summary}
              </span>
            </Link>
            );
          })}
        </nav>

        <div className="mt-6 hidden rounded-xl border border-white/10 bg-white/6 p-4 lg:block">
          <p className="text-xs font-semibold uppercase tracking-normal text-[var(--sp-mint)]">Connected wallet</p>
          <p className="mt-2 break-all font-mono text-xs leading-5 text-white/58">{address}</p>
        </div>
      </aside>
      <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-10 lg:py-8">{children}</div>
    </div>
  );
}
