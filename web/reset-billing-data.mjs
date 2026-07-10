import pg from "pg";
const client = new pg.Client({ connectionString: process.env.TRANSACTION_URL });
await client.connect();
// Every Plan and Subscription in the DB was created against the retired pre-2.1
// contract, so all are orphaned on the new contract (CAD3U6SL...). Wipe them and
// their events for a clean slate. Payment links + merchant profiles are preserved.
// User-approved billing-data reset for the 2.1 redo.
await client.query("BEGIN");
try {
  const ev = await client.query(`DELETE FROM "Event" WHERE "subscriptionId" IS NOT NULL`);
  const su = await client.query(`DELETE FROM "Subscription"`);
  const pl = await client.query(`DELETE FROM "Plan"`);
  await client.query("COMMIT");
  console.log(`Deleted: ${ev.rowCount} subscription event(s), ${su.rowCount} subscription(s), ${pl.rowCount} plan(s)`);
} catch (e) {
  await client.query("ROLLBACK");
  throw e;
}
await client.end();
