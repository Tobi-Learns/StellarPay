import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.STELLARPAY_API_BASE!;

// Called after the subscribe tx lands — registers the per-customer subscription
// in the DB. Proxied server-side to avoid CORS (browser can't call the web app's
// API directly). Plans are pre-provisioned by scripts/seed-test-merchant.mjs and
// referenced by id from env, so there is no plan lookup/creation here (3.1).
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
