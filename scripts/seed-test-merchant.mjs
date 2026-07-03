/**
 * seed-test-merchant.mjs — Provision the fixed demo catalog for the reference
 * merchant site (Stellar Roast), once. (Pipeline 3.1a.)
 *
 * Creates 3 reusable payment links + 3 subscription plans that the six
 * test-merchant flows reference by id from their env — exactly how a real
 * merchant hardcodes Stripe price ids into their integration. Nothing is
 * created inside a customer flow anymore.
 *
 * Idempotent:
 *   - Payment links have a deterministic encodedId → upsert is a no-op on re-run.
 *   - Plans are find-or-create keyed on (merchant, amount, interval) in the DB,
 *     because create_plan mints a fresh on-chain id every call. So a re-run after
 *     a DB reset that WIPED plans will mint new ones; a re-run that kept them
 *     reuses the existing ids. Either way the printed env block is authoritative.
 *
 * Usage:  node scripts/seed-test-merchant.mjs
 *   Requires: web/.env (TRANSACTION_URL) + VPN for the DB, and the `merchant`
 *   identity in ~/.config/stellar/identity for on-chain create_plan signing.
 *
 * After running, paste the printed NEXT_PUBLIC_DEMO_* lines into
 * packages/test-merchant/.env.local (and the Vercel project env — 3.1d).
 */

import { readFileSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";
import { mnemonicToSeedSync } from "bip39";
import { derivePath } from "ed25519-hd-key";
import pg from "pg";
import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import {
  StellarPayClient,
  TESTNET,
  parseUsdc,
  minIntervalSeconds,
  newId,
} from "../packages/sdk/dist/index.js";

const __dir = dirname(fileURLToPath(import.meta.url));

function loadEnv(path) {
  try {
    for (const line of readFileSync(path, "utf-8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {}
}

function readKeypair(alias) {
  const tomlPath = join(homedir(), ".config", "stellar", "identity", `${alias}.toml`);
  const raw = readFileSync(tomlPath, "utf8");
  const secretMatch = raw.match(/secret_key\s*=\s*"([^"]+)"/);
  if (secretMatch) return Keypair.fromSecret(secretMatch[1]);
  const phraseMatch = raw.match(/seed_phrase\s*=\s*"([^"]+)"/);
  if (phraseMatch) {
    const seed = mnemonicToSeedSync(phraseMatch[1]);
    const { key } = derivePath("m/44'/148'/0'", seed.toString("hex"));
    return Keypair.fromRawEd25519Seed(key);
  }
  throw new Error(`No secret_key or seed_phrase found in ${tomlPath}`);
}

loadEnv(resolve(__dir, "../web/.env"));

const MERCHANT = "GCCTHPUA2FAAX6WIS7GN4H2TAX4WTO3CI4PQWOIMWPHXE3MKEH2OG47L";
const INTERVAL = { unit: "minute", count: 5 };
const INTERVAL_LABEL = "Demo (every 5 minutes)";

// One reusable payment link per checkout product. Fixed numericIds (3101–3103)
// keep the encodedId deterministic so re-runs upsert instead of duplicating.
const LINKS = [
  { key: "HOSTED",   numericId: "3101", amount: parseUsdc("4.00").toString(), description: "Premium Coffee Bundle — hosted checkout" },
  { key: "EMBEDDED", numericId: "3102", amount: parseUsdc("5.00").toString(), description: "Premium Coffee Bundle — embedded widget" },
  { key: "HEADLESS", numericId: "3103", amount: parseUsdc("7.00").toString(), description: "Premium Coffee Bundle — headless checkout" },
];

// One plan per subscribe product. Same 5-minute demo cadence across all three.
const PLANS = [
  { key: "HOSTED",   amount: parseUsdc("1.00").toString() },
  { key: "EMBEDDED", amount: parseUsdc("2.00").toString() },
  { key: "HEADLESS", amount: parseUsdc("3.00").toString() },
];

// Blob shape mirrors web /api ↔ /pay: `id` is the on-chain link_id the /pay page
// reads (link.id ?? link.numericId). base64url matches the web decoder.
function encodeLink({ numericId, amount, description }) {
  const blob = { id: numericId, merchant: MERCHANT, amount, description, numericId };
  return Buffer.from(JSON.stringify(blob)).toString("base64url");
}

async function main() {
  if (!process.env.TRANSACTION_URL) {
    throw new Error("TRANSACTION_URL not set — is web/.env present? (VPN needed for the DB)");
  }

  const db = new pg.Client({ connectionString: process.env.TRANSACTION_URL });
  await db.connect();
  console.log("Connected to DB\n");

  const env = {};

  // ── Payment links (DB-only, idempotent on encodedId) ────────────────────────
  for (const link of LINKS) {
    const encodedId = encodeLink(link);
    await db.query(
      `INSERT INTO "PaymentLink" (id, "extId", "encodedId", "numericId", merchant, amount, description, "createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT ("encodedId") DO NOTHING`,
      [newId("plink"), encodedId, link.numericId, MERCHANT, link.amount, link.description]
    );
    // Hosted redirects to /pay/:encodedId; embedded/headless pass numericId to the contract.
    env[`NEXT_PUBLIC_DEMO_CHECKOUT_${link.key}`] = link.key === "HOSTED" ? encodedId : link.numericId;
    console.log(`✓ Link ${link.key.padEnd(8)} #${link.numericId}  (${link.amount} stroops)`);
  }

  // ── Plans (on-chain create_plan, merchant-signed; find-or-create by DB row) ──
  const sdk = new StellarPayClient({ ...TESTNET, apiBase: "" });
  const merchantKp = readKeypair("merchant");
  const minSecs = minIntervalSeconds(INTERVAL);

  for (const plan of PLANS) {
    const existing = await db.query(
      `SELECT "onChainId" FROM "Plan"
       WHERE merchant = $1 AND amount = $2 AND "intervalUnit" = $3 AND "intervalCount" = $4
       ORDER BY "createdAt" ASC LIMIT 1`,
      [MERCHANT, plan.amount, INTERVAL.unit, INTERVAL.count]
    );

    let onChainId;
    if (existing.rows.length) {
      onChainId = existing.rows[0].onChainId;
      console.log(`✓ Plan ${plan.key.padEnd(8)} #${onChainId}  reused  (${plan.amount} stroops)`);
    } else {
      const xdr = await sdk.buildCreatePlanXdr(MERCHANT, BigInt(plan.amount), minSecs);
      const tx = TransactionBuilder.fromXDR(xdr, TESTNET.networkPassphrase);
      tx.sign(merchantKp);
      const { returnValue } = await sdk.submitAndWaitWithResult(tx.toXDR());
      onChainId = String(returnValue);

      await db.query(
        `INSERT INTO "Plan" (id, "extId", "onChainId", merchant, amount, interval, "intervalLabel", "intervalUnit", "intervalCount", "createdAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT ("onChainId") DO NOTHING`,
        [newId("plan"), onChainId, MERCHANT, plan.amount, minSecs, INTERVAL_LABEL, INTERVAL.unit, INTERVAL.count]
      );
      console.log(`✓ Plan ${plan.key.padEnd(8)} #${onChainId}  created (${plan.amount} stroops)`);
    }
    env[`NEXT_PUBLIC_DEMO_PLAN_${plan.key}`] = onChainId;
  }

  await db.end();

  console.log("\n── Paste into packages/test-merchant/.env.local (and Vercel — 3.1d) ──\n");
  for (const [k, v] of Object.entries(env)) console.log(`${k}=${v}`);
  console.log();
}

main().catch((err) => {
  console.error("\n✗ Seed failed:", err.message ?? err);
  process.exit(1);
});
