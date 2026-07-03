// Standardized resource IDs (Phase 3.2).
//
// External handle = `<prefix>_<ULID>` (typed, opaque, non-enumerable, k-sortable).
// On-chain link_id = Snowflake u64 (time-ordered, collision-safe).
// Ported to the SDK as ids.ts — keep the two in sync.

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // base32, no I L O U

function encodeTime(ms: number, len: number): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out = CROCKFORD[ms % 32] + out;
    ms = Math.floor(ms / 32);
  }
  return out;
}

function encodeRandom(len: number): string {
  const bytes = new Uint8Array(len);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  // 256 % 32 === 0, so `byte % 32` is unbiased.
  for (let i = 0; i < len; i++) out += CROCKFORD[bytes[i] % 32];
  return out;
}

/** 26-char Crockford base32 ULID: 10 chars ms-time (sortable) + 16 chars random. */
export function ulid(): string {
  return encodeTime(Date.now(), 10) + encodeRandom(16);
}

/** Typed external id, e.g. `newId("plink")` → `"plink_01J8Z9K3QY..."`. */
export function newId(prefix: string): string {
  return `${prefix}_${ulid()}`;
}

// Snowflake epoch — 2024-01-01T00:00:00Z. Fixed forever; never change it.
const SNOWFLAKE_EPOCH = 1704067200000;

/**
 * Time-ordered 63-bit id for the on-chain link_id, replacing Date.now() (which
 * collides for two links created in the same millisecond). Layout:
 * `((ms - epoch) << 22) | 22 random bits`. Returned as bigint — it exceeds the
 * JS 2^53 safe-integer range, so keep it bigint/string end-to-end, never Number.
 */
export function snowflakeU64(): bigint {
  const ms = BigInt(Date.now() - SNOWFLAKE_EPOCH);
  const rand = BigInt(Math.floor(Math.random() * 0x400000)); // 22 bits
  // BigInt() constructor (not `22n` literal) to stay compatible with the web
  // tsconfig target (< ES2020).
  return (ms << BigInt(22)) | rand;
}
