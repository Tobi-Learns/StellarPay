// billing-loop.mjs — local subscription-billing scheduler (B1).
// Nothing invokes the cron endpoints during local dev, so subscriptions drift
// overdue. Run this alongside the dev server to bill on the same cadence as
// production will: charge pass every 15 min, retry pass every 3 min.
//
// Usage (from repo root, dev server running on :3000):
//   node --env-file=web/.env scripts/billing-loop.mjs [baseUrl]
//
// A single ticker alternates the passes (charge on every 5th tick, retry
// otherwise) so the two passes can never overlap and double-charge.

const BASE = process.argv[2] ?? "http://localhost:3000";
const SECRET = process.env.CRON_SECRET;
if (!SECRET) {
  console.error("CRON_SECRET not set — run with: node --env-file=web/.env scripts/billing-loop.mjs");
  process.exit(1);
}

const TICK_MS = 3 * 60 * 1000; // retry cadence; every 5th tick is a charge pass

async function hit(path) {
  const t = new Date().toISOString();
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${SECRET}` },
    });
    const body = await res.json();
    const summary = Array.isArray(body.results)
      ? body.results.length
        ? body.results.map((r) => `${r.id}: ${r.result}`).join(" | ")
        : "no pending work"
      : JSON.stringify(body);
    console.log(`[${t}] ${path} → ${res.status} — ${summary}`);
  } catch (err) {
    console.log(`[${t}] ${path} → unreachable (${err.message}) — is the dev server running?`);
  }
}

let tick = 0;
let running = false;

async function onTick() {
  if (running) {
    console.log("previous pass still running — skipping tick");
    return;
  }
  running = true;
  await hit(tick % 5 === 0 ? "/api/cron/charge" : "/api/cron/retry");
  tick++;
  running = false;
}

console.log(`billing loop → ${BASE} (charge every 15 min, retry every 3 min) — Ctrl+C to stop`);
await onTick();
setInterval(onTick, TICK_MS);
