import React, { useCallback, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { EdgeStateScreen } from "@/components/ui/auth";

/**
 * Maintenance screen. Reached when api.ts intercepts a 503 with
 * `code: "MAINTENANCE"`. Optional `expectedBackAt` query param is the
 * server's ETA — surfaced verbatim. "Try again" route-replaces back
 * to the splash bootstrap so a recovered server resumes normally.
 */
export default function MaintenanceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ expectedBackAt?: string }>();
  const [retrying, setRetrying] = useState(false);

  const expected = params.expectedBackAt
    ? new Date(params.expectedBackAt).toLocaleTimeString("en-NG", {
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      })
    : null;

  const handleRetry = useCallback(() => {
    if (retrying) return;
    setRetrying(true);
    // Route back to the splash, which re-runs bootstrap routing and
    // re-attempts the original network call inside whichever screen
    // it lands on.
    router.replace("/" as never);
  }, [retrying, router]);

  return (
    <EdgeStateScreen
      icon="time"
      tone="neutral"
      headline="Back in a moment."
      body="We're doing scheduled maintenance. Fueling will resume shortly — your wallet and history are safe."
      reason={
        expected
          ? { label: "Expected back by", text: expected }
          : undefined
      }
      primaryCta={{
        label: "Try again",
        onPress: handleRetry,
        variant: "outline",
        loading: retrying,
      }}
    />
  );
}
