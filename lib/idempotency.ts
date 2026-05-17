/**
 * Idempotency-Key utilities.
 *
 * - `newIdempotencyKey()` — generate a fresh RFC 4122 v4 UUID. Use
 *   directly only when you know you want a brand-new key per call
 *   (e.g. the user just authored a NEW action). For most retry-safe
 *   flows, prefer `useIdempotencyKey(scope)` below.
 *
 * - `useIdempotencyKey(scope)` — React hook that returns a stable
 *   key for the lifetime of a logical operation. The hook keeps a
 *   per-component Map keyed by `scope`, so two calls with the same
 *   scope return the same key. Call `consume(scope)` after the
 *   server confirms success (or the user starts a NEW intent) to
 *   roll a fresh key on the next access.
 *
 *   This closes SECURITY M2 + EDGE P0-1 / P0-2 — payment / topup /
 *   withdraw flows were minting a new key on every retry, which
 *   defeats server-side dedupe. With `useIdempotencyKey`, retries
 *   of the same logical operation send the same key, so the server
 *   returns the cached response instead of double-charging.
 *
 *   Typical use:
 *     const { get, consume } = useIdempotencyKey();
 *     const key = get(`order-verify:${orderId}`);
 *     await api.post("/payments/verify", body, {
 *       headers: { "Idempotency-Key": key },
 *     });
 *     consume(`order-verify:${orderId}`); // on success
 */
import { useCallback, useRef } from "react";
export { newIdempotencyKey } from "@/_shared/idempotency";
import { newIdempotencyKey } from "@/_shared/idempotency";

export interface IdempotencyKeyHandle {
  /** Return a stable key for `scope`. Same scope → same key until consumed. */
  get: (scope: string) => string;
  /** Drop the cached key for `scope` so the next `get(scope)` returns a fresh one. */
  consume: (scope: string) => void;
  /** Drop every cached key (call on unmount or full reset). */
  reset: () => void;
}

export function useIdempotencyKey(): IdempotencyKeyHandle {
  const cacheRef = useRef<Map<string, string>>(new Map());

  const get = useCallback((scope: string): string => {
    const cache = cacheRef.current;
    const existing = cache.get(scope);
    if (existing) return existing;
    const fresh = newIdempotencyKey();
    cache.set(scope, fresh);
    return fresh;
  }, []);

  const consume = useCallback((scope: string) => {
    cacheRef.current.delete(scope);
  }, []);

  const reset = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  return { get, consume, reset };
}
