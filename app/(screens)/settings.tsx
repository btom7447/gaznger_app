import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { toast } from "sonner-native";
import { Theme, useTheme } from "@/constants/theme";
import { useThemeStore, ColorSchemeOverride } from "@/store/useThemeStore";
import { useSessionStore } from "@/store/useSessionStore";
import { api } from "@/lib/api";
import {
  Row,
  ScreenContainer,
  ScreenHeader,
} from "@/components/ui/primitives";

const APP_VERSION = "2.4.1";

type ThemeOption = {
  value: ColorSchemeOverride;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
};

const THEME_OPTIONS: ThemeOption[] = [
  { value: "light", label: "Light", icon: "sunny-outline" },
  { value: "dark", label: "Dark", icon: "moon-outline" },
  { value: "system", label: "System", icon: "phone-portrait-outline" },
];

/**
 * Settings screen — v3.
 *
 * Five row groups + a danger zone:
 *   1. Appearance — Light / Dark / System tri-card (drives useThemeStore)
 *   2. Notifications — push master + price alerts (server-mirrored via
 *      PUT /auth/me preferences; spec at
 *      docs/handoff/_server-asks/auth-me-preferences.md)
 *   3. Account — Edit profile / Phone / Email link rows
 *   4. Support — Help / Contact / Feedback
 *   5. About — Version / Terms / Privacy
 *   6. Danger — Delete account (placeholder; routes a TODO toast for now)
 *
 * Pricing rule honoured: the price-alerts toggle copy is scoped to
 * "nearby stations" market drops, never customer-specific order pricing.
 */
