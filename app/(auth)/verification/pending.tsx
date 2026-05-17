import React, { useCallback, useEffect, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Theme, useTheme } from "@/constants/theme";
import { Button } from "@/components/ui/primitives";
import {
  ForestHeroBg,
  authHeroTokens,
  type AuthHeroTokens,
} from "@/components/ui/auth/AuthHero";
import { getSocket, useSocketStatus } from "@/lib/socket";
import { useSessionStore } from "@/store/useSessionStore";
import { beginIntentionalSignOut } from "@/lib/api";
import { api } from "@/lib/api";

type Role = "rider" | "vendor";

/**
 * Verification pending — v7 design.
 *
 * Forest-gradient hero card (same language as Today / Wallet heroes,
 * "circles only" rule) with a status pill, headline, and sub. Below:
 *   - Primary CTA: Complete verification → routes to KYC screen
 *   - Card of CheckRows ("What you can do now") — what's unlocked vs
 *     waiting on approval
 *   - Secondary tile links: Contact support · Sign out
 *
 * Keeps the existing socket subscription (verification:status) — when
 * the admin approves, we updateUser + route to the role home.
 */
export default function VerificationPendingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tokens = useMemo(() => authHeroTokens(theme), [theme]);
  const styles = useMemo(
    () => makeStyles(theme, insets.top, insets.bottom, tokens),
    [theme, insets.top, insets.bottom, tokens],
  );
  const params = useLocalSearchParams<{ role?: Role; submitted?: string }>();
  const role: Role = params.role === "vendor" ? "vendor" : "rider";
  const submitted = params.submitted === "true";

  const user = useSessionStore((s) => s.user);
  const updateUser = useSessionStore((s) => s.updateUser);
  const logout = useSessionStore((s) => s.logout);
  const socketStatus = useSocketStatus();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = (data: {
      status?: "approved" | "rejected";
      reason?: string;
    }) => {
      if (!data.status) return;
      updateUser({ verificationStatus: data.status });
      if (data.status === "approved") {
        if (role === "rider") {
          router.replace("/(rider)/(queue)" as never);
        } else {
          router.replace("/(vendor)/(today)" as never);
        }
      }
    };
    socket.on("verification:status", handler);
    return () => {
      socket.off("verification:status", handler);
    };
  }, [socketStatus, role, updateUser, router]);

  const handleVerify = useCallback(() => {
    if (role === "rider") {
      router.push("/(auth)/verification/rider" as never);
    } else {
      router.push("/(auth)/verification/vendor" as never);
    }
  }, [router, role]);

  const handleSupport = useCallback(() => {
    router.push("/(screens)/help-support" as never);
  }, [router]);

  const handleSignOut = useCallback(async () => {
    beginIntentionalSignOut();
    try {
      const refreshToken = useSessionStore.getState().refreshToken;
      await api
        .post("/auth/logout", refreshToken ? { refreshToken } : {})
        .catch(() => {});
    } finally {
      logout();
      router.replace("/(auth)/welcome" as never);
    }
  }, [logout, router]);

  const headline = submitted
    ? "We're reviewing your account"
    : "One more step to go live";
  const sub = submitted
    ? "Usually 12–24 hours during business hours. We'll text you the moment you're approved."
    : `Upload a few documents to start receiving ${role === "vendor" ? "orders" : "jobs"}. Takes about 3 minutes.`;
  const statusLabel = submitted ? "Under review" : "Awaiting docs";

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero card */}
        <View style={styles.heroCard}>
          <ForestHeroBg theme={theme} />
          <View style={styles.heroTop}>
            <View
              style={[
                styles.heroIcon,
                {
                  backgroundColor: tokens.skipBg,
                  borderColor: tokens.skipBorder,
                },
              ]}
            >
              <Ionicons
                name="shield-checkmark"
                size={26}
                color={tokens.textPrimary}
              />
            </View>
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: tokens.skipBg,
                  borderColor: tokens.skipBorder,
                },
              ]}
            >
              <View style={styles.statusDot} />
              <Text style={[styles.statusText, { color: tokens.textPrimary }]}>
                {statusLabel}
              </Text>
            </View>
          </View>
          <Text
            style={[styles.heroHeadline, { color: tokens.textPrimary }]}
            accessibilityRole="header"
            accessibilityLabel={headline}
          >
            {headline}
          </Text>
          <Text style={[styles.heroSub, { color: tokens.textSecondary }]}>
            {sub}
          </Text>
        </View>

        {!submitted ? (
          <Button
            variant="primary"
            size="lg"
            full
            onPress={handleVerify}
            accessibilityLabel="Complete verification"
          >
            Complete verification  →
          </Button>
        ) : null}

        {/* What you can do now */}
        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>What you can do now</Text>
          <CheckRow
            ok
            text={`Browse the ${role === "vendor" ? "vendor" : "rider"} dashboard`}
            theme={theme}
          />
          <CheckRow ok text="Edit your profile and contact details" theme={theme} />
          <CheckRow
            ok
            text="Reach Gaznger support if anything's unclear"
            theme={theme}
          />
          <CheckRow
            text={
              role === "vendor"
                ? "Accept orders & receive payouts"
                : "Accept jobs & receive payouts"
            }
            sub="Unlocks after approval"
            theme={theme}
          />
        </View>

        {/* Secondary links */}
        <View style={styles.secondaryRow}>
          <SecondaryLink
            icon="call"
            label="Contact support"
            sub="Chat or call — usually replies in 5 min"
            onPress={handleSupport}
            theme={theme}
          />
          <SecondaryLink
            icon="log-out-outline"
            label="Sign out"
            sub="You can come back anytime"
            onPress={handleSignOut}
            theme={theme}
          />
        </View>

        <Text style={styles.footer}>
          We'll text you the moment you're approved.
        </Text>
      </ScrollView>
    </View>
  );
}

