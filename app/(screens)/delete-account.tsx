import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { toast } from "sonner-native";
import { Theme, useTheme } from "@/constants/theme";
import {
  ScreenContainer,
  ScreenHeader,
} from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { useSessionStore } from "@/store/useSessionStore";
import { requireStepUpPin } from "@/components/ui/auth";
import {
  clearBioCredential,
  markBioCredentialPresent,
  setBiometricEnabled,
} from "@/lib/auth";

/**
 * Delete account screen (audit B.1).
 *
 * Apple + Google review require an in-app deletion path. We do
 * soft-delete with 30-day retention (announced in copy here + in
 * the privacy policy). The flow:
 *
 *   1. Read the consequences (this screen).
 *   2. Tap "Delete my account" → step-up auth (biometric → PIN
 *      fallback). The PIN prompt routes through `requireStepUpAuth`
 *      which returns true on success.
 *   3. We POST `/auth/me/delete` with the PIN (server re-verifies as
 *      defence-in-depth).
 *   4. On success: drop the local session, route to /welcome.
 */
export default function DeleteAccountScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const sessionLogout = useSessionStore((s) => s.logout);
  const [busy, setBusy] = useState(false);

  const handleDelete = useCallback(async () => {
    if (busy) return;
    // Use the PIN-returning step-up sheet — server's /auth/me/delete
    // requires the raw PIN to re-verify (defence-in-depth: never
    // trust client-side step-up alone for a destructive action).
    // The sheet validates the PIN against /auth/pin/verify before
    // resolving, so a wrong PIN can't even reach this code path.
    // Lockout from audit A.4 still gates brute force.
    const result = await requireStepUpPin({
      reason: "Enter your PIN to permanently delete your account",
    });
    if (!result.ok || !result.pin) return;
    setBusy(true);
    try {
      await api.post("/auth/me/delete", { pin: result.pin });
      // Wipe bio credential alongside the session — the account is
      // anonymised server-side, so the cached creds would route into
      // a now-unusable login if left behind.
      await Promise.all([
        clearBioCredential().catch(() => {}),
        markBioCredentialPresent(false).catch(() => {}),
        setBiometricEnabled(false).catch(() => {}),
      ]);
      toast.success("Account deleted");
      sessionLogout();
      router.replace("/(auth)/welcome" as never);
    } catch (err: any) {
      const msg = err?.message ?? "Couldn't delete account";
      toast.error(msg);
      setBusy(false);
    }
  }, [busy, router, sessionLogout]);

  return (
    <ScreenContainer
      edges={["top", "bottom"]}
      header={<ScreenHeader title="Delete account" onBack={() => router.back()} />}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.heroIcon}>
          <Ionicons name="warning-outline" size={28} color={theme.error} />
        </View>
        <Text style={styles.title}>Delete your Gaznger account</Text>
        <Text style={styles.body}>
          Deleting your account anonymises your personal info immediately
          and signs you out on every device. Your order history stays
          linked for tax + dispute records, but no one will see your
          name, phone number, or photo.
        </Text>
        <View style={styles.bullets}>
          <BulletRow theme={theme} icon="time-outline">
            Your account is recoverable for 30 days. After that, it's
            permanently removed.
          </BulletRow>
          <BulletRow theme={theme} icon="shield-checkmark-outline">
            Personal info (name, phone, email, photo) is anonymised
            immediately. You can't recover the same account by
            re-signing-up with the same number for 30 days.
          </BulletRow>
          <BulletRow theme={theme} icon="receipt-outline">
            Order receipts + payment records remain in our books for
            Nigerian tax compliance (7 years).
          </BulletRow>
          <BulletRow theme={theme} icon="cash-outline">
            Wallet balances are frozen at the time of deletion. Email
            support@gaznger.com to request a refund within 14 days.
          </BulletRow>
        </View>
        <Pressable
          onPress={handleDelete}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Delete my account"
          style={({ pressed }) => [
            styles.deleteBtn,
            (pressed || busy) && { opacity: 0.8 },
          ]}
        >
          <Text style={styles.deleteBtnText}>
            {busy ? "Deleting…" : "Delete my account"}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.back()}
          disabled={busy}
          style={({ pressed }) => [
            styles.cancelBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.cancelBtnText}>Keep my account</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

function BulletRow({
  theme,
  icon,
  children,
}: {
  theme: Theme;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  const styles = makeStyles(theme);
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletIcon}>
        <Ionicons name={icon} size={16} color={theme.fgMuted} />
      </View>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    scroll: {
      paddingHorizontal: theme.space.s4,
      paddingBottom: theme.space.s6,
      gap: theme.space.s3,
    },
    heroIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.errorTint,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
      marginTop: theme.space.s4,
      marginBottom: theme.space.s2,
    },
    title: {
      ...theme.type.h2,
      color: theme.fg,
      textAlign: "center",
    },
    body: {
      ...theme.type.body,
      color: theme.fgMuted,
      textAlign: "center",
      marginBottom: theme.space.s2,
    },
    bullets: {
      gap: theme.space.s3,
      marginTop: theme.space.s2,
      marginBottom: theme.space.s4,
    },
    bulletRow: {
      flexDirection: "row",
      gap: theme.space.s2,
      alignItems: "flex-start",
    },
    bulletIcon: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.bgMuted,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 1,
    },
    bulletText: {
      flex: 1,
      ...theme.type.bodySm,
      color: theme.fg,
      lineHeight: 20,
    },
    deleteBtn: {
      height: 52,
      borderRadius: 14,
      backgroundColor: theme.error,
      alignItems: "center",
      justifyContent: "center",
      marginTop: theme.space.s4,
    },
    deleteBtnText: {
      ...theme.type.bodyLg,
      fontWeight: "800",
      color: "#fff",
    },
    cancelBtn: {
      height: 52,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      marginTop: theme.space.s2,
    },
    cancelBtnText: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
    },
  });
