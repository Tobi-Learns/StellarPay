import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.STELLARPAY_API_BASE!;

// Server-side proxy so browser checkout pages on :3001 do not call :3000 directly.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const res = await fetch(`${API_BASE}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    if (!res.ok) {
      let message = "Failed to log event";
      try { message = (JSON.parse(text) as { error?: string }).error ?? message; } catch {}
      return NextResponse.json({ error: message }, { status: res.status });
    }

    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