export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const { colorScheme, setColorScheme } = useThemeStore();
  const user = useSessionStore((s) => s.user);
  const updateUser = useSessionStore((s) => s.updateUser);

  // Local-mirror of preferences for instant toggle response. Network
  // call follows; rollback on failure.
  const [pushEnabled, setPushEnabled] = useState<boolean>(
    user?.preferences?.pushEnabled ?? true
  );
  const [priceAlertsEnabled, setPriceAlertsEnabled] = useState<boolean>(
    user?.preferences?.priceAlertsEnabled ?? false
  );
  const [autoRedeemPoints, setAutoRedeemPoints] = useState<boolean>(
    user?.preferences?.autoRedeemPoints ?? false
  );

  /**
   * Generic preference toggle wiring. Optimistically updates the
   * local mirror + the session store, then PATCHes the server. On
   * failure, reverts the local state and surfaces a non-blocking toast.
   */
  const togglePreference = useCallback(
    async (
      key: "pushEnabled" | "priceAlertsEnabled" | "autoRedeemPoints",
      next: boolean,
      setter: (v: boolean) => void
    ) => {
      const previous = !next;
      setter(next);
      updateUser({
        preferences: { ...user?.preferences, [key]: next },
      });
      try {
        await api.put("/auth/me", { preferences: { [key]: next } });
      } catch (err: any) {
        // Rollback both the local mirror and the persisted store.
        setter(previous);
        updateUser({
          preferences: { ...user?.preferences, [key]: previous },
        });
        toast.error("Couldn't save", {
          description: err?.message ?? "Try again in a moment.",
        });
      }
    },
    [user?.preferences, updateUser]
  );

  return (
    <ScreenContainer
      edges={["top", "bottom"]}
      header={<ScreenHeader title="Settings" onBack={() => router.back()} />}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* ── Appearance ─────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>APPEARANCE</Text>
        <View style={styles.themeRow}>
          {THEME_OPTIONS.map((opt) => {
            const selected = colorScheme === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setColorScheme(opt.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${opt.label} theme`}
                style={({ pressed }) => [
                  styles.themeCard,
                  selected && styles.themeCardSelected,
                  pressed && { opacity: 0.92 },
                ]}
              >
                <Ionicons
                  name={opt.icon}
                  size={22}
                  color={
                    selected
                      ? theme.mode === "dark"
                        ? "#fff"
                        : theme.palette.green700
                      : theme.fg
                  }
                />
                <Text
                  style={[
                    styles.themeLabel,
                    selected && styles.themeLabelSelected,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ── Notifications ──────────────────────────────────── */}
        <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
        <View style={styles.rowGroup}>
          <Row
            icon="notifications-outline"
            label="Push notifications"
            sub="Order updates, rider alerts, delivery confirmations"
            kind="switch"
            switchValue={pushEnabled}
            onSwitchChange={(next) =>
              togglePreference("pushEnabled", next, setPushEnabled)
            }
          />
          <Row
            icon="pricetag-outline"
            label="Price alerts"
            sub="When nearby stations drop their price"
            kind="switch"
            switchValue={priceAlertsEnabled}
            onSwitchChange={(next) =>
              togglePreference(
                "priceAlertsEnabled",
                next,
                setPriceAlertsEnabled
              )
            }
            divider={false}
          />
        </View>

        {/* ── Points ─────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>POINTS</Text>
        <View style={styles.rowGroup}>
          <Row
            icon="star-outline"
            label="Auto-redeem at checkout"
            sub="Apply your points balance to every payment"
            kind="switch"
            switchValue={autoRedeemPoints}
            onSwitchChange={(next) =>
              togglePreference(
                "autoRedeemPoints",
                next,
                setAutoRedeemPoints
              )
            }
            divider={false}
          />
        </View>

        {/* ── Account ────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.rowGroup}>
          <Row
            icon="person-outline"
            label="Edit profile"
            sub="Name, photo"
            onPress={() => router.push("/(screens)/personal-info" as never)}
          />
          <Row
            icon="call-outline"
            label="Phone number"
            meta={user?.phone ?? "Add"}
            onPress={() => router.push("/(screens)/personal-info" as never)}
          />
          <Row
            icon="mail-outline"
            label="Email"
            meta={user?.email}
            divider={false}
            onPress={() => router.push("/(screens)/personal-info" as never)}
          />
        </View>

        {/* ── Support ────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>SUPPORT</Text>
        <View style={styles.rowGroup}>
          <Row
            icon="help-circle-outline"
            label="Help center"
            onPress={() => router.push("/(screens)/help-support" as never)}
          />
          <Row
            icon="chatbubble-outline"
            label="Contact support"
            divider={false}
            onPress={() => router.push("/(screens)/help-support" as never)}
          />
        </View>

        {/* ── About ──────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>ABOUT</Text>
        <View style={styles.rowGroup}>
          <Row
            icon="cube-outline"
            label="App version"
            meta={APP_VERSION}
            kind="none"
          />
          <Row
            icon="receipt-outline"
            label="Terms of service"
            onPress={() => router.push("/(legal)/terms" as never)}
          />
          <Row
            icon="lock-closed-outline"
            label="Privacy policy"
            divider={false}
            onPress={() => router.push("/(legal)/privacy" as never)}
          />
        </View>

        {/* ── Danger ─────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>DANGER ZONE</Text>
        <View style={styles.dangerWrap}>
          <Pressable
            onPress={() => {
              // TODO: replace with confirm sheet → POST /auth/delete-account
              toast.info("Account deletion not yet enabled", {
                description: "Email support@gaznger.com to request deletion.",
              });
            }}
            accessibilityRole="button"
            accessibilityLabel="Delete my account"
            style={({ pressed }) => [
              styles.dangerCard,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons name="close-circle-outline" size={18} color={theme.error} />
            <Text style={styles.dangerLabel}>Delete my account</Text>
          </Pressable>
          <Text style={styles.dangerNote}>
            We hold order records for 7 years (Nigerian tax law). Personal
            info is wiped immediately.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    scroll: {
      paddingBottom: theme.space.s5 + 16,
    },
    sectionLabel: {
      ...theme.type.micro,
      color: theme.fgMuted,
      letterSpacing: 0.5,
      paddingHorizontal: theme.space.s4,
      paddingTop: theme.space.s4,
      paddingBottom: theme.space.s2,
    },
    rowGroup: {
      backgroundColor: theme.surface,
      marginHorizontal: theme.space.s4,
      borderRadius: theme.radius.md + 2, // 14 per design
      borderWidth: 1,
      borderColor: theme.divider,
      overflow: "hidden",
    },

    /* Theme tri-toggle */
    themeRow: {
      flexDirection: "row",
      gap: theme.space.s2,
      paddingHorizontal: theme.space.s4,
    },
    themeCard: {
      flex: 1,
      paddingVertical: theme.space.s3,
      paddingHorizontal: theme.space.s2,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: "center",
      gap: 4,
    },
    themeCardSelected: {
      backgroundColor: theme.primaryTint,
      borderColor: theme.primary,
    },
    themeLabel: {
      ...theme.type.caption,
      color: theme.fg,
      fontWeight: "800",
    },
    themeLabelSelected: {
      color: theme.mode === "dark" ? "#fff" : theme.palette.green700,
    },

    /* Danger zone */
    dangerWrap: {
      marginHorizontal: theme.space.s4,
      marginBottom: theme.space.s5,
    },
    dangerCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.s2,
      height: 50,
      borderRadius: theme.radius.md + 2,
      backgroundColor: theme.errorTint,
      borderWidth: 1,
      borderColor:
        theme.mode === "dark"
          ? "rgba(209,69,59,0.20)"
          : theme.palette.error100,
    },
    dangerLabel: {
      ...theme.type.body,
      color: theme.error,
      fontWeight: "800",
    },
    dangerNote: {
      ...theme.type.caption,
      color: theme.fgMuted,
      textAlign: "center",
      marginTop: theme.space.s2,
      lineHeight: 17,
    },
  });