/* ─────────────── Pieces ─────────────── */

function CheckRow({
  ok,
  text,
  sub,
  theme,
}: {
  ok?: boolean;
  text: string;
  sub?: string;
  theme: Theme;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 10, paddingVertical: 6 }}>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          backgroundColor: ok ? theme.successTint : theme.bgMuted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {ok ? (
          <Ionicons name="checkmark" size={14} color={theme.success} />
        ) : (
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              backgroundColor: theme.fgMuted,
            }}
          />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 13,
            color: ok ? theme.fg : theme.fgMuted,
            fontWeight: "700",
          }}
        >
          {text}
        </Text>
        {sub ? (
          <Text
            style={{
              fontSize: 11.5,
              color: theme.fgMuted,
              marginTop: 2,
            }}
          >
            {sub}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function SecondaryLink({
  icon,
  label,
  sub,
  onPress,
  theme,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  sub: string;
  onPress: () => void;
  theme: Theme;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${sub}`}
      style={({ pressed }) => [
        {
          backgroundColor: theme.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.divider,
          borderRadius: 14,
          padding: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        },
        pressed && { opacity: 0.92 },
      ]}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: theme.bgMuted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={18} color={theme.fg} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            ...theme.type.body,
            color: theme.fg,
            fontWeight: "800",
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            ...theme.type.bodySm,
            color: theme.fgMuted,
            marginTop: 2,
          }}
          numberOfLines={1}
        >
          {sub}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.fgMuted} />
    </Pressable>
  );
}

const makeStyles = (
  theme: Theme,
  topInset: number,
  bottomInset: number,
  tokens: AuthHeroTokens,
) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor:
        theme.mode === "dark" ? theme.palette.green800 : theme.bg,
    },
    scroll: {
      paddingHorizontal: 16,
      paddingTop: topInset + 12,
      paddingBottom: bottomInset + 20,
      gap: 14,
    },
    heroCard: {
      position: "relative",
      borderRadius: 24,
      overflow: "hidden",
      minHeight: 260,
      padding: 24,
    },
    heroTop: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
    },
    heroIcon: {
      width: 52,
      height: 52,
      borderRadius: 16,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    statusDot: {
      width: 7,
      height: 7,
      borderRadius: 999,
      backgroundColor: "#FFE08A",
    },
    statusText: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.3,
      textTransform: "uppercase",
    },
    heroHeadline: {
      fontSize: 26,
      fontWeight: "800",
      letterSpacing: -0.4,
      lineHeight: 30,
      marginTop: 20,
    },
    heroSub: {
      fontSize: 14,
      lineHeight: 22,
      marginTop: 10,
      maxWidth: 320,
    },
    card: {
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.divider,
      borderRadius: 16,
      padding: 14,
    },
    cardEyebrow: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: theme.fgMuted,
      marginBottom: 10,
    },
    secondaryRow: {
      gap: 8,
    },
    footer: {
      fontSize: 11.5,
      color: theme.fgMuted,
      textAlign: "center",
      paddingVertical: 8,
    },
  });
