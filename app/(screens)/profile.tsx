import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { toast } from "sonner-native";
import * as ImagePicker from "expo-image-picker";
import { useSessionStore } from "@/store/useSessionStore";
import { Theme, useTheme, formatCurrency } from "@/constants/theme";
import { useWalletStore } from "@/store/useWalletStore";
import { api } from "@/lib/api";
import {
  Row,
  ScreenContainer,
  ScreenHeader,
  Skeleton,
} from "@/components/ui/primitives";

const APP_VERSION = "2.4.1";

/**
 * Profile screen — v3 design.
 *
 * Three hero blocks + two row groups + sign-out:
 *   1. Avatar + name + phone (tap avatar to change profile pic)
 *   2. Points hero (gold) — current balance + earned-this-month + redeem CTA
 *   3. Wallet quick card — current balance + Top up CTA
 *   4. Your account: Saved addresses / Payment methods / Order history / Settings
 *   5. Get help: Help & support / Terms / Privacy
 *   6. Sign out (danger row, no chevron)
 *
 * Routes:
 *   - Order History → /(customer)/(order)/history (per SURFACES_V3_PLAN §2)
 *   - Wallet        → /(customer)/wallet
 *   - Points        → /(screens)/points
 *
 * Reads `lastPaystackAuth` (saved-card existence) and `lpgOrderCount`
 * from the session store; both populated by /auth/me on app boot.
 */
