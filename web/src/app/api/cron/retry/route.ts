import { NextRequest, NextResponse } from "next/server";
import { runChargePass } from "@/lib/cron-charge";

// Each on-chain charge polls up to ~40s; the default function timeout would
// kill a pass mid-charge and leave subscriptions overdue (B1).
export const maxDuration = 300;

// Retry pass — every 3 minutes (2j). Only touches Active subscriptions whose
// nextRetryAt has passed; a no-op when nothing is pending.
export async function GET(req: NextRequest) {
  // Verify Vercel cron secret
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await runChargePass("retry"));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
