export type Sep7TxOptions = {
  xdr: string;
  callback?: string;
  pubkey?: string;
  msg?: string;
  networkPassphrase?: string;
  originDomain?: string;
  signature?: string;
};

/**
 * Build a SEP-0007 transaction signing URI.
 * The returned URI is what should be encoded into a QR code for mobile wallets.
 */
export function buildSep7TxUri(options: Sep7TxOptions): string {
  const params = new URLSearchParams();
  params.set("xdr", options.xdr);
  if (options.callback) params.set("callback", options.callback);
  if (options.pubkey) params.set("pubkey", options.pubkey);
  if (options.msg) params.set("msg", options.msg);
  if (options.networkPassphrase) params.set("network_passphrase", options.networkPassphrase);
  if (options.originDomain) params.set("origin_domain", options.originDomain);
  if (options.signature) params.set("signature", options.signature);
  return `web+stellar:tx?${params.toString()}`;
}
