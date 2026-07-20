import assert from "node:assert/strict";
import test from "node:test";
import { planLegacyBackfill } from "./legacy-backfill.ts";

test("backfill handles empty input", () => {
  assert.deepEqual(planLegacyBackfill([]), { businesses: [], wallets: [], ownership: {} });
});

test("backfill is deterministic and repeated execution is idempotent", () => {
  const rows = [{ id: "link-1", merchant: "GA", displayName: "Acme", email: "owner@example.com" }];
  const first = planLegacyBackfill(rows);
  assert.deepEqual(planLegacyBackfill(rows, first), first);
});

test("partial state is completed without replacing established IDs", () => {
  const initial = {
    businesses: [{ id: "existing-business", name: "Existing", importedFromWallet: "GA" }],
  };
  const result = planLegacyBackfill([{ id: "plan-1", merchant: "GA" }], initial);
  assert.equal(result.businesses[0].id, "existing-business");
  assert.equal(result.wallets[0].businessId, "existing-business");
  assert.equal(result.ownership["plan-1"].businessId, "existing-business");
});

test("different wallets stay separate even when legacy emails conflict", () => {
  const result = planLegacyBackfill([
    { id: "link-a", merchant: "GA", email: "same@example.com" },
    { id: "plan-b", merchant: "GB", email: "same@example.com" },
    { id: "sub-a", merchant: "GA", email: "other@example.com" },
  ]);
  assert.equal(result.businesses.length, 2);
  assert.equal(result.wallets.length, 2);
  assert.notEqual(result.ownership["link-a"].businessId, result.ownership["plan-b"].businessId);
  assert.equal(result.ownership["link-a"].businessId, result.ownership["sub-a"].businessId);
});

test("conflicting wallet ownership fails without mutating input state", () => {
  const initial = {
    businesses: [{ id: "legacy-business", name: "Legacy", importedFromWallet: "GA" }],
    wallets: [{ id: "claimed-wallet", businessId: "different-business", address: "GA" }],
    ownership: {},
  };
  const before = structuredClone(initial);
  assert.throws(() => planLegacyBackfill([{ id: "link-1", merchant: "GA" }], initial), /another Business/);
  assert.deepEqual(initial, before);
});
