/**
 * Idempotency-Key generator for state-changing money endpoints.
 *
 * Mirror of server/src/middleware/idempotency.ts: a UUID v4 sent in the
 * `Idempotency-Key` header. The server dedupes via the unique index on
 * Transactions, so a retried request after a flaky network never
 * double-charges / double-debits.
 *
 * One key per *user intent*. The same key MUST be reused if the client
 * needs to retry — never roll a fresh key for a retry, that defeats the
 * point. Roll a new key only when the user takes a new action (e.g.
 * taps Pay again after dismissing an error and changing the amount).
 */

function rng(): number {
  return Math.random();
}

export function newIdempotencyKey(): string {
  // RFC 4122 v4 — same format the server validates against.
  const hex = "0123456789abcdef";
  const out: string[] = [];
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      out.push("-");
    } else if (i === 14) {
      out.push("4");
    } else if (i === 19) {
      out.push(hex[(rng() * 4) | 8]);
    } else {
      out.push(hex[(rng() * 16) | 0]);
    }
  }
  return out.join("");
}
