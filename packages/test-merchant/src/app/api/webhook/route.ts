import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { webhookLog } from "@/lib/webhook-log";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? "";

function verify(rawBody: string, header: string | null): boolean {
  if (!header || !WEBHOOK_SECRET) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const expected = createHmac("sha256", WEBHOOK_SECRET)
    .update(`${parts.t}.${rawBody}`)
    .digest("hex");
  return expected === parts.v1;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const verified = verify(rawBody, req.headers.get("stellarpay-signature"));

  let payload: { type: string; data: unknown };
  try { payload = JSON.parse(rawBody); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  webhookLog.unshift({ ts: Date.now(), type: payload.type, data: payload.data, verified });
  if (webhookLog.length > 50) webhookLog.length = 50;

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json(webhookLog);
}
