"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/lib/wallet-context";

interface Profile {
  displayName: string;
  email: string;
  logoUrl: string;
}

export default function SettingsPage() {
  const { address } = useWallet();
  const [profile, setProfile] = useState<Profile>({ displayName: "", email: "", logoUrl: "" });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    if (!address) return;
    fetch(`/api/merchants/${address}`)
      .then((r) => r.json())
      .then((m) => {
        if (m && !m.error) setProfile({ displayName: m.displayName ?? "", email: m.email ?? "", logoUrl: m.logoUrl ?? "" });
      })
      .catch(() => {});
  }, [address]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!address) return;
    setStatus("saving");

    try {
      await fetch(`/api/merchants/${address}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold mb-6">Profile</h1>

      {!address ? (
        <p className="text-sm text-neutral-400">Connect your wallet first.</p>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Display name</label>
            <input
              type="text"
              placeholder="Acme Corp"
              value={profile.displayName}
              onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
              maxLength={80}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Logo URL</label>
            <input
              type="url"
              placeholder="https://example.com/logo.png"
              value={profile.logoUrl}
              onChange={(e) => setProfile({ ...profile, logoUrl: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={status === "saving"}
              className="px-5 py-2 rounded-lg bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-700 disabled:opacity-50 transition-colors"
            >
              {status === "saving" ? "Saving…" : "Save"}
            </button>
            {status === "saved" && <p className="text-sm text-green-600">Saved!</p>}
            {status === "error" && <p className="text-sm text-red-500">Save failed.</p>}
          </div>

          <div className="pt-2 p-4 bg-neutral-50 rounded-lg border border-neutral-200">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">Verified</span>
              <span className="text-xs text-neutral-400">Tier 1 stub</span>
            </div>
            <p className="text-xs text-neutral-400">
              Tier 1 verification is mocked for MVP. Your "Verified" badge is shown on all payment links. Real KYC is a Phase 4 feature.
            </p>
          </div>
        </form>
      )}
    </div>
  );
}
