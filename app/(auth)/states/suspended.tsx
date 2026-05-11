import React, { useCallback } from "react";
import { Linking } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { EdgeStateScreen } from "@/components/ui/auth";

/**
 * Account suspended. Reached when:
 *  - /auth/check-phone returns accountStatus: "suspended"
 *  - /auth/login returns 403 with same payload
 *  - /auth/me sync flips user.accountStatus to "suspended"
 *    (bootstrap router routes here on next launch)
 *
 * Body and reason copy come from the server's `reason` field when
 * provided, else a sensible default.
 */
export default function SuspendedScreen() {
  const params = useLocalSearchParams<{ reason?: string }>();
  const reason =
    params.reason ??
    "Multiple failed payment verifications.";

  const handleAppeal = useCallback(() => {
    Linking.openURL("mailto:appeals@gaznger.com").catch(() => {});
  }, []);

  const handleLearnMore = useCallback(() => {
    Linking.openURL("https://gaznger.com/help/suspended").catch(() => {});
  }, []);

  return (
    <EdgeStateScreen
      icon="lock-closed"
      tone="error"
      headline="Account suspended."
      body="We found activity on your account that violates our terms. Access is paused while we review."
      reason={{ label: "Reason", text: reason }}
      primaryCta={{ label: "Appeal suspension", onPress: handleAppeal }}
      secondary={{
        leading: "Review takes up to 5 business days. ",
        link: "Learn more",
        onPress: handleLearnMore,
      }}
    />
  );
}
