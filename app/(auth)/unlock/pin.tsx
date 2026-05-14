import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Theme, useTheme } from "@/constants/theme";
import { AuthScreenContainer } from "@/components/ui/auth";
import { PinDots, PinKeypad } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import {
  authenticateBiometric,
  biometricLabel,
  checkBiometricAvailability,
  type BiometricType,
} from "@/lib/permissions";
import {
  getBiometricEnabled,
  getDeviceLabel,
  getOrCreateDeviceId,
  preparePinForTransmission,
} from "@/lib/auth";
import { useSessionStore, type SessionUser } from "@/store/useSessionStore";
import { usePendingSignupStore } from "@/store/usePendingSignupStore";

const PIN_LENGTH = 4;
const MAX_ATTEMPTS = 5;
const LOCKOUT_S = 30;

interface LoginResponse {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
}

/**
 * PIN unlock — primary login gate for returning users + the fallback
 * path when biometric fails. Routes here either from the bootstrap
 * router (returning user, no biometric or biometric disabled), from
 * the OTP screen on `purpose=login`, or from the biometric screen on
 * "Use PIN instead".
 *
 * 5-fail / 60s lockout client-side: a 6th wrong PIN within the window
 * locks the keypad for 30s with a countdown. Server should also rate-
 * limit (see _server-asks/auth-login.md).
 */
export default function PinUnlockScreen() {
  // TEMP minimal-render diagnostic. If the user sees the red probe banner
  // AND this label, the screen IS mounting — the original render crashes.
  // If the screen still blanks, the crash is in the navigator itself.
  console.log("[unlock/pin] MOUNT");
  return (
    <View style={{ flex: 1, backgroundColor: "#1a1a1a", paddingTop: 120, paddingHorizontal: 20 }}>
      <Text style={{ color: "#fff", fontSize: 24, fontWeight: "700" }}>
        unlock/pin TEMP minimal
      </Text>
      <Text style={{ color: "#999", marginTop: 12 }}>
        If you see this, the screen mounted. The crash is in the original render.
      </Text>
    </View>
  );
}

