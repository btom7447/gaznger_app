/**
 * Idempotency-Key generator.
 *
 * Produces an RFC 4122 v4 UUID suitable for the `Idempotency-Key`
 * header on state-changing endpoints. The server-side middleware
 * dedupes by (userId, key, route) so a retried request after a flaky
 * network never double-charges / double-debits / double-transitions.
 *
 * One key per *user intent.* The same key MUST be reused if the
 * client retries the same logical action — never roll a fresh key
 * for a retry, that defeats the point. Roll a new key only when the
 * user takes a NEW action (e.g. taps Pay again after dismissing an
 * error and changing the amount).
 *
 * RNG: `expo-crypto.getRandomBytes(16)` (CSPRNG) — replaces an
 * earlier Math.random() implementation flagged by EDGE_CASES P2-1
 * (predictable seeding on RN cold-start).
 */
import * as Crypto from "expo-crypto";

export function newIdempotencyKey(): string {
  const bytes = Crypto.getRandomBytes(16);
  // RFC 4122 v4 layout: set version (byte 6 high nibble = 4) and
  // variant (byte 8 high nibble = 8/9/a/b).
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex: string[] = [];
  for (let i = 0; i < 16; i++) {
    hex.push(bytes[i].toString(16).padStart(2, "0"));
  }
  return (
    hex.slice(0, 4).join("") +
    "-" +
    hex.slice(4, 6).join("") +
    "-" +
    hex.slice(6, 8).join("") +
    "-" +
    hex.slice(8, 10).join("") +
    "-" +
    hex.slice(10, 16).join("")
  );
}
