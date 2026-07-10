// Mobile wallet signing over WalletConnect v2 (Phase 2.6).
//
// Built directly on @walletconnect/sign-client — no wallet-kit, no modal.
// The dapp renders the short pairing URI as an inline QR (see
// <MobileWalletQr> in ./react); the customer scans it with a WalletConnect-
// capable Stellar wallet (Freighter mobile), the wallet returns its address
// at connect, and sign requests are then pushed to the phone over the
// session (`stellar_signXDR`). One pairing covers a whole chain of
// signatures (trustline → approve → subscribe).
//
// Note: Freighter mobile refuses to SIGN for dapps served over http:// or
// localhost (its origin check requires HTTPS on a real domain). Use
// isSupportedOrigin() to decide whether to render the QR at all.

// Type-only import — the runtime module is dynamically imported in the
// browser only; loading @walletconnect/sign-client during SSR crashes Node.
import type { SignClient } from "@walletconnect/sign-client";
import type { SessionTypes } from "@walletconnect/types";

type WcClient = InstanceType<typeof SignClient>;

// Networks.PUBLIC from @stellar/stellar-sdk, inlined so this module has no
// static runtime imports (it must stay SSR-inert; the sign client itself is
// dynamically imported in the browser).
const PUBLIC_PASSPHRASE = "Public Global Stellar Network ; September 2015";

const SIGN_METHOD = "stellar_signXDR";
// WalletConnect pairing proposals expire after 5 minutes.
const PAIRING_TTL_MS = 5 * 60_000;
// How long to wait for the phone to respond to a sign request before failing
// loudly. Without this the request hangs forever if the wallet never answers
// (e.g. the request never surfaces on the phone) — a silent spinner.
const SIGN_TIMEOUT_MS = 90_000;

// Diagnostics: prefixed console logs so a stuck mobile signing flow leaves a
// trail in the desktop console (there is otherwise nothing to debug from).
// Silent in tests / non-browser.
function log(event: string, detail?: Record<string, unknown>): void {
  if (typeof console === "undefined") return;
  // eslint-disable-next-line no-console
  console.info(`[stellarpay:mobile] ${event}`, detail ?? "");
}

export type MobileWalletMetadata = {
  name: string;
  description: string;
  url: string;
  icons: string[];
};

export type MobileWalletConfig = {
  /** WalletConnect Cloud project id — free at https://cloud.reown.com */
  projectId: string;
  /** Network passphrase; selects the stellar:testnet / stellar:pubnet chain. */
  networkPassphrase: string;
  /** Dapp identity shown on the wallet's connect screen. Defaults from window.location. */
  metadata?: MobileWalletMetadata;
};

export type MobilePairing = {
  /** The wc: pairing URI — render this as a QR code. */
  uri: string;
  /** When the pairing proposal expires (~5 minutes). */
  expiresAt: Date;
  /** Resolves with the wallet's address once the customer approves the connection. */
  approval: Promise<string>;
};

export type OriginSupport = { ok: true } | { ok: false; reason: string };

function toError(e: unknown): Error {
  if (e instanceof Error) return e;
  const msg = (e as { message?: string })?.message;
  return new Error(msg || (typeof e === "string" ? e : "Mobile wallet request failed"));
}

/** Reject with `message` if `p` hasn't settled within `ms`. */
function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/** Best-effort read of the relay socket state without assuming internals exist. */
function safeRelayConnected(client: WcClient): boolean | undefined {
  try {
    return (client as unknown as { core?: { relayer?: { connected?: boolean } } })
      .core?.relayer?.connected;
  } catch {
    return undefined;
  }
}

/**
 * A WalletConnect session with a mobile Stellar wallet.
 * One instance = one pairing/session; create a fresh instance per checkout.
 */
export class MobileWalletConnect {
  readonly config: MobileWalletConfig;
  private clientPromise: Promise<WcClient> | null = null;
  private session: SessionTypes.Struct | null = null;
  /** The connected wallet's address, set once approval resolves. */
  address: string | null = null;

  constructor(config: MobileWalletConfig) {
    if (!config.projectId) {
      throw new Error(
        "MobileWalletConnect requires a WalletConnect Cloud projectId (free at https://cloud.reown.com).",
      );
    }
    this.config = config;
  }

  /**
   * Whether the current page origin can complete mobile signing.
   * Freighter mobile connects from any origin but refuses to sign for
   * http:// or localhost dapps, so don't render a QR that can't finish.
   */
  static isSupportedOrigin(): OriginSupport {
    if (typeof window === "undefined") {
      return { ok: false, reason: "Mobile wallet signing is browser-only." };
    }
    const { protocol, hostname, origin } = window.location;
    if (protocol !== "https:" || hostname === "localhost" || hostname === "127.0.0.1") {
      return {
        ok: false,
        reason: `Mobile wallets only sign for HTTPS dapps on a real domain — this page is served from ${origin}.`,
      };
    }
    return { ok: true };
  }

  private get chainId(): string {
    return this.config.networkPassphrase === PUBLIC_PASSPHRASE ? "stellar:pubnet" : "stellar:testnet";
  }

