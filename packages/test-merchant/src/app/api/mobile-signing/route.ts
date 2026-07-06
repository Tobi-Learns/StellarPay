import { NextRequest, NextResponse } from "next/server";
import { buildSep7TxUri, TESTNET } from "@stellarpay/sdk";
import {
  mobileSigningSessions,
  type MobileSigningContext,
  type MobileSigningKind,
} from "@/lib/mobile-signing-store";

function absoluteUrl(req: NextRequest, path: string): string {
  const configured = process.env.TEST_MERCHANT_PUBLIC_URL ?? process.env.NEXT_PUBLIC_TEST_MERCHANT_URL;
  const base = (configured ?? req.nextUrl.origin).replace(/\/$/, "");
  return `${base}${path}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      kind?: MobileSigningKind;
      xdr?: string;
      message?: string;
      context?: MobileSigningContext;
    };

    if (!body.kind || !["payment", "approve", "subscribe"].includes(body.kind)) {
      return NextResponse.json({ error: "kind must be payment, approve, or subscribe" }, { status: 400 });
    }
    if (!body.xdr) {
      return NextResponse.json({ error: "xdr required" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const callbackUrl = absoluteUrl(req, `/api/mobile-signing/${id}`);
    const statusUrl = `/api/mobile-signing/${id}`;
    const uri = buildSep7TxUri({
      xdr: body.xdr,
      callback: callbackUrl,
      msg: body.message ?? "Sign StellarPay transaction",
      networkPassphrase: TESTNET.networkPassphrase,
    });

    mobileSigningSessions().set(id, {
      id,
      kind: body.kind,
      status: "pending",
      message: body.message ?? "Waiting for Freighter mobile signature",
      xdr: body.xdr,
      uri,
      context: body.context ?? {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return NextResponse.json({ id, uri, callbackUrl, statusUrl });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
