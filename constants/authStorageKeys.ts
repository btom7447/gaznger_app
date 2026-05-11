// SecureStore keys for auth-adjacent client state. Keep in one file so
// future audits can grep a single import path to find every piece of
// auth-related disk state.

export const AUTH_KEYS = {
  /** First-launch flag. Set on Skip or onboarding completion. */
  hasOnboarded: "gaznger.has-onboarded",
  /** Stable per-install UUID — sent as `X-Device-Id` for known-device skip. */
  deviceId: "gaznger.device-id",
  /** "true" / "false" — opt-in to biometric unlock. Per install, not synced. */
  biometricEnabled: "gaznger.biometric-enabled",
  /** Per-install salt for client-side PIN hashing. Decision pending — see _server-asks/auth-pin-hashing.md. */
  pinSalt: "gaznger.pin-salt",
  /**
   * Bio-login credential. JSON-encoded `{phone, pin}` blob the user
   * opted into when enabling biometric. Read on the welcome screen
   * to surface a "Sign in with biometric" CTA. Encrypted at rest via
   * SecureStore (Keychain/Keystore) and gated by the OS biometric
   * prompt before each read.
   *
   * Stored as a single JSON string rather than two separate keys
   * because SecureStore on iOS coalesces keychain access prompts —
   * one OS prompt per `getItemAsync` call. We want one prompt per
   * sign-in, not two.
   */
  bioCredential: "gaznger.bio-credential",
} as const;
