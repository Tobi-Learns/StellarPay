"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useWallet } from "@/lib/wallet-context";

const nav = [
  { href: "/app", label: "Overview" },
  { href: "/app/payments", label: "Payments" },
  { href: "/app/billing", label: "Billing" },
  { href: "/app/developers", label: "Developers" },
  { href: "/app/settings", label: "Settings" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { address } = useWallet();
  const router = useRouter();

  useEffect(() => {
    if (!address) router.replace("/connect");
  }, [address, router]);

  if (!address) return null;

  return (
    <div className="flex min-h-[calc(100vh-57px)]">
      <aside className="w-52 shrink-0 border-r border-neutral-200 bg-white px-4 py-6">
        <nav className="flex flex-col gap-1">
          {nav.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 px-3 py-2 rounded-lg transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1 px-8 py-6" style={{ backgroundColor: "#f9fafb" }}>{children}</div>
    </div>
  );
}
