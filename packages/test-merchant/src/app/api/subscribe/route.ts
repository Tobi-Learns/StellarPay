import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.STELLARPAY_API_BASE!;
const API_KEY = process.env.STELLARPAY_API_KEY;

function platformHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
  };
}

// Server-side proxies to the StellarPay platform API. The browser (port 3001)
// can't call the platform (port 3000) directly (CORS), so subscription reads and
// writes are proxied here. Plans are pre-provisioned by the seed and referenced
// by id from env, so there is no plan lookup/creation.

// List the connected wallet's subscriptions (3.3 — powers /account + the
// duplicate-subscription pre-check on the subscribe pages).
export async function GET(req: NextRequest) {
  const subscriber = req.nextUrl.searchParams.get("subscriber");
  if (!subscriber) return NextResponse.json({ error: "subscriber required" }, { status: 400 });
  try {
    const res = await fetch(`${API_BASE}/api/subscriptions?subscriber=${encodeURIComponent(subscriber)}`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// Register a subscription after the subscribe tx lands. Forwards the platform's
// status (e.g. 409 from the duplicate-subscription guard) so the client can react.
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as {
      onChainId: string;
      planOnChainId: string;
      subscriber: string;
      merchant: string;
      amount: string;
      anchorAt?: string;
      payerName?: string;
      payerEmail?: string;
    };

    const res = await fetch(`${API_BASE}/api/subscriptions`, {
      method: "POST",
      headers: platformHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      let message = "Failed to register subscription";
      try { message = (JSON.parse(text) as { error?: string }).error ?? message; } catch { /* non-JSON */ }
      return NextResponse.json({ error: message }, { status: res.status });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// Update a subscription's status (3.3b cancel — optimistic DB reflect after the
// on-chain cancel; the cron would also sync it on the next pass).
export async function PUT(req: NextRequest) {
  try {
    const { onChainId, status } = await req.json() as { onChainId: string; status: string };
    if (!onChainId || !status) {
      return NextResponse.json({ error: "onChainId and status required" }, { status: 400 });
    }
    const res = await fetch(`${API_BASE}/api/subscriptions/${onChainId}`, {
      method: "PATCH",
      headers: platformHeaders(),
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const text = await res.text();
      let message = "Failed to update subscription";
      try { message = (JSON.parse(text) as { error?: string }).error ?? message; } catch { /* non-JSON */ }
      return NextResponse.json({ error: message }, { status: res.status });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
