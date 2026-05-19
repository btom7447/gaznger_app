import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import { AUTH_KEYS } from "@/constants/authStorageKeys";
import { devLog } from "@/lib/log";

/**
 * Returns the persisted device id, generating + storing a fresh UUID
 * on first call. The id is sent as `X-Device-Id` on `/auth/check-phone`
 * so the server can decide whether to skip OTP for a known device.
 *
 * Stable across app launches; rotates only on uninstall (SecureStore
 * survives app updates but not uninstalls).
 */
export async function getOrCreateDeviceId(): Promise<string> {
  try {
    const existing = await SecureStore.getItemAsync(AUTH_KEYS.deviceId);
    if (existing) return existing;
    const id = Crypto.randomUUID();
    try {
      await SecureStore.setItemAsync(AUTH_KEYS.deviceId, id);
    } catch (e: any) {
      devLog("[auth] setDeviceId failed: " + (e?.message ?? String(e)));
    }
    return id;
  } catch (e: any) {
    devLog("[auth] getDeviceId failed: " + (e?.message ?? String(e)));
    return Crypto.randomUUID();
  }
}

/**
 * Friendly device label for the Active Sessions screen on the server,
 * passed as `X-Device-Label`. e.g. "iPhone 15 Pro" or "SM-G998B".
 * Falls back to a generic OS label if `Device.modelName` isn't available
 * (Expo Go on web).
 */
export function getDeviceLabel(): string {
  const model = Device.modelName ?? Device.deviceName ?? Device.osName;
  return model || "Unknown device";
}

/**
 * Whether the user has completed the onboarding carousel (or skipped).
 * Checked on bootstrap to decide between Onboarding and Welcome.
 */
export async function getHasOnboarded(): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(AUTH_KEYS.hasOnboarded);
    return v === "true";
  } catch (e: any) {
    devLog("[auth] getHasOnboarded failed: " + (e?.message ?? String(e)));
    return false;
  }
}

export async function setHasOnboarded(v: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(AUTH_KEYS.hasOnboarded, v ? "true" : "false");
  } catch (e: any) {
    devLog("[auth] setHasOnboarded failed: " + (e?.message ?? String(e)));
  }
}

/**
 * Per-install opt-in to biometric unlock. Storing as a SecureStore key
 * (not on the server) so re-installing the app forces a fresh opt-in,
 * which is the correct security default.
 */
export async function getBiometricEnabled(): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(AUTH_KEYS.biometricEnabled);
    return v === "true";
  } catch (e: any) {
    devLog("[auth] getBiometricEnabled failed: " + (e?.message ?? String(e)));
    return false;
  }
}

export async function setBiometricEnabled(v: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(AUTH_KEYS.biometricEnabled, v ? "true" : "false");
  } catch (e: any) {
    devLog("[auth] setBiometricEnabled failed: " + (e?.message ?? String(e)));
  }
}

/* ──────────────────────── Biometric login credential ──────────────────────── */

/**
 * Phone-bound biometric credential — what the welcome screen reads
 * to show a "Sign in with biometric" button. Stored as an encrypted
 * `{phone, pin}` blob behind the OS biometric prompt.
 *
 * Threat model:
 *   - SecureStore is encrypted at rest (iOS Keychain, Android
 *     Keystore). Even with physical disk access an attacker can't
 *     pull this without a working biometric AND device unlock.
 *   - `requireAuthentication: true` triggers an OS prompt on every
 *     read — so the credential is unreadable without a fresh user-
 *     present biometric, not just the screen lock.
 *   - The PIN itself does live in SecureStore (the server's
 *     /auth/login needs the raw 4-digit value to bcrypt-compare).
 *     Acceptable for MVP — same threat model as iOS's "Sign in with
 *     Face ID" against a saved password.
 *
 * Cleared on:
 *   - explicit sign-out (Profile screen)
 *   - "Forget this device" (Settings → Security)
 *   - biometric disabled in Settings
 */
export interface BioCredential {
  phone: string;
  pin: string;
}

