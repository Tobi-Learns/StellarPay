import { createHmac } from "node:crypto";
import { db } from "./db";

/**
 * Deliver a webhook event to all active endpoints registered for this merchant.
 * Fire-and-forget — failures are logged but never thrown.
 *
 * Signature header format (Stripe-compatible):
 *   Stellarpay-Signature: t=<unix_seconds>,v1=<hmac_sha256_hex>
 * HMAC is computed over "<timestamp>.<raw_json_body>".
 */
export async function deliverWebhook(
  businessOrMerchant: string,
  type: string,
  data: unknown
): Promise<void> {
  const endpoints = await db.webhookEndpoint.findMany({
    where: {
      active: true,
      OR: [{ businessId: businessOrMerchant }, { merchant: businessOrMerchant }],
    },
  });

  if (endpoints.length === 0) return;

  const timestamp = Math.floor(Date.now() / 1000);
  const body = JSON.stringify({ type, data, created: timestamp });

  for (const endpoint of endpoints) {
    const sig = createHmac("sha256", endpoint.secret)
      .update(`${timestamp}.${body}`)
      .digest("hex");

    fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Stellarpay-Signature": `t=${timestamp},v1=${sig}`,
      },
      body,
    }).catch((err) => {
      console.error(`Webhook delivery failed [${endpoint.id}] ${endpoint.url}:`, err);
    });
  }
}
