import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import * as LocalAuthentication from "expo-local-authentication";
import Constants from "expo-constants";
import { Platform } from "react-native";

// `expo-notifications` is loaded lazily because importing it on Expo
// Go (SDK 53+) fires a top-level `addPushTokenListener` side-effect
// that surfaces a red `warnOfExpoGoPushUsage` error in dev. We only
// touch the module when the caller actually asks for notification
// permission AND we're outside Expo Go. Real device builds work
// normally because Constants.appOwnership is "standalone" / null.
const isExpoGo = Constants.appOwnership === "expo";

async function loadNotifications() {
  if (isExpoGo) return null;
  return await import("expo-notifications");
}

/**
 * Wrappers around system permissions used during signup priming. Every
 * helper returns the platform's *granted* boolean so callers don't have
 * to interpret the underlying status enum. The actual user-facing prime
 * (a pre-permission screen explaining why we need access) lives in the
 * Permissions screen — these helpers only handle the OS-level request
 * after the user taps "Allow and continue".
 */

export type PermissionStatus = "granted" | "denied" | "undetermined";

function normalise(status: string): PermissionStatus {
  if (status === "granted") return "granted";
  if (status === "undetermined") return "undetermined";
  return "denied";
}

/* ─────────── Location ─────────── */

export async function getLocationStatus(): Promise<PermissionStatus> {
  try {
    const res = await Location.getForegroundPermissionsAsync();
    return normalise(res.status);
  } catch (err) {
    // Native throws when the plist key is missing (older builds before
    // app.json picked up the NSLocation* additions). Treat as denied so
    // signup / map screens don't crash — the user can grant later from
    // Settings once a fresh dev client lands.
    console.warn("[permissions] getLocationStatus failed:", err);
    return "denied";
  }
}

export async function requestLocation(): Promise<PermissionStatus> {
  try {
    const res = await Location.requestForegroundPermissionsAsync();
    return normalise(res.status);
  } catch (err) {
    console.warn("[permissions] requestLocation failed:", err);
    return "denied";
  }
}

/**
 * Rider-only second step. iOS shows a separate dialog after foreground
 * is granted; Android 10+ requires the user to switch to "Always" in
 * settings (the OS won't surface a system prompt for `always` on Android
 * — `requestBackgroundPermissionsAsync` opens settings on most builds).
 *
 * Designed to be called only AFTER foreground is granted. If foreground
 * isn't granted yet, returns "denied" so callers don't trip the OS into
 * an unexpected prompt order.
 */
export async function requestBackgroundLocation(): Promise<PermissionStatus> {
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== "granted") return "denied";
    const res = await Location.requestBackgroundPermissionsAsync();
    return normalise(res.status);
  } catch (err) {
    console.warn("[permissions] requestBackgroundLocation failed:", err);
    return "denied";
  }
}

/* ─────────── Notifications ─────────── */

export async function getNotificationStatus(): Promise<PermissionStatus> {
  const Notifications = await loadNotifications();
  // On Expo Go we report "undetermined" because the system prompt
  // never fires — caller treats this as "skip the priming step".
  if (!Notifications) return "undetermined";
  const res = await Notifications.getPermissionsAsync();
  return normalise(res.status);
}

export async function requestNotifications(): Promise<PermissionStatus> {
  const Notifications = await loadNotifications();
  if (!Notifications) return "denied";
  const res = await Notifications.requestPermissionsAsync();
  return normalise(res.status);
}

/* ─────────── Camera ─────────── */

export async function getCameraStatus(): Promise<PermissionStatus> {
  const res = await ImagePicker.getCameraPermissionsAsync();
  return normalise(res.status);
}

export async function requestCamera(): Promise<PermissionStatus> {
  const res = await ImagePicker.requestCameraPermissionsAsync();
  return normalise(res.status);
}

/* ─────────── Biometrics ─────────── */

export type BiometricType = "face" | "touch" | "iris" | "none";

export interface BiometricAvailability {
  /** Hardware exists AND user has enrolled at least one credential. */
  available: boolean;
  /** Most relevant supported type, prioritised face → touch → iris. */
  type: BiometricType;
}

/**
 * Probes whether biometric unlock is usable on this device. Both
 * conditions must hold: hardware present (`hasHardware`) AND at least
 * one biometric enrolled (`isEnrolled`). Surface this in the Security
 * Setup screen to gate whether to even show the Face/Touch options.
 *
 * On iOS the map is straightforward (Face ID = Face, Touch ID = Touch).
 * On Android we trust whatever `supportedAuthenticationTypesAsync()`
 * returns; modern devices report both face + fingerprint when both are
 * enrolled. We pick face first because the prompt UI is identical.
 */
export async function checkBiometricAvailability(): Promise<BiometricAvailability> {
  const [hasHardware, isEnrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  if (!hasHardware || !isEnrolled) {
    return { available: false, type: "none" };
  }
  // expo-local-authentication enum:
  //   1 = FINGERPRINT, 2 = FACIAL_RECOGNITION, 3 = IRIS
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return { available: true, type: "face" };
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return { available: true, type: "touch" };
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return { available: true, type: "iris" };
  }
  return { available: false, type: "none" };
}

/**
 * Triggers the OS biometric prompt. Returns true on success, false on
 * cancel/fail. Caller decides what to do on false (typically: surface
 * the PIN keypad as fallback).
 *
 * The `promptMessage` is the only piece of copy under our control on
 * iOS; on Android we can also pass title/subtitle, but the default
 * platform UI is intentional (matches user expectations for OS auth).
 */
export async function authenticateBiometric(
  promptMessage: string = "Unlock Gaznger"
): Promise<boolean> {
  const res = await LocalAuthentication.authenticateAsync({
    promptMessage,
    fallbackLabel: "Use PIN instead",
    cancelLabel: "Cancel",
    // Critical: disable device passcode fallback. We have our own PIN UI
    // and want users routed there — not into the OS passcode flow which
    // would skip our 5-fail lockout logic.
    disableDeviceFallback: true,
  });
  return res.success;
}

/**
 * iOS labels biometric types by name in copy ("Face ID", "Touch ID").
 * Android-side, the OS draws its own sheet so we say "biometric".
 */
export function biometricLabel(type: BiometricType): string {
  if (Platform.OS === "ios") {
    if (type === "face") return "Face ID";
    if (type === "touch") return "Touch ID";
  }
  if (type === "face") return "Face unlock";
  if (type === "touch") return "Fingerprint";
  return "Biometric";
}
