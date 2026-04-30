import React, { useCallback, useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { toast } from "sonner-native";
import Constants from "expo-constants";
import { useSessionStore } from "@/store/useSessionStore";
import { Theme, useTheme, formatCurrency } from "@/constants/theme";
import { useWalletStore } from "@/store/useWalletStore";
import { api } from "@/lib/api";
import { pickAndUploadProfileImage } from "@/lib/uploadProfileImage";
import {
  Row,
  ScreenContainer,
  ScreenHeader,
  Skeleton,
} from "@/components/ui/primitives";
import CountUpNumber from "@/components/ui/global/CountUpNumber";

/**
 * Profile screen — v3.
 *
 * Layout:
 *   1. Avatar + name + phone (tap avatar to change profile pic)
 *   2. Points hero (gold, watermark circle, taller than v3.0) — current
 *      balance + sub + "Redeem at next order" CTA inside.
 *   3. Wallet quick card — current balance + Top up CTA. Both balances
 *      animate via CountUpNumber on focus + balance change.
 *   4. Your account: addresses + payment methods + order history (each
 *      with a count badge) + Settings.
 *   5. Get help: Help & support, Terms, Privacy.
 *   6. Sign out + real app version (no hardcoded "Lagos").
 */
const APP_VERSION =
  (Constants.expoConfig?.version as string | undefined) ?? "2.0.0";

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = makeStyles(theme);

  const { user, updateUser, logout } = useSessionStore();
  const walletAvailable = useWalletStore((s) => s.available);
  const refreshWallet = useWalletStore((s) => s.refresh);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [orderCount, setOrderCount] = useState<number | null>(null);

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
  const addressCount = user?.addressBook?.length ?? 0;
  const paymentCount = user?.lastPaystackAuth?.last4 ? 1 : 0;

  // Lazy fetch the order count on focus. We use limit=1 so the response
  // stays small; only `total` matters here.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      api
        .get<{ total?: number }>("/api/orders?limit=1&page=1")
        .then((res) => {
          if (!cancelled) setOrderCount(res.total ?? 0);
        })
        .catch(() => {
          // Non-fatal — badge just stays hidden.
        });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const handleAvatarTap = useCallback(async () => {
    setUploadingAvatar(true);
    try {
      const url = await pickAndUploadProfileImage();
      if (!url) return; // user cancelled
      await api.put("/auth/me", { profileImage: url });
      updateUser({ profileImage: url });
      toast.success("Profile photo updated");
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
      // Pass refresh token so the server can drop the session row.
      const refreshToken = useSessionStore.getState().refreshToken;
      await api
        .post("/auth/logout", refreshToken ? { refreshToken } : {})
        .catch(() => {});
    } finally {
      logout();
      router.replace("/(auth)/authentication" as never);
    }
  }, [logout, router]);

  const handleRedeemAtNext = useCallback(() => {
    // Routes into Points hub where the auto-redeem toggle lives. From
    // there the user can flip auto-redeem on or just earmark the next
    // order via the manual PointsRedeem on Payment.
    router.push("/(screens)/points" as never);
  }, [router]);

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
              ) : user?.profileImage ? (
                <Image
                  source={{ uri: user.profileImage }}
                  style={styles.avatarImg}
                  accessibilityLabel="Profile photo"
                />
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
        <View style={styles.pointsHero}>
          {/* Watermark circle (top-right) — design accent. */}
          <View style={styles.pointsWatermark} pointerEvents="none" />

          <View style={styles.pointsHeader}>
            <Ionicons name="star" size={14} color={theme.palette.gold700} />
            <Text style={styles.pointsEyebrow}>GAZNGER POINTS</Text>
          </View>
          <CountUpNumber
            value={points}
            format={(n) => n.toLocaleString("en-NG")}
            style={styles.pointsNumber}
            accessibilityLabel={`${points} Gaznger points`}
          />
          <Text style={styles.pointsSub}>
            {points === 0
              ? "Earn 50 on your first order."
              : `≈ ${formatCurrency(points)} to spend`}
          </Text>
          <Pressable
            onPress={handleRedeemAtNext}
            accessibilityRole="button"
            accessibilityLabel={
              points === 0
                ? "Learn how points work"
                : "Redeem points on next order"
            }
            style={({ pressed }) => [
              styles.pointsCta,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Ionicons
              name={points === 0 ? "help-circle-outline" : "checkmark"}
              size={14}
              color={theme.mode === "dark" ? theme.palette.neutral900 : "#fff"}
            />
            <Text style={styles.pointsCtaText}>
              {points === 0 ? "How points work" : "Redeem at next order"}
            </Text>
          </Pressable>
        </View>

        {/* ── Wallet quick card ───────────────────────────────── */}
        <View style={styles.walletCard}>
          <View style={styles.walletHeader}>
            <Ionicons name="wallet" size={14} color={theme.palette.green700} />
            <Text style={styles.walletEyebrow}>WALLET BALANCE</Text>
          </View>
          <View style={styles.walletRow}>
            <CountUpNumber
              value={walletAvailable}
              format={(n) => formatCurrency(n)}
              style={styles.walletAmount}
              accessibilityLabel={`${formatCurrency(walletAvailable)} wallet balance`}
            />
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
            badge={addressCount}
            onPress={() => router.push("/(screens)/address-book" as never)}
          />
          <Row
            icon="card-outline"
            label="Payment methods"
            badge={paymentCount}
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
            badge={
              orderCount === null
                ? undefined
                : orderCount === 1
                ? "1 order"
                : `${orderCount} orders`
            }
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

        <Text style={styles.versionText}>Gaznger v{APP_VERSION}</Text>
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
    avatarImg: {
      width: 64,
      height: 64,
      borderRadius: 32,
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

    /* Points hero — gold, taller than v3.0 to fit watermark + CTA */
    pointsHero: {
      marginHorizontal: theme.space.s4,
      marginBottom: theme.space.s3,
      padding: 16,
      paddingBottom: 18,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.accentTint,
      borderWidth: 1,
      borderColor:
        theme.mode === "dark" ? theme.palette.gold700 : theme.palette.gold100,
      gap: 4,
      overflow: "hidden",
      position: "relative",
    },
    pointsWatermark: {
      position: "absolute",
      top: -10,
      right: -10,
      width: 70,
      height: 70,
      borderRadius: 35,
      backgroundColor:
        theme.mode === "dark"
          ? "rgba(245,197,24,0.10)"
          : "rgba(245,197,24,0.30)",
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
      fontSize: 32,
      ...theme.type.money,
      color: theme.fg,
      fontWeight: "800",
      letterSpacing: -0.6,
      marginTop: 2,
    },
    pointsSub: {
      ...theme.type.caption,
      color:
        theme.mode === "dark" ? theme.palette.gold300 : theme.palette.gold700,
      marginBottom: 12,
    },
    pointsCta: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      height: 36,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor:
        theme.mode === "dark" ? "#fff" : theme.palette.neutral900,
    },
    pointsCtaText: {
      fontSize: 12.5,
      fontWeight: "800",
      color: theme.mode === "dark" ? theme.palette.neutral900 : "#fff",
    },

    /* Wallet card — green */
    walletCard: {
      marginHorizontal: theme.space.s4,
      marginBottom: theme.space.s4,
      padding: 16,
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
      fontSize: 32,
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
      borderRadius: theme.radius.md + 2,
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
