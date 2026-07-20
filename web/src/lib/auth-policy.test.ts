import assert from "node:assert/strict";
import test from "node:test";
import {
  assertTestAuthConfiguration,
  defaultBusinessName,
  isActivePlatformSession,
  isAuthorizedTestFixture,
  isVerifiedGoogleProfile,
} from "./auth-policy.ts";

test("accepts only verified Google identities with stable subject and email", () => {
  assert.equal(isVerifiedGoogleProfile({ sub: "google-1", email: "owner@example.com", email_verified: true }), true);
  assert.equal(isVerifiedGoogleProfile({ sub: "google-1", email: "owner@example.com", email_verified: false }), false);
  assert.equal(isVerifiedGoogleProfile({ sub: "google-1", email_verified: true }), false);
  assert.equal(isVerifiedGoogleProfile(null), false);
});

test("test auth is forbidden in production", () => {
  assert.throws(() => assertTestAuthConfiguration(true, "production"), /must never be enabled/);
  assert.doesNotThrow(() => assertTestAuthConfiguration(true, "test"));
  assert.doesNotThrow(() => assertTestAuthConfiguration(false, "production"));
});

test("business names are deterministic", () => {
  assert.equal(defaultBusinessName("  Stellar Roast ", "owner@example.com"), "Stellar Roast");
  assert.equal(defaultBusinessName(null, "owner@example.com"), "owner");
  assert.equal(defaultBusinessName(null, null), "My business");
});

test("session policy denies missing/expired sessions and accepts an active seeded user", () => {
  const now = new Date("2026-07-20T00:00:00.000Z");
  assert.equal(isActivePlatformSession(null, now), false);
  assert.equal(isActivePlatformSession({ user: { id: "seeded" }, expires: "2026-07-19T23:59:59.000Z" }, now), false);
  assert.equal(isActivePlatformSession({ user: { id: "seeded" }, expires: "2026-07-20T00:00:01.000Z" }, now), true);
  assert.equal(isAuthorizedTestFixture({ emailVerified: new Date(0) }), true);
  assert.equal(isAuthorizedTestFixture({ emailVerified: null }), false);
  assert.equal(isAuthorizedTestFixture(null), false);
});
