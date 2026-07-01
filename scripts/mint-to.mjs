/**
 * mint-to.mjs — Send test USDC from the platform issuer to any address.
 *
 * Usage:  node scripts/mint-to.mjs <STELLAR_ADDRESS> [AMOUNT]
 * Example: node scripts/mint-to.mjs GCMB6ONN... 10000
 *
 * The recipient must already have a USDC:GAUK4F5... trustline.
 * The pay/subscribe buttons create it automatically on first use.
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

const [, , recipient, amountArg = "10000"] = process.argv;
if (!recipient) {
  console.error("Usage: node scripts/mint-to.mjs <STELLAR_ADDRESS> [AMOUNT]");
  process.exit(1);
}

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const server = new Horizon.Server(HORIZON_URL);

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

const platformKp = readKeypair("platform");
const testUsdc = new Asset("USDC", platformKp.publicKey());

console.log("Platform (issuer) :", platformKp.publicKey());
console.log("Recipient         :", recipient);
console.log("Amount            :", amountArg, "USDC");
console.log();

const platformAccount = await server.loadAccount(platformKp.publicKey());
const tx = new TransactionBuilder(platformAccount, {
  fee: BASE_FEE,
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(
    Operation.payment({ destination: recipient, asset: testUsdc, amount: amountArg })
  )
  .setTimeout(30)
  .build();

tx.sign(platformKp);

try {
  const result = await server.submitTransaction(tx);
  console.log("✅ Minted", amountArg, "USDC →", recipient);
  console.log("   tx hash:", result.hash);
} catch (e) {
  const codes = e?.response?.data?.extras?.result_codes;
  if (codes) {
    console.error("❌ Transaction failed:", JSON.stringify(codes));
    if (JSON.stringify(codes).includes("op_no_trust")) {
      console.error("   The recipient has no USDC trustline yet.");
      console.error("   Have them click the Pay button once (it auto-creates the trustline), then re-run this script.");
    }
  } else {
    console.error("❌", e.message ?? e);
  }
  process.exit(1);
}
