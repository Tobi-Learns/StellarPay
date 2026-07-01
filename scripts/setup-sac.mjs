/**
 * setup-sac.mjs — Phase 1.1b
 *
 * 1. Reads the three secret keys from stellar-cli identity files
 * 2. Establishes trustlines on merchant + subscriber for test USDC
 * 3. Mints test USDC to subscriber (10 000 USDC) and merchant (1 000 USDC)
 *
 * Run: node scripts/setup-sac.mjs
 */

import {
  Horizon,
  Keypair,
  Asset,
  TransactionBuilder,
  Operation,
  BASE_FEE,
  Networks,
} from "@stellar/stellar-sdk";
import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { mnemonicToSeedSync } from "bip39";
import { derivePath } from "ed25519-hd-key";

const NETWORK_PASSPHRASE = Networks.TESTNET;
const HORIZON_URL = "https://horizon-testnet.stellar.org";
const server = new Horizon.Server(HORIZON_URL);

// SAC contract ID from Phase 1.1b deploy
const SAC_CONTRACT_ID =
  "CAKBCKBUE3ZRSNH6CDYAB62ZFWL7U7OX6NBZ6EUDFID22PRLICFJXHGS";

// Read a Keypair from a stellar-cli identity toml (handles secret_key or seed_phrase)
function readKeypair(alias) {
  const tomlPath = join(
    homedir(),
    ".config",
    "stellar",
    "identity",
    `${alias}.toml`
  );
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

const platformKp = readKeypair("platform");
const merchantKp = readKeypair("merchant");
const subscriberKp = readKeypair("subscriber");

// Test USDC — issued by the platform account
const testUsdc = new Asset("USDC", platformKp.publicKey());

async function submitTx(txBuilder, ...signers) {
  const tx = txBuilder.setTimeout(30).build();
  for (const kp of signers) tx.sign(kp);
  const result = await server.submitTransaction(tx);
  return result.hash;
}

async function main() {
  console.log("Platform  :", platformKp.publicKey());
  console.log("Merchant  :", merchantKp.publicKey());
  console.log("Subscriber:", subscriberKp.publicKey());
  console.log("Asset     : USDC:", platformKp.publicKey());
  console.log("SAC       :", SAC_CONTRACT_ID);
  console.log();

  // --- Trustline: merchant ---
  console.log("1. Establishing trustline for merchant...");
  const merchantAccount = await server.loadAccount(merchantKp.publicKey());
  const merchantTrustTx = new TransactionBuilder(merchantAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  }).addOperation(
    Operation.changeTrust({ asset: testUsdc, limit: "1000000" })
  );
  const merchantTrustHash = await submitTx(merchantTrustTx, merchantKp);
  console.log("   ✅ merchant trustline tx:", merchantTrustHash);

  // --- Trustline: subscriber ---
  console.log("2. Establishing trustline for subscriber...");
  const subscriberAccount = await server.loadAccount(subscriberKp.publicKey());
  const subscriberTrustTx = new TransactionBuilder(subscriberAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  }).addOperation(
    Operation.changeTrust({ asset: testUsdc, limit: "1000000" })
  );
  const subscriberTrustHash = await submitTx(subscriberTrustTx, subscriberKp);
  console.log("   ✅ subscriber trustline tx:", subscriberTrustHash);

  // --- Mint: platform → subscriber (10 000 USDC) ---
  console.log("3. Minting 10 000 test USDC to subscriber...");
  const platformAccountForSub = await server.loadAccount(
    platformKp.publicKey()
  );
  const mintSubTx = new TransactionBuilder(platformAccountForSub, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  }).addOperation(
    Operation.payment({
      destination: subscriberKp.publicKey(),
      asset: testUsdc,
      amount: "10000",
    })
  );
  const mintSubHash = await submitTx(mintSubTx, platformKp);
  console.log("   ✅ subscriber mint tx:", mintSubHash);

  // --- Mint: platform → merchant (1 000 USDC) ---
  console.log("4. Minting 1 000 test USDC to merchant...");
  const platformAccountForMerchant = await server.loadAccount(
    platformKp.publicKey()
  );
  const mintMerchantTx = new TransactionBuilder(platformAccountForMerchant, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  }).addOperation(
    Operation.payment({
      destination: merchantKp.publicKey(),
      asset: testUsdc,
      amount: "1000",
    })
  );
  const mintMerchantHash = await submitTx(mintMerchantTx, platformKp);
  console.log("   ✅ merchant mint tx:", mintMerchantHash);

  // --- Verify balances ---
  console.log("\nVerifying balances...");
  const sub = await server.loadAccount(subscriberKp.publicKey());
  const merch = await server.loadAccount(merchantKp.publicKey());

  const subUsdc = sub.balances.find(
    (b) => b.asset_code === "USDC" && b.asset_issuer === platformKp.publicKey()
  );
  const merchUsdc = merch.balances.find(
    (b) => b.asset_code === "USDC" && b.asset_issuer === platformKp.publicKey()
  );

  console.log("   subscriber USDC :", subUsdc?.balance ?? "none");
  console.log("   merchant USDC   :", merchUsdc?.balance ?? "none");
  console.log();
  console.log("✅ 1.1b complete. Save to .env:");
  console.log(`   TEST_USDC_ISSUER=${platformKp.publicKey()}`);
  console.log(`   TEST_USDC_SAC=${SAC_CONTRACT_ID}`);
}

main().catch((e) => {
  console.error(e?.response?.data?.extras?.result_codes ?? e);
  process.exit(1);
});
