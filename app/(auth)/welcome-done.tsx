import React, { useCallback, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Theme, useTheme } from "@/constants/theme";
import { Button } from "@/components/ui/primitives";
import { useSessionStore } from "@/store/useSessionStore";

type Role = "customer" | "rider" | "vendor";

interface Variant {
  headline: string;
  sub: string;
  cta: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge: { label: string; value: string; tone: "gold" | "success" | "warning" };
  destination: string;
}

/**
 * Post-signup welcome — 5 variants across role × verification status.
 * Customers always get the gold welcome bonus; rider + vendor get
 * a Verified or In-review badge depending on `params.verified`.
 *
 * The CTA never auto-routes (a11y rule from the brief: "auto-route
 * screens have a 'Stay here' or 'Continue' cancel affordance — never
 * silently navigate within < 1.5s"). We render the destination as a
 * tap-to-continue button — no timer.
 */
function getVariant(role: Role, verified: boolean, firstName: string): Variant {
  switch (role) {
    case "customer":
      return {
        headline: `Welcome, ${firstName}.`,
        sub: "Let's get you fueled. Your first order earns you 50 points.",
        cta: "Continue to home",
        icon: "flame",
        badge: { label: "Welcome bonus", value: "50 points", tone: "gold" },
        destination: "/(customer)/(home)",
      };
    case "rider":
      return verified
        ? {
            headline: `Welcome, ${firstName}.`,
            sub: "You're cleared to ride. Open the queue and grab your first delivery.",
            cta: "Open queue",
            icon: "bicycle",
            badge: { label: "Status", value: "Verified", tone: "success" },
            destination: "/(rider)/(queue)",
          }
        : {
            headline: `Almost there, ${firstName}.`,
            sub: "We're reviewing your bike & papers. We'll notify you the moment you're cleared.",
            cta: "Open dashboard",
            icon: "bicycle",
            badge: { label: "Status", value: "In review · ~18 hrs", tone: "warning" },
            destination: "/(auth)/verification/pending?role=rider",
          };
    case "vendor":
      return verified
        ? {
            headline: `Welcome aboard, ${firstName}.`,
            sub: "Your station is live. Time to take some orders.",
            cta: "Open dashboard",
            icon: "business",
            badge: { label: "Status", value: "Verified", tone: "success" },
            destination: "/(vendor)/(dashboard)",
          }
        : {
            headline: `Almost there, ${firstName}.`,
            sub: "We're reviewing your station details. We'll notify you the moment you're cleared.",
            cta: "Open dashboard",
            icon: "business",
            badge: { label: "Status", value: "In review · ~48 hrs", tone: "warning" },
            destination: "/(auth)/verification/pending?role=vendor",
          };
  }
}

export default function WelcomeDoneScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const params = useLocalSearchParams<{ role?: Role; verified?: string }>();
  const role: Role =
    params.role === "rider" || params.role === "vendor" ? params.role : "customer";
  const verified = params.verified === "true";

  const user = useSessionStore((s) => s.user);
  const firstName =
    user?.displayName?.split(/\s+/)[0] ??
    (role === "rider" ? "Rider" : role === "vendor" ? "Owner" : "there");

  const variant = useMemo(
    () => getVariant(role, verified, firstName),
    [role, verified, firstName]
  );

  const toneMap: Record<
    Variant["badge"]["tone"],
    { dot: string; bg: string; fg: string }
  > = {
    gold: {
      dot: theme.accent,
      bg: theme.accentTint,
      fg: theme.mode === "dark" ? theme.palette.gold300 : theme.palette.gold700,
    },
    success: {
      dot: theme.success,
      bg: theme.successTint,
      fg: theme.mode === "dark" ? theme.palette.success100 : theme.palette.success700,
    },
    warning: {
      dot: theme.warning,
      bg: theme.warningTint,
      fg: theme.mode === "dark" ? theme.palette.warning100 : theme.palette.warning700,
    },
  };
  const tones = toneMap[variant.badge.tone];

  const handleContinue = useCallback(() => {
    router.replace(variant.destination as never);
  }, [router, variant.destination]);

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: theme.bg,
          paddingTop: insets.top + theme.space.s5,
          paddingBottom: insets.bottom + theme.space.s5,
        },
      ]}
    >
      <View style={styles.body}>
        <View style={styles.heroRing}>
          <View style={styles.heroInner}>
            <Ionicons name={variant.icon} size={36} color={theme.fgOnPrimary} />
          </View>
        </View>
        <View style={styles.copyWrap}>
          <Text style={styles.headline}>{variant.headline}</Text>
          <Text style={styles.sub}>{variant.sub}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: tones.bg }]}>
          <View style={[styles.badgeDot, { backgroundColor: tones.dot }]} />
          <Text style={[styles.badgeLabel, { color: tones.fg }]}>
            {variant.badge.label}
          </Text>
          <Text style={[styles.badgeValue, { color: tones.fg }]}>
            · {variant.badge.value}
          </Text>
        </View>
      </View>

      <Button
        variant="primary"
        size="lg"
        full
        onPress={handleContinue}
        accessibilityLabel={variant.cta}
      >
        {variant.cta}
      </Button>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      paddingHorizontal: theme.space.s5,
    },
    body: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.s5,
    },
    heroRing: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: theme.primaryTint,
      alignItems: "center",
      justifyContent: "center",
    },
    heroInner: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    copyWrap: {
      alignItems: "center",
      gap: theme.space.s2 + 2,
      paddingHorizontal: theme.space.s4,
    },
    headline: {
      fontSize: 26,
      lineHeight: 30,
      fontWeight: "800",
      letterSpacing: -0.6,
      color: theme.fg,
      textAlign: "center",
    },
    sub: {
      ...theme.type.body,
      color: theme.fgMuted,
      textAlign: "center",
      lineHeight: 22,
      maxWidth: 280,
    },
    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s2,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: theme.radius.pill,
    },
    badgeDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
    },
    badgeLabel: {
      ...theme.type.micro,
    },
    badgeValue: {
      fontSize: 12,
      fontWeight: "800",
    },
  });