function PinUnlockScreenOriginal() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const params = useLocalSearchParams<{ phone?: string }>();
  const user = useSessionStore((s) => s.user);
  const login = useSessionStore((s) => s.login);
  const sessionLogout = useSessionStore((s) => s.logout);

  const verificationToken = usePendingSignupStore((s) => s.verificationToken);
  const pendingPhone = usePendingSignupStore((s) => s.phone);
  const resetPending = usePendingSignupStore((s) => s.reset);

  // Resolution order: existing session phone → known-device fast path
  // route param → pending-signup store (login OTP flow). At least one
  // is always present when this screen is reachable.
  const phone = user?.phone ?? params.phone ?? pendingPhone ?? "";
  // First-name is optional — when there's no session yet (login OTP-skip
  // path) we drop the personalisation rather than rendering a dangling
  // "Welcome back, you." which reads odd. The headline below conditions
  // on this being non-null to decide whether to append it.
  const firstName = user?.displayName?.split(/\s+/)[0] ?? null;

  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [attempts, setAttempts] = useState<number[]>([]); // timestamps
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [bioType, setBioType] = useState<BiometricType>("none");

  // Probe biometric for the keypad shortcut + tracking.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const enabled = await getBiometricEnabled();
      if (!enabled) return;
      const { available, type } = await checkBiometricAvailability();
      if (!cancelled && available) setBioType(type);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Lockout countdown.
  const [secondsLeft, setSecondsLeft] = useState(0);
  useEffect(() => {
    if (!lockedUntil) {
      setSecondsLeft(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        setLockedUntil(null);
        setAttempts([]);
        setError(null);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const handleDigit = useCallback(
    (d: string) => {
      if (lockedUntil || verifying) return;
      if (error) setError(null);
      setPin((p) => (p + d).slice(0, PIN_LENGTH));
    },
    [lockedUntil, verifying, error]
  );

  const handleBackspace = useCallback(() => {
    if (lockedUntil || verifying) return;
    if (error) setError(null);
    setPin((p) => p.slice(0, -1));
  }, [lockedUntil, verifying, error]);

  const verify = useCallback(
    async (code: string) => {
      if (verifying || code.length !== PIN_LENGTH) return;
      if (!phone) {
        // Edge case: session has no phone. Force a fresh login.
        sessionLogout();
        router.replace("/(auth)/welcome" as never);
        return;
      }
      setVerifying(true);
      setError(null);
      try {
        const deviceId = await getOrCreateDeviceId();
        const prepared = await preparePinForTransmission(code);
        const res = await api.post<LoginResponse>(
          "/auth/login",
          {
            phone,
            pin: prepared,
            verificationToken: verificationToken ?? undefined,
          },
          {
            headers: {
              "X-Device-Id": deviceId,
              "X-Device-Label": getDeviceLabel(),
            },
          }
        );
        login(res);
        // Recovery / login OTP draft is no longer needed.
        resetPending();

        const role = res.user.role;
        if (role === "rider") {
          if (res.user.verificationStatus === "approved") {
            router.replace("/(rider)/(queue)" as never);
          } else {
            router.replace(
              "/(auth)/verification/pending?role=rider" as never
            );
          }
          return;
        }
        if (role === "vendor") {
          if (res.user.verificationStatus === "approved") {
            router.replace("/(vendor)/(dashboard)" as never);
          } else {
            router.replace(
              "/(auth)/verification/pending?role=vendor" as never
            );
          }
          return;
        }
        router.replace("/(customer)/(home)" as never);
      } catch (err: any) {
        // Server-side lockout (audit A.4) returns 423 with retryAfterSec.
        // Honour it directly so the client clock matches the server's
        // window — without this, a user who hit the server cap would
        // see our local 30s lockout but still be locked out for 15min
        // when they retry.
        const status = err?.status ?? err?.response?.status;
        const retryAfter = err?.retryAfterSec ?? err?.response?.data?.retryAfterSec;
        if (status === 423 && typeof retryAfter === "number") {
          setLockedUntil(Date.now() + retryAfter * 1000);
          setError(`Too many wrong PIN attempts. Try again later.`);
          setPin("");
        } else {
          const next = [...attempts, Date.now()].filter(
            (t) => Date.now() - t < 60_000
          );
          setAttempts(next);
          setPin("");
          if (next.length >= MAX_ATTEMPTS) {
            setLockedUntil(Date.now() + LOCKOUT_S * 1000);
            setError(`Too many attempts. Try again in ${LOCKOUT_S}s.`);
          } else {
            const left = MAX_ATTEMPTS - next.length;
            setError(
              err?.message ??
                `Wrong PIN. ${left} ${left === 1 ? "try" : "tries"} left.`
            );
          }
        }
      } finally {
        setVerifying(false);
      }
    },
    [verifying, phone, verificationToken, attempts, login, resetPending, router, sessionLogout]
  );

  // Auto-fire when 4 digits filled.
  useEffect(() => {
    if (pin.length === PIN_LENGTH && !verifying && !lockedUntil) {
      verify(pin);
    }
  }, [pin, verifying, lockedUntil, verify]);

  const handleBiometricShortcut = useCallback(async () => {
    if (verifying || lockedUntil) return;
    const ok = await authenticateBiometric("Unlock Gaznger");
    if (!ok) return;
    // Biometric is local re-auth — the existing session already has a
    // refresh token. Route to the user's dashboard. If the refresh
    // token has actually expired, the next authenticated call will hit
    // lib/api.ts's 401 handler and surface the session-expired path.
    if (!user) {
      sessionLogout();
      router.replace("/(auth)/welcome" as never);
      return;
    }
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
          ? ("/(vendor)/(dashboard)" as never)
          : ("/(auth)/verification/pending?role=vendor" as never)
      );
      return;
    }
    router.replace("/(customer)/(home)" as never);
  }, [verifying, lockedUntil, user, router, sessionLogout]);

  const handleForgot = useCallback(() => {
    router.push("/(auth)/recovery/phone" as never);
  }, [router]);

  const handleSwitchAccount = useCallback(() => {
    sessionLogout();
    router.replace("/(auth)/welcome" as never);
  }, [router, sessionLogout]);

  return (
    <AuthScreenContainer
      showBack={false}
      showHelp={false}
      scrollable={false}
      contentStyle={styles.content}
    >
      {/* Top zone — hero icon, headline, sub, dots all stacked tight
          and centred. No "Use a different account" floating in the
          top-right corner; that lives in the footer below the keypad
          where it belongs (low-priority destructive flow). */}
      <View style={styles.topZone}>
        <View style={styles.heroBubble}>
          <Ionicons name="lock-closed" size={26} color={theme.primary} />
        </View>
        <Text style={styles.headline}>
          {firstName ? `Welcome back, ${firstName}.` : "Welcome back."}
        </Text>
        <Text style={styles.sub}>Enter your 4-digit PIN to unlock.</Text>

        <View style={styles.dotsWrap}>
          <PinDots filled={pin.length} length={PIN_LENGTH} error={!!error} />
        </View>

        {error || lockedUntil ? (
          <View style={styles.errorRow}>
            <Ionicons name="warning" size={14} color={theme.error} />
            <Text style={styles.errorText}>
              {lockedUntil
                ? `Locked. Try again in ${secondsLeft}s.`
                : error}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Bottom zone — keypad anchored to the bottom + Forgot PIN +
          Use a different account stacked beneath. Switch-account is
          last + muted because it's a rarely-used escape hatch, not
          the primary action. */}
      <View style={styles.bottomZone}>
        <PinKeypad
          onDigit={handleDigit}
          onBackspace={handleBackspace}
          onBiometric={bioType !== "none" ? handleBiometricShortcut : undefined}
          biometric={
            bioType === "face" ? "face" : bioType === "touch" ? "touch" : null
          }
          disabled={!!lockedUntil || verifying}
        />

        <View style={styles.linksRow}>
          <Pressable
            onPress={handleForgot}
            accessibilityRole="button"
            accessibilityLabel="Forgot PIN — start recovery"
            hitSlop={8}
            style={({ pressed }) => [
              styles.forgotPill,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.forgotText}>Forgot PIN?</Text>
          </Pressable>
          <Pressable
            onPress={handleSwitchAccount}
            accessibilityRole="button"
            accessibilityLabel="Use a different account"
            hitSlop={8}
            style={({ pressed }) => [
              styles.switchPill,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.switchText}>Switch account</Text>
          </Pressable>
        </View>
      </View>
    </AuthScreenContainer>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      flex: 1,
      // Big top padding so the hero bubble sits well below the
      // notch/status bar — when the safe-area inset is small on a
      // device, the hero was reading as flush against the top.
      // AuthScreenContainer's insets.top stacks on top of this.
      paddingTop: theme.space.s6 * 2 + theme.space.s3,
      paddingHorizontal: theme.space.s5,
    },
    topZone: {
      alignItems: "center",
      gap: theme.space.s2,
    },
    heroBubble: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.primaryTint,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: theme.space.s2,
    },
    headline: {
      fontSize: 22,
      lineHeight: 26,
      fontWeight: "800",
      letterSpacing: -0.4,
      color: theme.fg,
      textAlign: "center",
    },
    sub: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      textAlign: "center",
    },
    dotsWrap: {
      paddingTop: theme.space.s5,
      paddingBottom: theme.space.s2,
    },
    errorRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    errorText: {
      ...theme.type.bodySm,
      color: theme.error,
      fontWeight: "700",
    },
    bottomZone: {
      flex: 1,
      justifyContent: "flex-end",
      gap: theme.space.s3,
      paddingBottom: theme.space.s3,
    },
    linksRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.s3,
      paddingTop: theme.space.s3,
      paddingBottom: theme.space.s2,
    },
    forgotPill: {
      paddingHorizontal: theme.space.s3 + 2,
      paddingVertical: theme.space.s2,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.primaryTint,
    },
    forgotText: {
      ...theme.type.body,
      color: theme.primary,
      fontWeight: "800",
    },
    switchPill: {
      paddingHorizontal: theme.space.s3 + 2,
      paddingVertical: theme.space.s2,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    switchText: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
    },
  });
