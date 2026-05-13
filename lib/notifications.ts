import { Platform } from "react-native";
import { api } from "./api";

/**
 * Whether the native FCM / APNS plumbing is actually present in this
 * build. Without `google-services.json` (Android) or a configured APNS
 * cert (iOS), `getDevicePushTokenAsync()` raises a native exception
 * that the surrounding try/catch can't always catch — it surfaces as a
 * silent root-tree unmount in release builds. Gate the call behind an
 * explicit env flag so a build without Firebase set up still boots.
 *
 * Also: `import * as Notifications from "expo-notifications"` at the
 * top of the file would run `Notifications.setNotificationHandler` at
 * MODULE LOAD time. We instead require() it lazily inside the function
 * so a build with the native module missing/misconfigured doesn't
 * blow up the entire JS context at import time.
 */
const PUSH_ENABLED = process.env.EXPO_PUBLIC_PUSH_ENABLED === "true";

export async function registerDeviceToken() {
  if (!PUSH_ENABLED) return;
  try {
    // Lazy require so module-load can't crash the bundle.
    const Notifications = require("expo-notifications") as typeof import("expo-notifications");

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return;

    // Get native FCM / APNS token for Firebase Admin SDK
    const tokenData = await Notifications.getDevicePushTokenAsync();
    const token = tokenData.data;
    if (token) {
      await api.post("/auth/device-token", { token });
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Gaznger",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }
  } catch {
    // Non-fatal — app works without push
  }
}
