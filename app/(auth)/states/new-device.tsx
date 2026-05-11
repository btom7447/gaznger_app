import React, { useCallback } from "react";
import { Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { EdgeStateScreen } from "@/components/ui/auth";

/**
 * New-device alert. Reached as a deep-link target from the
 * `auth:new-device` push notification fired when an unrecognised
 * device successfully logs in. Auth-call path doesn't auto-route
 * here — this is informational, opened by user tap on the inbox
 * item.
 *
 * The two CTAs:
 *   - "That was me" — dismiss + back to dashboard
 *   - "Wasn't me — secure account" — mailto support with the device
 *     label pre-filled so the user can flag it without retyping
 */
export default function NewDeviceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    deviceLabel?: string;
    city?: string;
    occurredAt?: string;
  }>();

  const deviceLabel = params.deviceLabel ?? "Unknown device";
  const occurred = params.occurredAt
    ? new Date(params.occurredAt).toLocaleString("en-NG", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  const reasonText = [
    deviceLabel,
    params.city,
    occurred,
  ]
    .filter(Boolean)
    .join(" · ");

  const handleDismiss = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/(customer)/(home)" as never);
  }, [router]);

  const handleSecure = useCallback(() => {
    const subject = encodeURIComponent("Suspicious login");
    const bodyLines = [
      "I didn't recognise this login on my Gaznger account:",
      `- Device: ${deviceLabel}`,
      params.city ? `- Location: ${params.city}` : null,
      occurred ? `- When: ${occurred}` : null,
      "",
      "Please secure my account.",
    ].filter(Boolean);
    const body = encodeURIComponent(bodyLines.join("\n"));
    Linking.openURL(`mailto:security@gaznger.com?subject=${subject}&body=${body}`).catch(
      () => {}
    );
  }, [deviceLabel, params.city, occurred]);

  return (
    <EdgeStateScreen
      icon="phone-portrait"
      tone="warning"
      headline="New device signed in."
      body="We noticed a sign-in on a device we hadn't seen before. If this was you, you're good to go. If not, secure your account now."
      reason={{ label: "Sign-in", text: reasonText || "Recently" }}
      primaryCta={{
        label: "Wasn't me — secure account",
        onPress: handleSecure,
        variant: "destructive",
      }}
      secondary={{
        leading: "That was me. ",
        link: "Dismiss",
        onPress: handleDismiss,
      }}
    />
  );
}
