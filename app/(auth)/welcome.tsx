import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toast } from "sonner-native";
import { Theme, useTheme } from "@/constants/theme";
import WelcomeTrioIllo from "@/components/ui/auth/WelcomeTrioIllo";
import { Button } from "@/components/ui/primitives";
import {
  clearBioCredential,
  getBioCredential,
  getDeviceLabel,
  getOrCreateDeviceId,
  hasBioCredential,
  markBioCredentialPresent,
  preparePinForTransmission,
  setBiometricEnabled,
} from "@/lib/auth";
import {
  biometricLabel,
  checkBiometricAvailability,
  type BiometricType,
} from "@/lib/permissions";
import { api } from "@/lib/api";
import { useSessionStore, type SessionUser } from "@/store/useSessionStore";

interface LoginResponse {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
}

/**
 * Welcome gate — the auth fork. Two CTAs (Create / Login) plus the
 * Terms + Privacy footnote. Both CTAs route into the phone trunk;
 * the only difference is the `mode` param the next screen reads to
 * adjust copy ("What's your number?" vs "Welcome back").
 */
export default function WelcomeGate() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const sessionLogin = useSessionStore((s) => s.login);

  // Bio sign-in surface — only renders when this device has a stashed
  // credential (user enabled biometric in Settings during a prior
  // session AND hasn't signed out / forgotten the device since).
  const [bioReady, setBioReady] = useState(false);
  const [bioType, setBioType] = useState<BiometricType>("none");
  const [bioBusy, setBioBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [hasCred, avail] = await Promise.all([
        hasBioCredential(),
        checkBiometricAvailability(),
      ]);
      if (!alive) return;
      // Both must be true: a credential AND the device still has
      // biometric enrolled. If hardware/enrolment changed since the
      // credential was set, hide the button — the user will sign in
      // via phone+OTP and re-enable from Settings.
      setBioReady(hasCred && avail.available);
      setBioType(avail.type);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const goAfterLogin = useCallback(
    (user: SessionUser) => {
      const role = user.role;
      if (role === "rider") {
        router.replace(
          user.verificationStatus === "approved"
            ? ("/(rider)/(queue)" as never)
            : ("/(auth)/verification/pending?role=rider" as never)
        );
        return;
      }
      if (role === "vendor") {
        router.replace(
          user.verificationStatus === "approved"
            ? ("/(vendor)/(today)" as never)
            : ("/(auth)/verification/pending?role=vendor" as never)
        );
        return;
      }
      router.replace("/(customer)/(home)" as never);
    },
    [router]
  );

  const goBioLogin = useCallback(async () => {
    if (bioBusy) return;
    setBioBusy(true);
    try {
      // Read the stashed credential — this triggers the OS biometric
      // prompt as a side-effect of the SecureStore read.
      const cred = await getBioCredential(
        `Sign in to Gaznger with ${biometricLabel(bioType)}`
      );
      if (!cred) {
        // User cancelled the OS prompt OR failed → silent. They can
        // tap again or fall back to phone+OTP.
        return;
      }
      // Mint a fresh session via /auth/login (same path the PIN
      // unlock screen takes). The verificationToken is omitted —
      // server treats this as a known device because we send the
      // stashed deviceId. If the device is unknown server-side
      // (e.g. user wiped knownDevices on another phone), the call
      // returns 401 "OTP verification required" and we fall back to
      // the phone+OTP flow.
      const deviceId = await getOrCreateDeviceId();
      const prepared = await preparePinForTransmission(cred.pin);
      const res = await api.post<LoginResponse>(
        "/auth/login",
        { phone: cred.phone, pin: prepared },
        {
          headers: {
            "X-Device-Id": deviceId,
            "X-Device-Label": getDeviceLabel(),
          },
        }
      );
      sessionLogin(res);
      goAfterLogin(res.user);
    } catch (err: any) {
      const msg = err?.message ?? "Couldn't sign in";
      // If the credential is no longer accepted (e.g. PIN changed
      // server-side, or device unknown), wipe it so the next
      // welcome render hides the button and steers the user to
      // phone+OTP.
      if (
        msg.toLowerCase().includes("verification required") ||
        msg.toLowerCase().includes("wrong pin") ||
        msg.toLowerCase().includes("incorrect")
      ) {
        await clearBioCredential().catch(() => {});
        await markBioCredentialPresent(false).catch(() => {});
        await setBiometricEnabled(false).catch(() => {});
        setBioReady(false);
        toast.error("Biometric sign-in not accepted", {
          description: "Sign in with phone + OTP and re-enable from Settings.",
        });
      } else {
        toast.error(msg);
      }
    } finally {
      setBioBusy(false);
    }
  }, [bioBusy, bioType, sessionLogin, goAfterLogin]);

  const goSignup = () =>
    router.push({ pathname: "/(auth)/phone" as never, params: { mode: "signup" } });
  const goLogin = () =>
    router.push({ pathname: "/(auth)/phone" as never, params: { mode: "login" } });
  const goTerms = () => router.push("/(legal)/terms" as never);
  const goPrivacy = () => router.push("/(legal)/privacy" as never);

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: theme.bg, paddingTop: insets.top + theme.space.s5 },
      ]}
    >
      <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />

      <View style={styles.brand}>
        <Image
          source={require("@/assets/images/gaznger-logo.png")}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="Gaznger"
        />
        <Text style={styles.tagline}>Fuel without the queue.</Text>
      </View>

      <View style={styles.illoWrap}>
        <WelcomeTrioIllo />
      </View>

      <View
        style={[
          styles.ctaWrap,
          { paddingBottom: insets.bottom + theme.space.s4 },
        ]}
      >
        {/* Bio sign-in: only renders when this device has a stored
            credential AND biometric is still enrolled. Tapping
            triggers the OS prompt, then mints a fresh session via
            /auth/login. Falls back to the regular CTAs if the
            credential is rejected (PIN changed, device wiped, etc). */}
        {bioReady ? (
          <Pressable
            onPress={goBioLogin}
            disabled={bioBusy}
            accessibilityRole="button"
            accessibilityLabel={`Sign in with ${biometricLabel(bioType)}`}
            style={({ pressed }) => [
              styles.bioButton,
              (pressed || bioBusy) && { opacity: 0.85 },
            ]}
          >
            <Ionicons
              name="finger-print"
              size={22}
              color={theme.fgOnPrimary}
            />
            <Text style={styles.bioButtonText}>
              Sign in with {biometricLabel(bioType)}
            </Text>
          </Pressable>
        ) : null}

        <Button
          variant="primary"
          size="lg"
          full
          onPress={goSignup}
          accessibilityLabel="Create account"
        >
          Create account
        </Button>
        <Button
          variant="outline"
          size="lg"
          full
          onPress={goLogin}
          accessibilityLabel="I already have an account"
        >
          I already have an account
        </Button>
        <View style={styles.legalRow}>
          <Text style={styles.legalText}>By continuing, you agree to our </Text>
          <Pressable
            onPress={goTerms}
            accessibilityRole="link"
            accessibilityLabel="Terms"
            hitSlop={8}
          >
            <Text style={styles.legalLink}>Terms</Text>
          </Pressable>
          <Text style={styles.legalText}> and </Text>
          <Pressable
            onPress={goPrivacy}
            accessibilityRole="link"
            accessibilityLabel="Privacy Policy"
            hitSlop={8}
          >
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </Pressable>
          <Text style={styles.legalText}>.</Text>
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
    brand: {
      alignItems: "center",
      gap: theme.space.s3,
      marginTop: theme.space.s4,
    },
    logo: {
      width: 180,
      height: 70,
    },
    tagline: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      fontWeight: "600",
      marginTop: 2,
    },
    illoWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      marginVertical: theme.space.s5,
    },
    ctaWrap: {
      gap: theme.space.s3,
    },
    /** Bio sign-in CTA. Sits above the regular Create / Login buttons
     *  when a stored credential exists. Same primary green as the
     *  primary Button so it reads as the recommended action, with a
     *  fingerprint glyph that matches the OS biometric prompt copy. */
    bioButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      height: 52,
      borderRadius: theme.radius.md,
      backgroundColor: theme.primary,
      ...theme.elevation.card,
    },
    bioButtonText: {
      ...theme.type.bodyLg,
      fontWeight: "800",
      color: theme.fgOnPrimary,
    },
    legalRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: theme.space.s2,
      marginTop: theme.space.s2,
    },
    legalText: {
      fontSize: 11.5,
      color: theme.fgMuted,
      lineHeight: 18,
    },
    legalLink: {
      fontSize: 11.5,
      color: theme.primary,
      fontWeight: "700",
      lineHeight: 18,
    },
  });
