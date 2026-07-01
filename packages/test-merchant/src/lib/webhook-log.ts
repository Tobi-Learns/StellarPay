export interface WebhookEntry {
  ts: number;
  type: string;
  data: unknown;
  verified: boolean;
}

// Module-level store — resets on server restart, fine for local testing
export const webhookLog: WebhookEntry[] = [];
