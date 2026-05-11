import React, { useCallback } from "react";
import { Alert, Linking, Platform } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as Application from "expo-application";
import { EdgeStateScreen } from "@/components/ui/auth";

// Real store IDs not assigned yet. The CTA opens a placeholder URL
// only in __DEV__ so a production build doesn't ship a dead link
// (audit B.2). When the real iOS/Android listings exist, drop the
// __DEV__ guard and replace the placeholders.
const STORE_URL_IOS = "itms-apps://itunes.apple.com/app/id000000000";
const STORE_URL_ANDROID = "market://details?id=com.gaznger.app";

/**
 * Force update gate. Reached when api.ts detects either:
 *   - response with X-Min-Version > current native version
 *   - 426 Upgrade Required
 *
 * Body shows the user's current version and the required version side
 * by side. CTA opens the platform store in dev; in production we show
 * an alert pointing to support until real store IDs land.
 */
export default function ForceUpdateScreen() {
  const params = useLocalSearchParams<{ minVersion?: string }>();
  const current = Application.nativeApplicationVersion ?? "?";
  const required = params.minVersion ?? "—";

  const handleUpdate = useCallback(() => {
    if (!__DEV__) {
      // Production guard until real store IDs land. Without this, the
      // placeholder ID would land users on a 404 in the App Store /
      // Play Store. See audit B.2.
      Alert.alert(
        "Update unavailable",
        "We're rolling out the store listing. Email support@gaznger.com if you need help.",
        [{ text: "OK" }]
      );
      return;
    }
    const url =
      Platform.OS === "ios" ? STORE_URL_IOS : STORE_URL_ANDROID;
    Linking.openURL(url).catch(() => {
      const fallback =
        Platform.OS === "ios"
          ? "https://apps.apple.com/app/id000000000"
          : "https://play.google.com/store/apps/details?id=com.gaznger.app";
      Linking.openURL(fallback).catch(() => {});
    });
  }, []);

  return (
    <EdgeStateScreen
      icon="arrow-up"
      tone="primary"
      headline="Update required."
      body="This release includes important security fixes and new delivery tracking. Update before continuing."
      reason={{
        label: "Version",
        text: `Current v${current} → Required v${required}`,
      }}
      primaryCta={{
        label: Platform.OS === "ios" ? "Update on the App Store" : "Update on Google Play",
        onPress: handleUpdate,
      }}
    />
  );
}
