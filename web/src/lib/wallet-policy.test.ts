import assert from "node:assert/strict";
import test from "node:test";
import {
  canConsumeChallenge,
  eligiblePaymentLinkSelection,
  hasFreshAuthentication,
} from "./wallet-policy.ts";

test("rotation requires a real, fresh authentication timestamp", () => {
  assert.equal(hasFreshAuthentication(undefined, 1_000), false);
  assert.equal(hasFreshAuthentication(399, 1_000), false);
  assert.equal(hasFreshAuthentication(400, 1_000), true);
  assert.equal(hasFreshAuthentication(1_001, 1_000), false);
});

test("challenge consumption rejects replay, expiry, and another user", () => {
  const live = { userId: "owner", usedAt: null, expiresAt: new Date(2_000) };
  assert.equal(canConsumeChallenge(live, "owner", new Date(1_999)), true);
  assert.equal(canConsumeChallenge(live, "attacker", new Date(1_999)), false);
  assert.equal(canConsumeChallenge({ ...live, usedAt: new Date(1_500) }, "owner", new Date(1_999)), false);
  assert.equal(canConsumeChallenge(live, "owner", new Date(2_000)), false);
});

test("wallet rotation switches only explicitly selected eligible one-time links", () => {
  assert.deepEqual(eligiblePaymentLinkSelection(["a", "a", "foreign", "b"], ["a", "b", "c"]), ["a", "b"]);
  assert.deepEqual(eligiblePaymentLinkSelection([], ["a"]), []);
});
