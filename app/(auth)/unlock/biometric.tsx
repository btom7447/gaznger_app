import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Theme, useTheme } from "@/constants/theme";
import { BiometricSheet } from "@/components/ui/auth";
import {
  authenticateBiometric,
  checkBiometricAvailability,
  type BiometricType,
} from "@/lib/permissions";
import { useSessionStore } from "@/store/useSessionStore";
import { postAuthPathFor } from "@/lib/authRouting";

/**
 * Biometric unlock — auto-fires the OS prompt on mount, falls through
 * to PIN unlock on cancel/fail. Reaching this screen means the user
 * opted into biometric unlock during signup AND the device still has
 * a usable biometric enrolled.
 *
 * On success: biometric is local re-auth — the cached refresh token
 * IS the session, so we just route to the role's dashboard. The
 * existing api.ts 401 handler picks up token expiry on the first
 * authenticated call. No /auth/login round-trip.
 *
 * On fail / cancel: route to PIN unlock so the user has a path
 * forward. "Use PIN instead" link does the same.
 */
export default function BiometricUnlockScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [bioType, setBioType] = useState<BiometricType>("face");
  const [showRetry, setShowRetry] = useState(false);
  const ranOnceRef = useRef(false);

  /**
   * Route after a successful biometric. Read the user from the store
   * AT CALL TIME (not via the React hook) so we don't get a stale
   * closure when the user object briefly nulls during a token refresh
   * burst.
   *
   * Fallback chain:
   *   1. Live `user` in the store → route to that role's dashboard.
   *   2. Live `isLoggedIn` true but `user` not yet hydrated →
   *      `/(customer)/(home)` is the safest default; root layouts
   *      will route to verification-pending for rider/vendor as
   *      needed.
   *   3. Session is gone (logged out by /auth/me 401 + refresh
   *      failure) → PIN unlock so the user can re-establish via
   *      /auth/login with their cached PIN, NOT welcome (which
   *      would force a full re-OTP flow).
   */
  const goToDashboard = useCallback(() => {
    const session = useSessionStore.getState();
    const u = session.user;
    if (!u) {
      // Session got cleared mid-flow (likely an /auth/me 401 +
      // refresh failure). Keep the user in the unlock funnel via
      // PIN — they shouldn't be punted back to welcome just because
      // the access token expired. Push (not replace) to dodge the
      // Fabric double-render → surface teardown bug we hit on auth
      // → auth nested-route navigation.
      router.push("/(auth)/unlock/pin" as never);
      return;
    }
    // NOTE: deliberately NOT calling /auth/me here. Biometric unlock
    // is local re-auth; the cached session is the session. Calling
    // /auth/me on this screen risks a 401 → refreshTokens() → reuse-
    // detection trip → fireSessionExpired() → route to welcome
    // BEFORE the user lands on home. The dashboards fetch what they
    // need on mount; the api wrapper transparently handles token
    // refresh on the first authenticated call from the dashboard.
    router.replace(postAuthPathFor(u) as never);
  }, [router]);

  const goToPin = useCallback(() => {
    router.push("/(auth)/unlock/pin" as never);
  }, [router]);

  const trigger = useCallback(async () => {
    setShowRetry(false);
    const ok = await authenticateBiometric("Unlock Gaznger");
    if (ok) {
      goToDashboard();
    } else {
      setShowRetry(true);
    }
  }, [goToDashboard]);

  // On mount: probe + fire prompt once.
  useEffect(() => {
    if (ranOnceRef.current) return;
    ranOnceRef.current = true;
    (async () => {
      const { available, type } = await checkBiometricAvailability();
      if (!available) {
        // Hardware/enrolment changed since signup — fall through to PIN.
        goToPin();
        return;
      }
      setBioType(type);
      trigger();
    })();
  }, [trigger, goToPin]);

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      {/* Dimmed page context behind the sheet. */}
      <View
        style={[
          styles.context,
          { backgroundColor: theme.bgMuted, paddingTop: insets.top + 12 },
        ]}
      >
        <View style={[styles.contextBlock, { backgroundColor: theme.borderStrong }]} />
        <View style={[styles.contextLine, { backgroundColor: theme.borderStrong }]} />
        <View
          style={[
            styles.contextLine,
            styles.contextLineWide,
            { backgroundColor: theme.borderStrong },
          ]}
        />
      </View>

      <View style={[styles.sheetWrap, { paddingBottom: insets.bottom }]}>
        <BiometricSheet
          kind={bioType === "none" ? "touch" : bioType}
          onUsePin={goToPin}
          onRetry={showRetry ? trigger : undefined}
        />
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
    },
    context: {
      flex: 1,
      paddingHorizontal: theme.space.s4,
      gap: theme.space.s3,
      opacity: 0.5,
    },
    contextBlock: {
      width: 80,
      height: 36,
      borderRadius: theme.radius.sm,
      marginBottom: theme.space.s3,
    },
    contextLine: {
      height: 14,
      width: "70%",
      borderRadius: 4,
    },
    contextLineWide: {
      width: "90%",
    },
    sheetWrap: {
      // Sheet shadow + radius are owned by BiometricSheet itself.
    },
  });
