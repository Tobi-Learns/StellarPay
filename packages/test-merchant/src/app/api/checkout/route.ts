import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.STELLARPAY_API_BASE!;
const API_KEY = process.env.STELLARPAY_API_KEY!;
const MERCHANT = process.env.MERCHANT_ADDRESS!;

// Server-side: create a payment link using the merchant's API key.
// The client never sees the API key — it just gets back a linkId to pay.
export async function POST(req: NextRequest) {
  try {
    const { amount, description, createLink = false } = await req.json() as {
      amount: string;
      description: string;
      createLink?: boolean;
    };

    const numericId = String(Date.now());
    const encodedId = Buffer.from(
      JSON.stringify({ id: numericId, merchant: MERCHANT, amount, numericId, description, createdAt: Date.now() })
    ).toString("base64url");

    if (!createLink) {
      return NextResponse.json({ encodedId, numericId });
    }

    const res = await fetch(`${API_BASE}/api/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ encodedId, numericId, merchant: MERCHANT, amount, description }),
    });

    if (!res.ok) {
      const text = await res.text();
      let message = "Failed to create payment link";
      try { message = (JSON.parse(text) as { error?: string }).error ?? message; } catch { /* upstream returned non-JSON */ }
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ encodedId, numericId });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
