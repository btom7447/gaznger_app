import React, { useCallback } from "react";
import { Linking } from "react-native";
import { useRouter } from "expo-router";
import { EdgeStateScreen } from "@/components/ui/auth";
import { useSessionStore } from "@/store/useSessionStore";

/**
 * Withdrawal hold — vendor + rider only. Built but real entry lives
 * in the wallet flow (out of this slice). Wallet detects
 * `user.withdrawalHold.active === true` and routes here when the user
 * taps Withdraw. The screen explains the hold + offers a support
 * mailto so the user has a path forward.
 *
 * "Back to dashboard" routes to the role's dashboard rather than
 * forcing logout — the hold is informational, not a session block.
 */
export default function WithdrawalHoldScreen() {
  const router = useRouter();
  const user = useSessionStore((s) => s.user);
  const hold = user?.withdrawalHold;
  const reason =
    hold?.reason ??
    "Standard payout review. Withdrawals resume automatically once cleared.";

  const handleBack = useCallback(() => {
    if (user?.role === "rider") {
      router.replace("/(rider)/(queue)" as never);
      return;
    }
    if (user?.role === "vendor") {
      router.replace("/(vendor)/(today)" as never);
      return;
    }
    // Fallback (shouldn't be hit — only riders/vendors reach this).
    router.replace("/(customer)/(home)" as never);
  }, [router, user?.role]);

  const handleSupport = useCallback(() => {
    Linking.openURL("mailto:payouts@gaznger.com").catch(() => {});
  }, []);

  return (
    <EdgeStateScreen
      icon="pause-circle"
      tone="warning"
      headline="Withdrawals on hold."
      body="Your earnings are safe. Withdrawals are paused while we review your account."
      reason={{ label: "Reason", text: reason }}
      primaryCta={{
        label: "Back to dashboard",
        onPress: handleBack,
        variant: "outline",
      }}
      secondary={{
        leading: "Need help? ",
        link: "Contact payouts",
        onPress: handleSupport,
      }}
    />
  );
}
