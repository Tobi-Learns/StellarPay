"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/app", label: "Overview", summary: "Sales snapshot" },
  { href: "/app/payments", label: "Payments", summary: "Customer purchases" },
  { href: "/app/billing", label: "Subscriptions", summary: "Recurring revenue" },
  { href: "/app/developers", label: "Integrations", summary: "Keys and webhooks" },
  { href: "/app/settings", label: "Business", summary: "Profile and wallet" },
];

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-[var(--background)] lg:flex-row">
      <aside className="border-b border-[var(--sp-border)] bg-white px-4 py-3 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r lg:bg-[var(--sp-paper)] lg:px-3 lg:py-6">
        <p className="hidden px-3 pb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--sp-muted)]/70 lg:block">Menu</p>
        <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1 lg:overflow-visible">
          {nav.map(({ href, label, summary }) => {
            const active = href === "/app" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`min-w-max rounded-lg px-3 py-2 text-left text-sm transition-colors lg:min-w-0 lg:py-2.5 ${active ? "bg-[var(--sp-mist)] text-[var(--sp-ink)]" : "text-[var(--sp-muted)] hover:bg-[var(--sp-mist)]/55 hover:text-[var(--sp-ink)]"}`}
              >
                <span className="block font-semibold">{label}</span>
                <span className={`hidden text-xs lg:block ${active ? "text-[var(--sp-muted)]" : "text-[var(--sp-muted)]/75"}`}>{summary}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-10 lg:py-8">{children}</div>
    </div>
  );
}
