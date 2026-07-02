import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSubscription } from "@/lib/stellar";

const LEDGER_SECONDS = 5;
const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sub = await db.subscription.findUnique({ where: { onChainId: id } });
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const onChain = await getSubscription(BigInt(id));
    const latestLedger = await getLatestLedger();
    const nextChargeTime = await getLedgerTime(onChain.next_charge, latestLedger);

    return NextResponse.json({
      ...sub,
      status: onChain.status,
      nextCharge: onChain.next_charge,
      createdLedger: onChain.created_at,
      currentLedger: latestLedger?.sequence,
      estimatedNextChargeAt: nextChargeTime,
      nextChargeOverdue: latestLedger ? onChain.next_charge < latestLedger.sequence : false,
    });
  } catch {
    return NextResponse.json(sub);
  }
}

async function getLedgerTime(
  sequence: number,
  latest: { sequence: number; closed_at: string } | null
): Promise<string | undefined> {
  const exact = await fetchLedger(sequence);
  if (exact?.closed_at) return exact.closed_at;

  if (!latest) return undefined;

  const deltaLedgers = sequence - latest.sequence;
  return new Date(
    new Date(latest.closed_at).getTime() + deltaLedgers * LEDGER_SECONDS * 1000
  ).toISOString();
}

async function getLatestLedger(): Promise<{ sequence: number; closed_at: string } | null> {
  const latestRes = await fetch(`${HORIZON_URL}/ledgers?order=desc&limit=1`);
  if (!latestRes.ok) return null;

  const latestJson = await latestRes.json() as {
    _embedded?: { records?: { sequence: number; closed_at: string }[] };
  };
  return latestJson._embedded?.records?.[0] ?? null;
}

async function fetchLedger(sequence: number): Promise<{ closed_at?: string } | null> {
  const res = await fetch(`${HORIZON_URL}/ledgers/${sequence}`);
  if (!res.ok) return null;
  return res.json() as Promise<{ closed_at?: string }>;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { status } = await req.json();

  if (!status) return NextResponse.json({ error: "status required" }, { status: 400 });

  const sub = await db.subscription.update({
    where: { onChainId: id },
    data: { status },
  });
  return NextResponse.json(sub);
}
