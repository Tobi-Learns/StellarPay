"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/lib/wallet-context";
import { SkeletonRow } from "@/components/skeleton";

interface WebhookRecord {
  id: string;
  url: string;
  createdAt: string;
}

interface NewWebhook {
  id: string;
  url: string;
  secret: string;
}

interface ApiKeyRecord {
  id: string;
  name: string | null;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface NewKey {
  id: string;
  key: string;
  prefix: string;
}

export default function DevelopersPage() {
  const { address } = useWallet();
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [newWebhook, setNewWebhook] = useState<NewWebhook | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [addingWebhook, setAddingWebhook] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [removingWebhook, setRemovingWebhook] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<NewKey | null>(null);
  const [keyName, setKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    const enc = encodeURIComponent(address);
    Promise.all([
      fetch(`/api/keys?merchant=${enc}`).then((r) => r.json()).catch(() => []),
      fetch(`/api/webhooks?merchant=${enc}`).then((r) => r.json()).catch(() => []),
    ]).then(([keyData, hookData]) => {
      if (Array.isArray(keyData)) setKeys(keyData);
      if (Array.isArray(hookData)) setWebhooks(hookData);
    }).finally(() => setLoading(false));
  }, [address]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!address) return;
    setCreating(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchant: address, name: keyName.trim() || null }),
      });
      const data = await res.json();
      setNewKey({ id: data.id, key: data.key, prefix: data.prefix });
      setKeys((prev) => [{ id: data.id, name: data.name, prefix: data.prefix, createdAt: data.createdAt, lastUsedAt: null }, ...prev]);
      setKeyName("");
      setShowForm(false);
    } finally {
      setCreating(false);
    }
  }

  async function handleAddWebhook(e: React.FormEvent) {
    e.preventDefault();
    if (!address) return;
    setAddingWebhook(true);
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchant: address, url: webhookUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      setNewWebhook({ id: data.id, url: data.url, secret: data.secret });
      setWebhooks((prev) => [{ id: data.id, url: data.url, createdAt: data.createdAt }, ...prev]);
      setWebhookUrl("");
      setShowWebhookForm(false);
    } finally {
      setAddingWebhook(false);
    }
  }

  async function handleRemoveWebhook(id: string) {
    if (!confirm("Remove this webhook endpoint?")) return;
    setRemovingWebhook(id);
    try {
      await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
    } finally {
      setRemovingWebhook(null);
    }
  }

  function copySecret(secret: string) {
    navigator.clipboard.writeText(secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  }

  async function handleRevoke(id: string) {
    if (!confirm("Revoke this key? Any integrations using it will stop working.")) return;
    setRevoking(id);
    try {
      await fetch(`/api/keys/${id}`, { method: "DELETE" });
      setKeys((prev) => prev.filter((k) => k.id !== id));
    } finally {
      setRevoking(null);
    }
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Developers</h1>
          <a
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            Read the docs ↗
          </a>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-sm bg-neutral-900 text-white px-4 py-2 rounded-lg hover:bg-neutral-700 transition-colors"
          >
            Generate key
          </button>
        )}
      </div>

      {/* New key reveal */}
      {newKey && (
        <div className="mb-6 border border-green-200 bg-green-50 rounded-lg p-4">
          <p className="text-sm font-medium text-green-800 mb-2">
            Key generated — copy it now. It won&apos;t be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-white border border-green-200 rounded px-3 py-2 font-mono break-all">
              {newKey.key}
            </code>
            <button
              onClick={() => copyKey(newKey.key)}
              className="shrink-0 text-xs px-3 py-2 rounded border border-green-300 hover:bg-green-100 transition-colors"
            >
              {copiedKey ? "Copied!" : "Copy"}
            </button>
          </div>
          <button
            onClick={() => setNewKey(null)}
            className="mt-3 text-xs text-green-700 underline"
          >
            I&apos;ve saved it, dismiss
          </button>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 border border-neutral-200 rounded-lg bg-white p-4">
          <p className="text-sm font-medium mb-3">New API key</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Label (optional — e.g. Production)"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              className="flex-1 text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
            <button
              type="submit"
              disabled={creating}
              className="text-sm bg-neutral-900 text-white px-4 py-2 rounded-lg hover:bg-neutral-700 transition-colors disabled:opacity-50"
            >
              {creating ? "Generating…" : "Generate"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setKeyName(""); }}
              className="text-sm px-4 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Key list */}
      <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wide mb-3">Active keys</h2>
      {loading ? (
        <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg bg-white">
          {[...Array(2)].map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : keys.length === 0 ? (
        <div className="text-center py-16 text-sm text-neutral-400">
          No API keys yet. Generate one to start integrating.
        </div>
      ) : (
        <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg bg-white">
          {keys.map((k) => (
            <div key={k.id} className="flex items-center gap-4 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium font-mono">{k.prefix}••••••••••••••••••••••••</p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {k.name && <span>{k.name} · </span>}
                  Created {new Date(k.createdAt).toLocaleDateString()}
                  {k.lastUsedAt && <span> · Last used {new Date(k.lastUsedAt).toLocaleDateString()}</span>}
                </p>
              </div>
              <button
                onClick={() => handleRevoke(k.id)}
                disabled={revoking === k.id}
                className="shrink-0 text-xs px-3 py-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {revoking === k.id ? "Revoking…" : "Revoke"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Webhooks */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wide">Webhook endpoints</h2>
          {!showWebhookForm && (
            <button
              onClick={() => setShowWebhookForm(true)}
              className="text-xs px-3 py-1.5 rounded border border-neutral-200 hover:bg-neutral-50 transition-colors"
            >
              Add endpoint
            </button>
          )}
        </div>

        {/* New webhook secret reveal */}
        {newWebhook && (
          <div className="mb-4 border border-green-200 bg-green-50 rounded-lg p-4">
            <p className="text-sm font-medium text-green-800 mb-2">
              Signing secret — copy it now. It won&apos;t be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-white border border-green-200 rounded px-3 py-2 font-mono break-all">
                {newWebhook.secret}
              </code>
              <button
                onClick={() => copySecret(newWebhook.secret)}
                className="shrink-0 text-xs px-3 py-2 rounded border border-green-300 hover:bg-green-100 transition-colors"
              >
                {copiedSecret ? "Copied!" : "Copy"}
              </button>
            </div>
            <button onClick={() => setNewWebhook(null)} className="mt-3 text-xs text-green-700 underline">
              I&apos;ve saved it, dismiss
            </button>
          </div>
        )}

        {/* Add webhook form */}
        {showWebhookForm && (
          <form onSubmit={handleAddWebhook} className="mb-4 border border-neutral-200 rounded-lg bg-white p-4">
            <p className="text-sm font-medium mb-3">New webhook endpoint</p>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://your-app.com/webhooks/stellarpay"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                required
                className="flex-1 text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
              <button
                type="submit"
                disabled={addingWebhook}
                className="text-sm bg-neutral-900 text-white px-4 py-2 rounded-lg hover:bg-neutral-700 transition-colors disabled:opacity-50"
              >
                {addingWebhook ? "Adding…" : "Add"}
              </button>
              <button
                type="button"
                onClick={() => { setShowWebhookForm(false); setWebhookUrl(""); }}
                className="text-sm px-4 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
            </div>
            <p className="mt-2 text-xs text-neutral-400">
              Events sent: payment.settled · subscription.charged · subscription.past_due · subscription.canceled
            </p>
          </form>
        )}

        {loading ? (
          <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg bg-white">
            <SkeletonRow />
          </div>
        ) : webhooks.length === 0 ? (
          <p className="text-sm text-neutral-400 py-4">No webhook endpoints registered.</p>
        ) : (
          <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg bg-white">
            {webhooks.map((w) => (
              <div key={w.id} className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{w.url}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">Added {new Date(w.createdAt).toLocaleDateString()}</p>
                </div>
                <button
                  onClick={() => handleRemoveWebhook(w.id)}
                  disabled={removingWebhook === w.id}
                  className="shrink-0 text-xs px-3 py-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {removingWebhook === w.id ? "Removing…" : "Remove"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SDK snippet */}
      <div className="mt-8 border border-neutral-200 rounded-lg bg-white p-4">
        <p className="text-sm font-medium mb-2">SDK usage</p>
        <pre className="text-xs bg-neutral-50 border border-neutral-100 rounded p-3 overflow-x-auto"><code>{`import { StellarPayClient, TESTNET } from "@stellarpay/sdk";

const client = new StellarPayClient({
  ...TESTNET,
  apiBase: "${typeof window !== "undefined" ? window.location.origin : "https://your-app.vercel.app"}",
});`}</code></pre>
      </div>
    </div>
  );
}
