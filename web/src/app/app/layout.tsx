"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
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
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-[var(--background)] lg:flex-row">
      <aside className="border-b border-[var(--sp-border)] bg-white px-4 py-3 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r lg:border-[var(--sp-border)] lg:bg-[var(--sp-paper)] lg:px-3 lg:py-6">
        <p className="hidden px-3 pb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--sp-muted)]/70 lg:block">
          Menu
        </p>

        <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1 lg:overflow-visible">
          {nav.map(({ href, label, summary }) => {
            const isActive = href === "/app" ? pathname === href : pathname.startsWith(href);

            return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`min-w-max rounded-lg px-3 py-2 text-left text-sm transition-colors lg:min-w-0 lg:py-2.5 ${
                isActive
                  ? "bg-[var(--sp-mist)] text-[var(--sp-ink)]"
                  : "text-[var(--sp-muted)] hover:bg-[var(--sp-mist)]/55 hover:text-[var(--sp-ink)]"
              }`}
            >
              <span className="block font-semibold">{label}</span>
              <span className={`hidden text-xs lg:block ${isActive ? "text-[var(--sp-muted)]" : "text-[var(--sp-muted)]/75"}`}>
                {summary}
              </span>
            </Link>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-10 lg:py-8">{children}</div>
    </div>
  );
}
