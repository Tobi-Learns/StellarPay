// One-off reset for the 3.2e redeploy. Clears the demo merchant's orphaned
// plans/subscriptions (they point at the retired contract) and the demo payment
// links (so the seed regenerates them with non-sequential Snowflake ids).
// Merchant-scoped — touches only the demo merchant's rows. Run once, then
// `node scripts/seed-test-merchant.mjs`.
//
// Usage:  node --env-file=web/.env scripts/reset-demo-catalog.mjs
import pg from "pg";

const M = "GCCTHPUA2FAAX6WIS7GN4H2TAX4WTO3CI4PQWOIMWPHXE3MKEH2OG47L";

const c = new pg.Client({ connectionString: process.env.TRANSACTION_URL });
await c.connect();
await c.query("BEGIN");
try {
  const se = await c.query(`DELETE FROM "Event" WHERE "subscriptionId" IN (SELECT id FROM "Subscription" WHERE merchant = $1)`, [M]);
  const su = await c.query(`DELETE FROM "Subscription" WHERE merchant = $1`, [M]);
  const pl = await c.query(`DELETE FROM "Plan" WHERE merchant = $1`, [M]);
  const le = await c.query(`DELETE FROM "Event" WHERE "paymentLinkId" IN (SELECT id FROM "PaymentLink" WHERE merchant = $1 AND "productName" = $2)`, [M, "Premium Coffee Bundle"]);
  const li = await c.query(`DELETE FROM "PaymentLink" WHERE merchant = $1 AND "productName" = $2`, [M, "Premium Coffee Bundle"]);
  await c.query("COMMIT");
  console.log(`Deleted: ${su.rowCount} subs, ${pl.rowCount} plans, ${se.rowCount + le.rowCount} events, ${li.rowCount} demo links`);
} catch (e) {
  await c.query("ROLLBACK");
  throw e;
}
await c.end();
