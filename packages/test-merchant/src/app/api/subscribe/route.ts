import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.STELLARPAY_API_BASE!;
const API_KEY = process.env.STELLARPAY_API_KEY!;

// Server-side: find an existing plan for the merchant.
export async function POST(req: NextRequest) {
  try {
    const { amount, intervalLabel, merchant } = await req.json() as {
      amount: string;
      intervalLabel: string;
      merchant: string;
    };

    if (!merchant) {
      return NextResponse.json({ error: "merchant address required" }, { status: 400 });
    }

    const listRes = await fetch(`${API_BASE}/api/plans?merchant=${encodeURIComponent(merchant)}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    const plans = await listRes.json() as Array<{ onChainId: string; amount: string }>;
    const existing = Array.isArray(plans) ? plans.find((p) => p.amount === amount) : null;
    if (existing) return NextResponse.json({ planId: existing.onChainId, existing: true });

    return NextResponse.json({ planId: null, existing: false, intervalLabel });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// Called after the subscribe tx lands — registers the subscription in the DB.
// Proxied server-side to avoid CORS (browser can't call the web app's API directly).
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      let message = "Failed to register subscription";
      try { message = (JSON.parse(text) as { error?: string }).error ?? message; } catch { /* non-JSON */ }
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// Called after the subscriber creates the plan on-chain.
// merchant = subscriber address (demo: subscriber is their own merchant).
export async function PUT(req: NextRequest) {
  try {
    const { onChainId, merchant, amount, interval, intervalLabel, intervalUnit, intervalCount } = await req.json() as {
      onChainId: string;
      merchant: string;
      amount: string;
      interval: number;
      intervalLabel: string;
      intervalUnit: string;
      intervalCount: number;
    };

    const res = await fetch(`${API_BASE}/api/plans`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ onChainId, merchant, amount, interval, intervalLabel, intervalUnit, intervalCount }),
    });

    if (!res.ok) {
      const text = await res.text();
      let message = "Failed to register plan";
      try { message = (JSON.parse(text) as { error?: string }).error ?? message; } catch { /* non-JSON */ }
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