export async function setBioCredential(cred: BioCredential): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      AUTH_KEYS.bioCredential,
      JSON.stringify(cred),
      {
        // OS-side biometric requirement on every read. iOS surfaces
        // the Face ID / Touch ID sheet automatically when the
        // protected item is accessed; Android shows the platform
        // biometric prompt.
        requireAuthentication: true,
        authenticationPrompt:
          "Confirm to enable biometric sign-in on this device",
        // SECURITY A3 (Phase 1, decision D1 Path B) — strictest
        // Keychain ACL we can apply:
        //   - WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: item is unreadable
        //     if the user removes their device passcode AND is not
        //     transferable via iCloud Keychain to another device.
        //   - Combined with `requireAuthentication: true` above, a
        //     stolen unencrypted backup can't yield the credential
        //     without the original device + a live biometric.
        // Android maps this to AES-GCM-backed Keystore with
        // user-authentication-required = true.
        keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
      }
    );
  } catch (e: any) {
    devLog("[auth] setBioCredential failed: " + (e?.message ?? String(e)));
  }
}

export async function getBioCredential(
  promptMessage = "Sign in with your biometric"
): Promise<BioCredential | null> {
  try {
    const raw = await SecureStore.getItemAsync(AUTH_KEYS.bioCredential, {
      requireAuthentication: true,
      authenticationPrompt: promptMessage,
    });
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BioCredential;
    if (!parsed.phone || !parsed.pin) return null;
    return parsed;
  } catch {
    // User cancelled the OS prompt OR the credential is corrupt.
    // Caller treats either as "no credential" → falls back to PIN.
    return null;
  }
}

/**
 * Cheap presence check — does NOT trigger the OS biometric prompt.
 * Used by the welcome screen to decide whether to show the bio-login
 * button at all. Returns true if a credential row exists in
 * SecureStore (its CONTENT requires biometric to read; its presence
 * does not).
 */
export async function hasBioCredential(): Promise<boolean> {
  try {
    // expo-secure-store doesn't expose a "key exists?" probe; we
    // attempt the read WITHOUT requireAuthentication. iOS returns
    // `null` for items that require auth but we passed without — on
    // Android the read just returns the item. Either way, a non-null
    // / "exists" answer is what we want. To stay portable across
    // both platforms we use a separate sentinel key.
    const sentinel = await SecureStore.getItemAsync(
      `${AUTH_KEYS.bioCredential}.exists`
    );
    return sentinel === "true";
  } catch {
    return false;
  }
}

export async function clearBioCredential(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(AUTH_KEYS.bioCredential).catch(() => {}),
    SecureStore.deleteItemAsync(`${AUTH_KEYS.bioCredential}.exists`).catch(
      () => {}
    ),
  ]);
}

/**
 * Helper called by `setBioCredential` so the sentinel stays in sync.
 * Kept as a separate write because SecureStore's atomic guarantees
 * are per-key.
 */
export async function markBioCredentialPresent(present: boolean): Promise<void> {
  try {
    if (present) {
      await SecureStore.setItemAsync(
        `${AUTH_KEYS.bioCredential}.exists`,
        "true"
      );
    } else {
      await SecureStore.deleteItemAsync(
        `${AUTH_KEYS.bioCredential}.exists`
      ).catch(() => {});
    }
  } catch (e: any) {
    devLog("[auth] markBioCredentialPresent failed: " + (e?.message ?? String(e)));
  }
}

/**
 * PIN hashing — provisional. Server-side hashing is the planned
 * primary path (TLS protects in transit; server bcrypts before
 * persisting). This helper exists so screens can call a single
 * function without knowing the decision; today it just normalises
 * the PIN to a deterministic string. If the server contract ends up
 * requiring client-side hashing, swap the body without touching
 * callers.
 *
 * See _server-asks/auth-pin-hashing.md for the open decision.
 */
export async function preparePinForTransmission(pin: string): Promise<string> {
  // Strip any whitespace defensively. Keypad inputs only digits, but
  // the type is string and we want zero ambiguity downstream.
  return pin.replace(/\s+/g, "");
}
