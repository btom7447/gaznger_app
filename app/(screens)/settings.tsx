import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { toast } from "sonner-native";
import Constants from "expo-constants";
import { Theme, useTheme } from "@/constants/theme";
import { useThemeStore, ColorSchemeOverride } from "@/store/useThemeStore";
import { useSessionStore } from "@/store/useSessionStore";
import { api } from "@/lib/api";
import {
  Row,
  ScreenContainer,
  ScreenHeader,
} from "@/components/ui/primitives";
import {
  clearBioCredential,
  getBiometricEnabled,
  markBioCredentialPresent,
  setBioCredential,
  setBiometricEnabled,
} from "@/lib/auth";
import {
  authenticateBiometric,
  checkBiometricAvailability,
  biometricLabel,
  type BiometricType,
} from "@/lib/permissions";
import { requireStepUpPin } from "@/components/ui/auth";

const APP_VERSION =
  (Constants.expoConfig?.version as string | undefined) ?? "2.0.0";
// expo-constants exposes the build via either `runtimeVersion` (EAS) or
// `ios.buildNumber` / `android.versionCode`. We pick the first present.
const BUILD =
  (Constants.expoConfig as any)?.runtimeVersion ??
  (Constants.expoConfig as any)?.ios?.buildNumber ??
  (Constants.expoConfig as any)?.android?.versionCode ??
  null;

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
 * Settings — v3.
 *
 * Sections:
 *   1. Appearance     — Light / Dark / System tri-card.
 *   2. Notifications  — All notifications (master) / Order updates /
 *                       Promotions / Price alerts. Server-mirrored via
 *                       PUT /auth/me preferences.
 *   3. Account        — Edit profile / Phone / Email / Saved cylinder.
 *   4. Security       — Change PIN / Biometric unlock / Active sessions.
 *   5. Support        — Help center / Contact support / Send feedback.
 *   6. About          — App version+build / Terms / Privacy / OSS.
 *   7. Danger zone    — Delete my account.
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

  // Local mirror per toggle so UI flips instantly while the network
  // call rides shotgun. Rollback on failure restores both layers.
  const [pushEnabled, setPushEnabled] = useState<boolean>(
    user?.preferences?.pushEnabled ?? true
  );
  const [orderUpdates, setOrderUpdates] = useState<boolean>(
    user?.preferences?.orderUpdates ?? true
  );
  const [promotions, setPromotions] = useState<boolean>(
    user?.preferences?.promotions ?? false
  );
  const [priceAlertsEnabled, setPriceAlertsEnabled] = useState<boolean>(
    user?.preferences?.priceAlertsEnabled ?? false
  );
  const [autoRedeemPoints, setAutoRedeemPoints] = useState<boolean>(
    user?.preferences?.autoRedeemPoints ?? false
  );
  // Biometric unlock toggle. SecureStore-persisted opt-in (per install,
  // not per server account — re-installs require a fresh opt-in, the
  // correct security default). On enable we do an OS prompt to confirm
  // the user can actually pass biometric on this device; on disable we
  // just flip the flag. PIN remains the universal fallback so toggling
  // off doesn't strand anyone.
  const [biometricUnlock, setBiometricUnlock] = useState<boolean>(false);
  const [bioAvailable, setBioAvailable] = useState<boolean>(false);
  const [bioType, setBioType] = useState<BiometricType>("none");

  // Hydrate the toggle's initial state + hardware availability on mount.
  // We hide the row entirely when no biometric hardware is enrolled —
  // showing a disabled switch is uglier than just omitting the option.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [enabled, avail] = await Promise.all([
        getBiometricEnabled(),
        checkBiometricAvailability(),
      ]);
      if (!alive) return;
      setBiometricUnlock(enabled);
      setBioAvailable(avail.available);
      setBioType(avail.type);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const togglePreference = useCallback(
    async (
      key:
        | "pushEnabled"
        | "orderUpdates"
        | "promotions"
        | "priceAlertsEnabled"
        | "autoRedeemPoints",
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

  const handleBiometricToggle = useCallback(
    async (next: boolean) => {
      if (next && !user?.hasPin) {
        toast.info("Set a PIN first", {
          description:
            "Biometric unlock falls back to your PIN — set one to enable.",
        });
        return;
      }
      if (next && !bioAvailable) {
        toast.error("No biometric available", {
          description:
            "Set up Face ID or fingerprint on your device, then come back.",
        });
        return;
      }

      if (next) {
        // ENABLE flow:
        //   1. Capture PIN via the step-up sheet (validated against
        //      /auth/pin/verify, so a wrong PIN can't enable bio).
        //   2. Confirm device biometric works (otherwise we'd store
        //      a credential the user can't actually unlock).
        //   3. Stash {phone, pin} in SecureStore behind biometric.
        //   4. Flip the bioEnabled flag.
        if (!user?.phone) {
          toast.error("Phone number missing — re-sign-in to enable.");
          return;
        }
        const pinResult = await requireStepUpPin({
          reason:
            "Enter your PIN to enable biometric sign-in on this device",
        });
        if (!pinResult.ok || !pinResult.pin) {
          // User cancelled or got the PIN wrong; sheet already showed
          // the error inline. Toast is just to confirm the toggle
          // didn't flip.
          toast.info("Biometric sign-in not enabled");
          return;
        }
        const bioOk = await authenticateBiometric(
          `Confirm ${biometricLabel(bioType)} to enable`
        );
        if (!bioOk) {
          toast.info("Biometric sign-in not enabled", {
            description: "Cancelled before confirming.",
          });
          return;
        }
        // Persist credential. Order matters: write the protected
        // blob first, then mark the sentinel — if the protected
        // write fails, the sentinel never claims a credential
        // exists.
        try {
          await setBioCredential({ phone: user.phone, pin: pinResult.pin });
          await markBioCredentialPresent(true);
          await setBiometricEnabled(true);
        } catch (err: any) {
          // Roll back partial state.
          await clearBioCredential().catch(() => {});
          await setBiometricEnabled(false).catch(() => {});
          toast.error("Couldn't enable biometric sign-in", {
            description: err?.message ?? "Try again in a moment.",
          });
          return;
        }
        setBiometricUnlock(true);
        toast.success("Biometric sign-in on", {
          description: `Use ${biometricLabel(bioType)} on the welcome screen.`,
        });
        return;
      }

      // DISABLE flow — wipe credential + flag together.
      const previous = biometricUnlock;
      setBiometricUnlock(false);
      try {
        await clearBioCredential();
        await markBioCredentialPresent(false);
        await setBiometricEnabled(false);
        toast.success("Biometric sign-in off", {
          description: "You'll sign in with phone + PIN.",
        });
      } catch (err: any) {
        setBiometricUnlock(previous);
        toast.error("Couldn't disable", {
          description: err?.message ?? "Try again in a moment.",
        });
      }
    },
    [user?.hasPin, user?.phone, bioAvailable, bioType, biometricUnlock]
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
        {/* ── Appearance ───────────────────────────────────────── */}
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

        {/* ── Notifications ────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
        <View style={styles.rowGroup}>
          <Row
            icon="notifications-outline"
            label="All notifications"
            sub="Master switch"
            kind="switch"
            switchValue={pushEnabled}
            onSwitchChange={(next) =>
              togglePreference("pushEnabled", next, setPushEnabled)
            }
          />
          <Row
            icon="receipt-outline"
            label="Order updates"
            sub="Rider, status, delivery"
            kind="switch"
            switchValue={orderUpdates && pushEnabled}
            disabled={!pushEnabled}
            onSwitchChange={(next) =>
              togglePreference("orderUpdates", next, setOrderUpdates)
            }
          />
          <Row
            icon="pricetag-outline"
            label="Promotions"
            sub="Referral bonuses, perks"
            kind="switch"
            switchValue={promotions && pushEnabled}
            disabled={!pushEnabled}
            onSwitchChange={(next) =>
              togglePreference("promotions", next, setPromotions)
            }
          />
          <Row
            icon="cash-outline"
            label="Price alerts"
            sub="When nearby stations drop their price"
            kind="switch"
            switchValue={priceAlertsEnabled && pushEnabled}
            disabled={!pushEnabled}
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

        {/* ── Points ────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>POINTS</Text>
        <View style={styles.rowGroup}>
          <Row
            icon="star-outline"
            label="Auto-redeem at checkout"
            sub="Apply your points balance to every payment"
            kind="switch"
            switchValue={autoRedeemPoints}
            onSwitchChange={(next) =>
              togglePreference("autoRedeemPoints", next, setAutoRedeemPoints)
            }
            divider={false}
          />
        </View>

        {/* ── Account ──────────────────────────────────────────── */}
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
            onPress={() => router.push("/(screens)/personal-info" as never)}
          />
          <Row
            icon="cube-outline"
            label="Saved cylinder"
            sub="LPG · cylinder profile"
            badge={user?.savedCylinder?.brand ? 1 : 0}
            divider={false}
            onPress={() => router.push("/(screens)/saved-cylinder" as never)}
          />
        </View>

        {/* ── Security ─────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>SECURITY</Text>
        <View style={styles.rowGroup}>
          <Row
            icon="lock-closed-outline"
            label={user?.hasPin ? "Change PIN" : "Set a PIN"}
            sub={
              user?.hasPin
                ? "Update your 4-digit PIN"
                : "Add a 4-digit PIN for sensitive actions"
            }
            onPress={() => router.push("/(screens)/change-pin" as never)}
          />
          {bioAvailable ? (
            <Row
              icon={bioType === "face" ? "scan-outline" : "finger-print-outline"}
              label={`${biometricLabel(bioType)} unlock`}
              sub={
                user?.hasPin
                  ? `Use ${biometricLabel(bioType)} on launch instead of your PIN`
                  : "Set a PIN first to enable biometrics"
              }
              kind="switch"
              switchValue={biometricUnlock}
              onSwitchChange={handleBiometricToggle}
              disabled={!user?.hasPin}
            />
          ) : null}
          <Row
            icon="time-outline"
            label="Active sessions"
            sub="Devices signed in to your account"
            divider={false}
            onPress={() => router.push("/(screens)/active-sessions" as never)}
          />
        </View>

        {/* ── Support ──────────────────────────────────────────── */}
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
            onPress={() => router.push("/(screens)/contact-support" as never)}
          />
          <Row
            icon="star-outline"
            label="Send feedback"
            divider={false}
            onPress={() => router.push("/(screens)/contact-support" as never)}
          />
        </View>

        {/* ── About ────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>ABOUT</Text>
        <View style={styles.rowGroup}>
          <Row
            icon="cube-outline"
            label="App version"
            meta={BUILD ? `${APP_VERSION} (${BUILD})` : APP_VERSION}
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
            onPress={() => router.push("/(legal)/privacy" as never)}
          />
          <Row
            icon="document-text-outline"
            label="Open-source licenses"
            divider={false}
            onPress={() => router.push("/(legal)/oss" as never)}
          />
        </View>

        {/* ── Danger zone ─────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>DANGER ZONE</Text>
        <View style={styles.dangerWrap}>
          <Pressable
            onPress={() => router.push("/(screens)/delete-account" as never)}
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
            info is wiped immediately; full deletion is finalised after 30 days.
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
      borderRadius: theme.radius.md + 2,
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
