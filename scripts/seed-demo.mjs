/**
 * Seed demo data for StellarPay presentations.
 *
 * Populates the DB with a merchant profile + one payment link (DB-only).
 * For on-chain plans and subscriptions, use the UI — those require live
 * Freighter signing which can't be scripted without raw secret keys.
 *
 * Usage:
 *   node scripts/seed-demo.mjs
 *
 * Requires .env to be present in web/ (TRANSACTION_URL, SESSION_URL).
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dir = dirname(fileURLToPath(import.meta.url));

function loadEnv(path) {
  try {
    const lines = readFileSync(path, "utf-8").split("\n");
    for (const line of lines) {
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

loadEnv(resolve(__dir, "../web/.env"));

const MERCHANT = "GCCTHPUA2FAAX6WIS7GN4H2TAX4WTO3CI4PQWOIMWPHXE3MKEH2OG47L";
const DEMO_AMOUNT = "100000000"; // 10 USDC in stroops

function encodeLink(data) {
  return Buffer.from(JSON.stringify(data))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function main() {
  const client = new pg.Client({ connectionString: process.env.TRANSACTION_URL });
  await client.connect();
  console.log("Connected to DB");

  // Upsert merchant profile
  await client.query(
    `INSERT INTO "Merchant" (address, "displayName", email, verified, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, true, NOW(), NOW())
     ON CONFLICT (address) DO UPDATE
       SET "displayName" = EXCLUDED."displayName",
           email = EXCLUDED.email,
           verified = true,
           "updatedAt" = NOW()`,
    [MERCHANT, "Demo Store", "demo@stellarpay.dev"]
  );
  console.log("✓ Merchant profile upserted");

  // Create demo payment link
  const numericId = String(Date.now());
  const linkData = {
    id: numericId,
    merchant: MERCHANT,
    amount: DEMO_AMOUNT,
    description: "Demo product — StellarPay",
  };
  const encodedId = encodeLink(linkData);

  await client.query(
    `INSERT INTO "PaymentLink" ("id", "encodedId", "numericId", "merchant", "amount", "description", "createdAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW())
     ON CONFLICT ("encodedId") DO NOTHING`,
    [encodedId, numericId, MERCHANT, DEMO_AMOUNT, "Demo product — StellarPay"]
  );
  console.log("✓ Demo payment link created");
  console.log(`  /pay/${encodedId}`);

  await client.end();
  console.log("\nDone. For on-chain demo data (plans + subscriptions), use the app UI.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