  private client(): Promise<WcClient> {
    if (typeof window === "undefined") {
      return Promise.reject(new Error("Mobile wallet signing is browser-only."));
    }
    if (!this.clientPromise) {
      const metadata: MobileWalletMetadata = this.config.metadata ?? {
        name: typeof document !== "undefined" && document.title ? document.title : "StellarPay checkout",
        description: "Pay with your Stellar wallet via StellarPay",
        url: window.location.origin,
        icons: [`${window.location.origin}/favicon.ico`],
      };
      this.clientPromise = import("@walletconnect/sign-client").then(({ SignClient }) =>
        SignClient.init({
          projectId: this.config.projectId,
          metadata,
        }),
      );
    }
    return this.clientPromise;
  }

  /**
   * Start a fresh pairing: returns the wc: URI to render as a QR plus an
   * approval promise that resolves with the wallet's address when the
   * customer approves the connection in their wallet. Rejects when the
   * proposal expires or the customer declines — generate a new pairing then.
   */
  async createPairing(): Promise<MobilePairing> {
    const client = await this.client();

    // Clear ALL existing sessions before pairing, not just this instance's.
    // SignClient.init restores every previously-approved session from local
    // storage on each page load, and they otherwise never get cleaned up —
    // they pile up in the wallet's "Connected Apps" list, and once several
    // stale sessions exist the sign-request response stops routing back
    // reliably (checkout hangs at "signing"). A checkout wants exactly one
    // live session, so start every pairing from a clean slate.
    await this.disconnectAll().catch(() => {});

    const { uri, approval } = await client.connect({
      requiredNamespaces: {
        stellar: {
          methods: [SIGN_METHOD],
          chains: [this.chainId],
          events: [],
        },
      },
    });

    if (!uri) {
      throw new Error("WalletConnect did not return a pairing URI.");
    }
    log("pairing_created", { chainId: this.chainId, uriChars: uri.length });

    return {
      uri,
      expiresAt: new Date(Date.now() + PAIRING_TTL_MS),
      approval: approval()
        .then((session) => {
          this.session = session;
          const accounts = session.namespaces.stellar?.accounts ?? [];
          const address = accounts[0]?.split(":")[2];
          if (!address) throw new Error("Wallet approved the session without a Stellar account.");
          this.address = address;
          log("session_approved", { topic: session.topic, address, accounts: accounts.length });
          return address;
        })
        .catch((e) => {
          log("session_rejected", { message: (e as { message?: string })?.message });
          throw toError(e);
        }),
    };
  }

  /** Push a sign request to the connected phone; resolves with the signed XDR. */
  async signXdr(xdr: string): Promise<string> {
    if (!this.session) {
      throw new Error("No connected mobile wallet session — scan the QR first.");
    }
    const client = await this.client();
    const topic = this.session.topic;
    // A session can be dropped by the wallet while the desktop still holds a
    // stale reference; requesting on a dead topic hangs silently. Surface it.
    const known = client.session.keys.includes(topic);
    const relayConnected = safeRelayConnected(client);
    log("sign_request →", { method: SIGN_METHOD, chainId: this.chainId, topic, sessionKnown: known, relayConnected, xdrChars: xdr.length });
    if (!known) {
      throw new Error("The wallet session was lost — scan the QR again to reconnect.");
    }

    try {
      const result = await withTimeout(
        client.request<{ signedXDR: string } | string>({
          topic,
          chainId: this.chainId,
          request: { method: SIGN_METHOD, params: { xdr } },
        }),
        SIGN_TIMEOUT_MS,
        `The wallet did not respond within ${SIGN_TIMEOUT_MS / 1000}s. Open Freighter mobile to approve the request, then try again.`,
      );
      // Freighter returns { signedXDR }; be defensive about a bare-string or
      // alternately-named response so a shape mismatch fails loudly, not silently.
      const signed =
        typeof result === "string"
          ? result
          : result?.signedXDR ??
            (result as { signedTxXdr?: string })?.signedTxXdr;
      if (!signed) {
        log("sign_response ✗ empty", { result });
        throw new Error("The wallet returned an empty signature (unexpected response shape).");
      }
      log("sign_response ✓", { signedChars: signed.length });
      return signed;
    } catch (e) {
      log("sign_request ✗", { message: (e as { message?: string })?.message });
      throw toError(e);
    }
  }

  /** Close this instance's session (if any). Safe to call repeatedly. */
  async disconnect(): Promise<void> {
    if (!this.session) return;
    const client = await this.client();
    const topic = this.session.topic;
    this.session = null;
    this.address = null;
    await client
      .disconnect({ topic, reason: { code: 6000, message: "Checkout closed" } })
      .catch(() => {});
  }

  /**
   * Disconnect every session the underlying client knows about — including
   * ones restored from local storage on a fresh page load, which `disconnect`
   * (scoped to this instance) can't see. Used to enforce a single clean
   * session per checkout and to clear accumulated stale sessions. Best-effort:
   * a failed per-session disconnect never rejects the whole call.
   */
  async disconnectAll(): Promise<void> {
    const client = await this.client();
    this.session = null;
    this.address = null;
    const sessions = client.session.getAll();
    await Promise.allSettled(
      sessions.map((s) =>
        client.disconnect({ topic: s.topic, reason: { code: 6000, message: "Checkout reset" } }),
      ),
    );
  }
}
