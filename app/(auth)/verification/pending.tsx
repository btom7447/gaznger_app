import React, { useCallback, useEffect, useMemo } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Theme, useTheme } from "@/constants/theme";
import {
  PendingTimeline,
  type PendingRow,
} from "@/components/ui/auth";
import { Button } from "@/components/ui/primitives";
import { getSocket, useSocketStatus } from "@/lib/socket";
import { useSessionStore } from "@/store/useSessionStore";

type Role = "rider" | "vendor";

/**
 * Verification pending lobby. Reached after kickoff "Save and finish
 * later" OR as the bootstrap router's destination for any
 * rider/vendor with `verificationStatus === "pending"`.
 *
 * Subscribes to the `verification:status` socket event so an
 * approval flips the user straight to /welcome-done without a
 * relaunch (per _server-asks/auth-verification-status.md).
 */
export default function VerificationPendingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const params = useLocalSearchParams<{ role?: Role }>();
  const role: Role = params.role === "vendor" ? "vendor" : "rider";

  const updateUser = useSessionStore((s) => s.updateUser);
  const socketStatus = useSocketStatus();

  // Listen for server-side approval flip.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = (data: { status?: "approved" | "rejected"; reason?: string }) => {
      if (!data.status) return;
      updateUser({ verificationStatus: data.status });
      if (data.status === "approved") {
        router.replace({
          pathname: "/(auth)/welcome-done" as never,
          params: { role, verified: "true" },
        });
      }
      // Rejected screen is part of `_drift/auth-verification-uploads-pending.md`;
      // until designs land, surfacing the status flip in-place is the
      // honest behaviour — the user can read the reason in their profile.
    };
    socket.on("verification:status", handler);
    return () => {
      socket.off("verification:status", handler);
    };
    // socketStatus dep — re-binds when the socket flips to live, so
    // a screen mounted before the socket connects doesn't miss its
    // first attach. Same pattern as the customer Track screen.
  }, [socketStatus, role, updateUser, router]);

  const rows: PendingRow[] =
    role === "rider"
      ? [
          { label: "Documents received", status: "Done", tone: "success" },
          { label: "Identity check", status: "In progress", tone: "warning" },
          { label: "Bike inspection", status: "Pending", tone: "neutral" },
          { label: "Activation", status: "Pending", tone: "neutral" },
        ]
      : [
          { label: "Documents received", status: "Done", tone: "success" },
          { label: "Licence check", status: "In progress", tone: "warning" },
          { label: "Station inspection", status: "Pending", tone: "neutral" },
          { label: "Activation", status: "Pending", tone: "neutral" },
        ];

  const headlineSub =
    role === "rider"
      ? "We're reviewing your bike papers and identity. We'll send a push notification once you're cleared — usually within 18 hours."
      : "We're reviewing your station licence and photos. Our team may reach out to schedule a quick call. Usually cleared within 48 hours.";

  const handleGotIt = useCallback(() => {
    // Send rider/vendor to their (limited) dashboard while pending.
    // The real dashboard layouts already render a read-only state when
    // the user isn't approved — they can read messages, see profile,
    // but can't accept work.
    if (role === "rider") {
      router.replace("/(rider)/(queue)" as never);
    } else {
      router.replace("/(vendor)/(today)" as never);
    }
  }, [router, role]);

  const handleSupport = useCallback(() => {
    Linking.openURL("mailto:support@gaznger.com").catch(() => {});
  }, []);

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: theme.bg,
          paddingTop: insets.top + theme.space.s4,
          paddingBottom: insets.bottom + theme.space.s4,
        },
      ]}
    >
      <View style={styles.body}>
        <View style={styles.iconRing}>
          <Ionicons
            name="time-outline"
            size={44}
            color={theme.mode === "dark" ? theme.palette.gold300 : theme.warning}
          />
        </View>
        <View style={styles.copyWrap}>
          <Text style={styles.headline}>Sit tight. We're checking.</Text>
          <Text style={styles.sub}>{headlineSub}</Text>
        </View>
        <View style={styles.timelineWrap}>
          <PendingTimeline rows={rows} />
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          variant="primary"
          size="lg"
          full
          onPress={handleGotIt}
          accessibilityLabel="Got it — open dashboard"
        >
          Got it
        </Button>
        <View style={styles.supportRow}>
          <Text style={styles.supportLeading}>Questions? </Text>
          <Pressable
            onPress={handleSupport}
            accessibilityRole="link"
            accessibilityLabel="Chat with support"
          >
            <Text style={styles.supportLink}>Chat with support</Text>
          </Pressable>
        </View>
      </View>
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
    iconRing: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: theme.warningTint,
      alignItems: "center",
      justifyContent: "center",
    },
    copyWrap: {
      alignItems: "center",
      gap: theme.space.s2 + 2,
    },
    headline: {
      fontSize: 24,
      lineHeight: 28,
      fontWeight: "800",
      letterSpacing: -0.5,
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
    timelineWrap: {
      width: "100%",
    },
    footer: {
      gap: theme.space.s2 + 2,
    },
    supportRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
    },
    supportLeading: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    supportLink: {
      ...theme.type.bodySm,
      color: theme.primary,
      fontWeight: "700",
    },
  });