export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = makeStyles(theme);

  const { user, updateUser, logout } = useSessionStore();
  const walletAvailable = useWalletStore((s) => s.available);
  const refreshWallet = useWalletStore((s) => s.refresh);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const initials =
    user?.displayName
      ?.split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "—";

  const points = user?.points ?? 0;
  const phoneDisplay = user?.phone ?? "Add phone number";

  const handleAvatarTap = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("image", { uri, name: "profile.jpg", type: "image/jpeg" } as any);
      const res = await fetch(`${process.env.EXPO_PUBLIC_BASE_URL}/api/upload/image`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${useSessionStore.getState().accessToken}`,
        },
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = (await res.json()) as { url?: string };
      if (!data.url) throw new Error("No URL returned");
      await api.put("/auth/me", { profileImage: data.url });
      updateUser({ profileImage: data.url });
      toast.success("Profile photo updated.");
    } catch (err: any) {
      toast.error("Couldn't update photo", {
        description: err?.message ?? "Try again in a moment.",
      });
    } finally {
      setUploadingAvatar(false);
    }
  }, [updateUser]);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await api.post("/auth/logout").catch(() => {});
    } finally {
      logout();
      router.replace("/(auth)/authentication" as never);
    }
  }, [logout, router]);

  return (
    <ScreenContainer
      edges={["top", "bottom"]}
      header={<ScreenHeader title="Profile" onBack={() => router.back()} />}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        onScrollBeginDrag={refreshWallet}
      >
        {/* ── User card ─────────────────────────────────────── */}
        <View style={styles.userCard}>
          <Pressable
            onPress={handleAvatarTap}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            accessibilityHint="Opens your photo library."
            style={({ pressed }) => [pressed && { opacity: 0.85 }]}
          >
            <View style={styles.avatar}>
              {uploadingAvatar ? (
                <Skeleton width={64} height={64} borderRadius={32} />
              ) : (
                <Text style={styles.avatarText}>{initials}</Text>
              )}
              <View style={styles.avatarBadge}>
                <Ionicons name="add" size={11} color={theme.fg} />
              </View>
            </View>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName} numberOfLines={1}>
              {user?.displayName ?? "—"}
            </Text>
            <Text style={styles.userMeta} numberOfLines={1}>
              {phoneDisplay}
            </Text>
          </View>
        </View>

        {/* ── Points hero (gold) ─────────────────────────────── */}
        <Pressable
          onPress={() => router.push("/(screens)/points" as never)}
          accessibilityRole="button"
          accessibilityLabel={`${points.toLocaleString("en-NG")} Gaznger points. Tap to manage.`}
          style={({ pressed }) => [
            styles.pointsHero,
            pressed && { opacity: 0.95 },
          ]}
        >
          <View style={styles.pointsHeader}>
            <Ionicons name="star" size={14} color={theme.palette.gold700} />
            <Text style={styles.pointsEyebrow}>GAZNGER POINTS</Text>
          </View>
          <Text style={styles.pointsNumber}>
            {points.toLocaleString("en-NG")}
          </Text>
          <Text style={styles.pointsSub}>
            {points === 0
              ? "Earn 50 on your first order."
              : `≈ ${formatCurrency(points)} to spend`}
          </Text>
        </Pressable>

        {/* ── Wallet quick card ───────────────────────────────── */}
        <View style={styles.walletCard}>
          <View style={styles.walletHeader}>
            <Ionicons name="wallet" size={14} color={theme.palette.green700} />
            <Text style={styles.walletEyebrow}>WALLET BALANCE</Text>
          </View>
          <View style={styles.walletRow}>
            <Text style={styles.walletAmount}>
              {formatCurrency(walletAvailable)}
            </Text>
            <Pressable
              onPress={() => router.push("/(customer)/wallet" as never)}
              accessibilityRole="button"
              accessibilityLabel="Open wallet"
              style={({ pressed }) => [
                styles.walletCta,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.walletCtaText}>Top up</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Your account ────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>YOUR ACCOUNT</Text>
        <View style={styles.rowGroup}>
          <Row
            icon="location-outline"
            label="Saved addresses"
            onPress={() => router.push("/(screens)/address-book" as never)}
          />
          <Row
            icon="card-outline"
            label="Payment methods"
            sub={
              user?.lastPaystackAuth?.last4
                ? `•••• ${user.lastPaystackAuth.last4}`
                : "No saved cards"
            }
            onPress={() => router.push("/(screens)/payment-method" as never)}
          />
          <Row
            icon="receipt-outline"
            label="Order history"
            onPress={() =>
              router.push("/(customer)/(order)/history" as never)
            }
          />
          <Row
            icon="settings-outline"
            label="Settings"
            divider={false}
            onPress={() => router.push("/(screens)/settings" as never)}
          />
        </View>

        {/* ── Get help ─────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>GET HELP</Text>
        <View style={styles.rowGroup}>
          <Row
            icon="help-circle-outline"
            label="Help & support"
            onPress={() => router.push("/(screens)/help-support" as never)}
          />
          <Row
            icon="shield-outline"
            label="Terms & policies"
            onPress={() => router.push("/(legal)/terms" as never)}
          />
          <Row
            icon="lock-closed-outline"
            label="Privacy"
            divider={false}
            onPress={() => router.push("/(legal)/privacy" as never)}
          />
        </View>

        {/* ── Sign out + version ───────────────────────────────── */}
        <Pressable
          onPress={handleSignOut}
          disabled={signingOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out of Gaznger"
          style={({ pressed }) => [
            styles.signOutRow,
            pressed && { opacity: 0.7 },
            signingOut && { opacity: 0.5 },
          ]}
        >
          <Text style={styles.signOutText}>
            {signingOut ? "Signing out…" : "Sign out"}
          </Text>
        </Pressable>

        <Text style={styles.versionText}>
          Gaznger v{APP_VERSION} · Lagos
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    scroll: {
      paddingBottom: theme.space.s5 + 80, // tab bar clearance
    },
    /* User card */
    userCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s3 + 2,
      paddingHorizontal: theme.space.s4,
      paddingVertical: theme.space.s3,
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.primaryTint,
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    },
    avatarText: {
      ...theme.type.h2,
      color: theme.mode === "dark" ? "#fff" : theme.palette.green700,
      fontWeight: "800",
    },
    avatarBadge: {
      position: "absolute",
      bottom: -2,
      right: -2,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: theme.surface,
      borderWidth: 2,
      borderColor: theme.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    userName: {
      ...theme.type.bodyLg,
      color: theme.fg,
      fontWeight: "800",
      letterSpacing: -0.2,
    },
    userMeta: {
      ...theme.type.caption,
      color: theme.fgMuted,
      marginTop: 2,
    },

    /* Points hero — gold */
    pointsHero: {
      marginHorizontal: theme.space.s4,
      marginBottom: theme.space.s3,
      padding: theme.space.s4,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.accentTint,
      borderWidth: 1,
      borderColor:
        theme.mode === "dark" ? theme.palette.gold700 : theme.palette.gold100,
      gap: 4,
    },
    pointsHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    pointsEyebrow: {
      ...theme.type.micro,
      color:
        theme.mode === "dark" ? theme.palette.gold300 : theme.palette.gold700,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    pointsNumber: {
      ...theme.type.display,
      ...theme.type.money,
      color: theme.fg,
      fontWeight: "800",
      letterSpacing: -0.6,
    },
    pointsSub: {
      ...theme.type.caption,
      color:
        theme.mode === "dark" ? theme.palette.gold300 : theme.palette.gold700,
    },

    /* Wallet card — green */
    walletCard: {
      marginHorizontal: theme.space.s4,
      marginBottom: theme.space.s4,
      padding: theme.space.s4,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.primaryTint,
      borderWidth: 1,
      borderColor:
        theme.mode === "dark" ? theme.palette.neutral800 : theme.palette.green100,
      gap: theme.space.s2,
    },
    walletHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    walletEyebrow: {
      ...theme.type.micro,
      color: theme.mode === "dark" ? "#fff" : theme.palette.green700,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    walletRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
    },
    walletAmount: {
      ...theme.type.display,
      ...theme.type.money,
      color: theme.fg,
      fontWeight: "800",
      letterSpacing: -0.6,
    },
    walletCta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      height: 38,
      paddingHorizontal: 18,
      borderRadius: theme.radius.md,
      backgroundColor:
        theme.mode === "dark" ? theme.palette.neutral0 : theme.palette.green700,
    },
    walletCtaText: {
      ...theme.type.bodySm,
      color:
        theme.mode === "dark" ? theme.palette.green700 : theme.palette.neutral0,
      fontWeight: "800",
    },

    /* Section label */
    sectionLabel: {
      ...theme.type.micro,
      color: theme.fgMuted,
      letterSpacing: 0.5,
      paddingHorizontal: theme.space.s4,
      paddingTop: theme.space.s4,
      paddingBottom: theme.space.s2,
    },

    /* Row group */
    rowGroup: {
      backgroundColor: theme.surface,
      marginHorizontal: theme.space.s4,
      borderRadius: theme.radius.md + 2, // 14 per design
      borderWidth: 1,
      borderColor: theme.divider,
      overflow: "hidden",
    },

    /* Sign out + version */
    signOutRow: {
      paddingVertical: theme.space.s4,
      paddingHorizontal: theme.space.s4,
      marginTop: theme.space.s4,
      alignItems: "center",
    },
    signOutText: {
      ...theme.type.body,
      color: theme.error,
      fontWeight: "700",
    },
    versionText: {
      ...theme.type.micro,
      color: theme.fgMuted,
      textAlign: "center",
      paddingHorizontal: theme.space.s4,
      paddingTop: theme.space.s5,
      paddingBottom: theme.space.s2,
    },
  });
