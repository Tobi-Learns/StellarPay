import { NextRequest, NextResponse } from "next/server";
import { StellarPayClient, TESTNET } from "@stellarpay/sdk";
import { getMobileSigningSession, updateMobileSigningSession } from "@/lib/mobile-signing-store";

const API_BASE = process.env.STELLARPAY_API_BASE!;

function client() {
  return new StellarPayClient({ ...TESTNET, apiBase: API_BASE });
}

async function signedXdrFromRequest(req: NextRequest): Promise<string | null> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await req.json() as { xdr?: string; signedXdr?: string };
    return body.xdr ?? body.signedXdr ?? null;
  }
  const form = await req.formData();
  const xdr = form.get("xdr");
  return typeof xdr === "string" ? xdr : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = getMobileSigningSession(id);
  if (!session) return NextResponse.json({ error: "session not found" }, { status: 404 });
  const { xdr, uri, ...safeSession } = session;
  return NextResponse.json(safeSession);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = getMobileSigningSession(id);
  if (!session) return NextResponse.json({ error: "session not found" }, { status: 404 });
  if (session.status !== "pending") {
    return NextResponse.json({ ok: true, status: session.status });
  }

  try {
    const signedXdr = await signedXdrFromRequest(req);
    if (!signedXdr) {
      return NextResponse.json({ error: "signed xdr required" }, { status: 400 });
    }

    updateMobileSigningSession(id, { status: "submitted", message: "Signature received. Submitting transaction..." });
    const c = client();
    const txHash = await c.submitAndWait(signedXdr);

    if (session.kind === "payment") {
      await c.recordPaymentSettled({
        txHash,
        merchant: session.context.merchant ?? "",
        amount: session.context.amount ?? "",
        linkId: session.context.linkId ?? "",
        payerName: session.context.payerName,
        payerEmail: session.context.payerEmail,
        payerWallet: session.context.payerWallet,
      });
    }

    if (session.kind === "subscribe") {
      await c.registerSubscription({
        onChainId: session.context.subscriptionOnChainId ?? "",
        planOnChainId: session.context.planOnChainId ?? "",
        subscriber: session.context.subscriber ?? "",
        merchant: session.context.merchant ?? "",
        amount: session.context.amount ?? "",
        anchorAt: session.context.anchorAt,
        payerName: session.context.payerName,
        payerEmail: session.context.payerEmail,
      });
    }

    updateMobileSigningSession(id, {
      status: "settled",
      message: session.kind === "approve" ? "Approval confirmed. Continue to the subscription QR." : "Transaction settled.",
      txHash,
    });
    return NextResponse.json({ ok: true, status: "settled", txHash });
  } catch (e) {
    updateMobileSigningSession(id, {
      status: "rejected",
      message: "Signing or submission failed.",
      error: String(e),
    });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
