import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/constants/theme";
import { useAppFonts } from "@/constants/useFonts";
import { useSessionStore } from "@/store/useSessionStore";
import { getBiometricEnabled, setBiometricEnabled } from "@/lib/auth";
import { needsOnboarding, onboardingPathFor } from "@/lib/authRouting";

/**
 * Splash + bootstrap router. Replaces the legacy 2s-timer +
 * email-auth redirect with the v4 design's branched routing:
 *
 *   No session (first launch OR returning logged-out)
 *     → /(auth)/welcome
 *     (welcome itself decides: pitch carousel on first launch,
 *      jump-to-CTA on return — flag stored client-side)
 *   Returning, suspended account                     → /(auth)/states/suspended
 *   Returning, session + hasPin + biometric enabled  → /(auth)/unlock/biometric
 *   Returning, session + hasPin                      → /(auth)/unlock/pin
 *   Returning, session + role-specific dashboard
 *     - customer/admin                               → /(customer)/(home)
 *     - rider, verified                              → /(rider)/(queue)
 *     - rider, pending                               → /(auth)/verification/pending?role=rider
 *     - vendor, verified                             → /(vendor)/(today)
 *     - vendor, pending                              → /(auth)/verification/pending?role=vendor
 *
 * Loading flag flips after 2s if fonts/hydration aren't done — gives
 * users a "Connecting…" hint instead of a silent splash on slow boots.
 */
export default function SplashBootstrap() {
  const router = useRouter();
  const theme = useTheme();
  const fontsLoaded = useAppFonts();
  const { isLoggedIn, hasHydrated, user } = useSessionStore();
  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowLoading(true), 2000);
    return () => clearTimeout(t);
  }, []);

  // Bootstrap router fires exactly ONCE per app mount. Without this
  // guard, the effect re-runs whenever `isLoggedIn` or `user` flips
  // (e.g. after PIN unlock calls login()) — and the bootstrap path
  // races the unlock screen's own router.replace, which surfaces as
  // a "screen rendered twice" flicker. The session subscriber in
  // app/_layout.tsx handles the post-mount routing for logout flow;
  // bootstrap routing only needs to kick in on cold start.
  const hasBootedRef = useRef(false);

  useEffect(() => {
    if (!fontsLoaded || !hasHydrated) return;
    if (hasBootedRef.current) return;
    hasBootedRef.current = true;

    let cancelled = false;
    (async () => {
      const biometricEnabled = await getBiometricEnabled();
      if (cancelled) return;

      // No session — first-launch + returning logged-out both land on
      // /welcome; the welcome screen decides whether to show the pitch
      // carousel (first launch) or jump straight to the CTA slide
      // (returning users) based on its own `hasOnboarded` flag.
      if (!isLoggedIn || !user) {
        // Clean up an orphan biometric flag — if it's still on but
        // there's no session to unlock to, the next cold start would
        // mount the biometric screen and fall straight back here.
        if (biometricEnabled) {
          await setBiometricEnabled(false);
          console.log("[bootstrap] cleared orphan biometric flag");
        }
        console.log("[bootstrap] → /welcome (no session)");
        router.replace("/(auth)/welcome" as never);
        return;
      }

      // Suspended overrides everything.
      if (user.accountStatus === "suspended") {
        console.log("[bootstrap] → /suspended");
        router.replace("/(auth)/states/suspended" as never);
        return;
      }

      // Session exists. If a PIN is configured, gate access on unlock.
      if (user.hasPin) {
        if (biometricEnabled) {
          console.log("[bootstrap] → /unlock/biometric");
          router.replace("/(auth)/unlock/biometric" as never);
        } else {
          console.log("[bootstrap] → /unlock/pin");
          router.replace("/(auth)/unlock/pin" as never);
        }
        return;
      }

      // v7 unified onboarding: if the user has a session but their
      // role-specific onboarding never finished (signed up but force-
      // quit before saving name/address / station / vehicle), send
      // them back into the wizard rather than the role home.
      if (needsOnboarding(user)) {
        const path = onboardingPathFor(user.role);
        console.log(`[bootstrap] → ${path} (onboarding incomplete)`);
        router.replace(path as never);
        return;
      }

      // Session without PIN — legacy users (signed up before PIN was a
      // requirement) skip unlock and head straight to their dashboard.
      // Phase 5 may add a forced-PIN-setup flow for these users; for
      // now they pass through.
      const role = user.role;
      if (role === "rider") {
        if (user.verificationStatus === "approved") {
          router.replace("/(rider)/(queue)" as never);
        } else {
          router.replace(
            "/(auth)/verification/pending?role=rider" as never
          );
        }
        return;
      }
      if (role === "vendor") {
        if (user.verificationStatus === "approved") {
          // Vendor app v6 architecture lands here. Today tab is the
          // hero entry point per the chosen "hero" layout rule.
          router.replace("/(vendor)/(today)" as never);
        } else {
          router.replace(
            "/(auth)/verification/pending?role=vendor" as never
          );
        }
        return;
      }
      // customer + admin — same destination.
      router.replace("/(customer)/(home)" as never);
    })();

    return () => {
      cancelled = true;
    };
  }, [fontsLoaded, hasHydrated, isLoggedIn, user, router]);

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <View style={styles.brand}>
        <Image
          source={require("@/assets/images/gaznger-logo.png")}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="Gaznger"
        />
        <Text style={[styles.tagline, { color: theme.fgMuted }]}>
          Fuel without the queue.
        </Text>
      </View>
      {showLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.fgMuted }]}>
            Connecting…
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    alignItems: "center",
    gap: 14,
  },
  logo: {
    width: 200,
    height: 100,
  },
  tagline: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  loadingWrap: {
    position: "absolute",
    bottom: 80,
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 11,
    fontWeight: "600",
  },
});
