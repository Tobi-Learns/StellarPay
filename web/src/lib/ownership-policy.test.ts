import assert from "node:assert/strict";
import test from "node:test";
import { authorizeBusinessResource, merchantFieldMatchesSettlement } from "./ownership-policy.ts";

test("two-Business route authorization matrix isolates every Platform resource class", () => {
  const resources = ["dashboard", "profile", "payment-link", "plan", "subscription", "event", "api-key", "webhook"];
  for (const resource of resources) {
    assert.equal(authorizeBusinessResource("business-a", "business-a", "platform-read"), "allow", resource);
    assert.equal(authorizeBusinessResource("business-a", "business-b", "platform-read"), "not-found", resource);
    assert.equal(authorizeBusinessResource("business-a", "business-b", "platform-write"), "not-found", resource);
    assert.equal(authorizeBusinessResource(null, "business-a", "platform-read"), "unauthorized", resource);
  }
});

test("public customer reads stay public while spoofed settlement fields are rejected", () => {
  assert.equal(authorizeBusinessResource(null, "business-a", "public-read"), "allow");
  assert.equal(merchantFieldMatchesSettlement(undefined, "GA"), true);
  assert.equal(merchantFieldMatchesSettlement("GA", "GA"), true);
  assert.equal(merchantFieldMatchesSettlement("GB", "GA"), false);
});
