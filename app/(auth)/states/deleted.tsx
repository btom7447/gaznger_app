import React, { useCallback } from "react";
import { Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { EdgeStateScreen } from "@/components/ui/auth";

/**
 * Account deleted/deactivated. Reached as a deep-link target from
 * support emails or a phone-screen toast action. Per the design copy,
 * data is removed after 30 days; pre-deletion the account exists but
 * `/auth/check-phone` returns `exists: false` for it (server-side
 * tombstone). Accepts optional `phone` and `deletedAt` query params.
 */
export default function DeletedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string; deletedAt?: string }>();

  const formattedDate = params.deletedAt
    ? new Date(params.deletedAt).toLocaleDateString("en-NG", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  const body = params.phone
    ? `The account linked to ${params.phone}${
        formattedDate ? ` was deleted on ${formattedDate}` : " was deleted"
      }. Data is removed after 30 days.`
    : "The account linked to this phone was deleted. Data is removed after 30 days.";

  const handleCreate = useCallback(() => {
    router.replace({
      pathname: "/(auth)/phone" as never,
      params: { mode: "signup" },
    });
  }, [router]);

  const handleSupport = useCallback(() => {
    Linking.openURL("mailto:support@gaznger.com").catch(() => {});
  }, []);

  return (
    <EdgeStateScreen
      icon="person"
      tone="neutral"
      headline="This account no longer exists."
      body={body}
      primaryCta={{ label: "Create a new account", onPress: handleCreate }}
      secondary={{
        leading: "Not you? ",
        link: "Contact support",
        onPress: handleSupport,
      }}
    />
  );
}
