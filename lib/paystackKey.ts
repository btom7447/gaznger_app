/**
 * Paystack public key resolver. The server returns the active key
 * (test vs live) on every /api/payments/initialize and /topup/initialize
 * response. We cache the most recent value in module scope so the
 * <PaystackProvider> can render before the first checkout — falling
 * back to the env-baked key when the server hasn't been hit yet.
 */
const ENV_KEY =
  process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY ?? "";

let cachedKey = ENV_KEY;

export function getPaystackPublicKey(): string {
  return cachedKey;
}

export function setPaystackPublicKey(key: string | undefined | null) {
  if (key && key.trim().length > 0) cachedKey = key.trim();
}
