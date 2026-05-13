import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { toast } from "sonner-native";
import { Theme, useTheme } from "@/constants/theme";
import { AuthScreenContainer, TrustStrip } from "@/components/ui/auth";
import { Button, OtpInput } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { newIdempotencyKey } from "@/lib/idempotency";
import { getDeviceLabel, getOrCreateDeviceId } from "@/lib/auth";
import { usePendingSignupStore } from "@/store/usePendingSignupStore";

type Purpose = "signup" | "login" | "recovery";

interface SendOtpResponse {
  otpExpiresAt: string;
  resendAvailableAt: string;
}

interface VerifyOtpResponse {
  verificationToken: string;
  ttl: number;
}

const RESEND_COOLDOWN_S = 60;

/**
 * 6-digit OTP entry. Auto-verifies on the 6th digit fill, surfaces an
 * error inline on a wrong code (server message, verbatim), and counts
 * down a 60s resend cooldown that activates the resend link.
 *
 * The same screen serves all three OTP flows; `purpose` query param
 * decides which endpoint is hit and where we route on success:
 *   signup   → /(auth)/signup/role
 *   login    → /(auth)/unlock/pin (Phase 4 wires the real /auth/login)
 *   recovery → /(auth)/recovery/new-pin (Phase 4)
 *
 * The send-otp call is fired exactly once per mount (StrictMode-safe).
 * Manual resend uses a fresh Idempotency-Key so the server treats it as
 * a new request — re-using the original key would return the cached
 * 200 without sending a second SMS.
 */
export default function OtpScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string; purpose?: Purpose }>();
  const phone = params.phone ?? "";
  const purpose: Purpose =
    params.purpose === "login"
      ? "login"
      : params.purpose === "recovery"
      ? "recovery"
      : "signup";
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [digits, setDigits] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_S);
  const sentOnceRef = useRef(false);

  const setVerificationToken = usePendingSignupStore(
    (s) => s.setVerificationToken
  );
  const setPhoneVerified = usePendingSignupStore((s) => s.setPhoneVerified);

  const sendOtp = useCallback(async () => {
    if (!phone) return;
    try {
      await api.post<SendOtpResponse>(
        "/auth/send-otp",
        { phone, purpose },
        { headers: { "Idempotency-Key": newIdempotencyKey() } }
      );
      setSecondsLeft(RESEND_COOLDOWN_S);
    } catch (err: any) {
      // Server might 409 (signup, already exists) or 404 (recovery).
      // Surface the message verbatim, no generic strings.
      toast.error("Couldn't send code", {
        description: err?.message ?? "Try again in a moment.",
      });
    }
  }, [phone, purpose]);

  // Initial send — once per mount.
  useEffect(() => {
    if (sentOnceRef.current) return;
    sentOnceRef.current = true;
    sendOtp();
  }, [sendOtp]);

  // Countdown.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const handleResend = useCallback(async () => {
    if (resending || secondsLeft > 0) return;
    setResending(true);
    setError(null);
    setDigits("");
    try {
      await sendOtp();
      toast.success("Code sent", { description: `New code sent to ${phone}.` });
    } finally {
      setResending(false);
    }
  }, [resending, secondsLeft, sendOtp, phone]);

  const verify = useCallback(
    async (code: string) => {
      if (verifying || code.length !== 6) return;
      setVerifying(true);
      setError(null);
      try {
        const deviceId = await getOrCreateDeviceId();
        // Recovery uses a separate endpoint with a shorter token TTL +
        // an isolated namespace so a recovery token can't satisfy a
        // signup mutation. See _server-asks/auth-recovery.md.
        const endpoint =
          purpose === "recovery"
            ? "/auth/forgot-pin/verify"
            : "/auth/verify-otp";
        const body =
          purpose === "recovery"
            ? { phone, otp: code }
            : { phone, otp: code, purpose };
        console.log("[otp] step:before-api");
        const res = await api.post<VerifyOtpResponse>(endpoint, body, {
          headers: {
            "X-Device-Id": deviceId,
            "X-Device-Label": getDeviceLabel(),
          },
        });
        console.log("[otp] step:after-api purpose=" + purpose);
        try {
          setVerificationToken(res.verificationToken, res.ttl);
          console.log("[otp] step:after-setVerificationToken");
        } catch (e: any) {
          console.log("[otp] ERROR setVerificationToken: " + (e?.message ?? String(e)));
        }
        try {
          setPhoneVerified();
          console.log("[otp] step:after-setPhoneVerified");
        } catch (e: any) {
          console.log("[otp] ERROR setPhoneVerified: " + (e?.message ?? String(e)));
        }
        console.log("[otp] step:before-router.replace target=" +
          (purpose === "signup"
            ? "/(auth)/signup/role"
            : purpose === "recovery"
              ? "/(auth)/recovery/new-pin"
              : "/(auth)/unlock/pin"));

        if (purpose === "signup") {
          router.replace("/(auth)/signup/role" as never);
          console.log("[otp] step:after-router.replace signup/role");
          return;
        }
        if (purpose === "recovery") {
          router.replace("/(auth)/recovery/new-pin" as never);
          console.log("[otp] step:after-router.replace recovery/new-pin");
          return;
        }
        router.replace("/(auth)/unlock/pin" as never);
        console.log("[otp] step:after-router.replace unlock/pin");
      } catch (err: any) {
        setError(err?.message ?? "That code didn't match. Try again.");
        setDigits("");
      } finally {
        setVerifying(false);
      }
    },
    [verifying, phone, purpose, setVerificationToken, setPhoneVerified, router]
  );

  const handleChange = (next: string) => {
    setDigits(next);
    if (error) setError(null);
  };

  const handleEditPhone = useCallback(() => {
    if (router.canGoBack()) router.back();
    else
      router.replace({
        pathname: "/(auth)/phone" as never,
        params: { mode: purpose === "login" ? "login" : "signup" },
      });
  }, [router, purpose]);

  const resendActive = secondsLeft <= 0 && !resending;
  const resendLabel = resendActive
    ? "Resend code"
    : `Resend in 0:${String(secondsLeft).padStart(2, "0")}`;

  return (
    <AuthScreenContainer
      contentStyle={{ paddingTop: theme.space.s4, gap: theme.space.s4 }}
      footer={
        <Button
          variant="primary"
          size="lg"
          full
          onPress={() => verify(digits)}
          disabled={digits.length !== 6 || verifying}
          loading={verifying}
          accessibilityLabel="Verify code"
        >
          {verifying ? "Verifying…" : "Continue"}
        </Button>
      }
    >
      <View style={styles.headerWrap}>
        <Text style={styles.title}>Enter the code</Text>
        <View style={styles.subRow}>
          <Text style={styles.sub}>Sent to {phone || "your phone"} · </Text>
          <Pressable
            onPress={handleEditPhone}
            accessibilityRole="link"
            accessibilityLabel="Edit phone number"
            hitSlop={8}
          >
            <Text style={styles.editLink}>Edit</Text>
          </Pressable>
        </View>
      </View>

      <OtpInput
        value={digits}
        onChange={handleChange}
        onComplete={verify}
        error={!!error}
        disabled={verifying}
      />

      {error ? (
        <View style={styles.errorRow}>
          <Ionicons name="warning" size={14} color={theme.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.resendRow}>
        <Text style={styles.resendLeading}>Didn't get it? </Text>
        <Pressable
          onPress={resendActive ? handleResend : undefined}
          disabled={!resendActive}
          accessibilityRole="button"
          accessibilityLabel={resendActive ? "Resend code" : `Resend in ${secondsLeft} seconds`}
          accessibilityState={{ disabled: !resendActive }}
          hitSlop={8}
        >
          <Text
            style={[
              styles.resendLink,
              resendActive ? styles.resendLinkActive : styles.resendLinkInactive,
            ]}
          >
            {resendLabel}
          </Text>
        </Pressable>
      </View>

      <TrustStrip text="We'll never ask for this code outside the app." />
    </AuthScreenContainer>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    headerWrap: {
      gap: theme.space.s2,
    },
    title: {
      fontSize: 26,
      lineHeight: 30,
      fontWeight: "800",
      letterSpacing: -0.6,
      color: theme.fg,
    },
    subRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
    },
    sub: {
      ...theme.type.body,
      color: theme.fgMuted,
    },
    editLink: {
      ...theme.type.body,
      color: theme.primary,
      fontWeight: "700",
    },
    errorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    errorText: {
      ...theme.type.bodySm,
      color: theme.error,
      fontWeight: "700",
    },
    resendRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    resendLeading: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    resendLink: {
      ...theme.type.bodySm,
      fontWeight: "800",
    },
    resendLinkActive: {
      color: theme.primary,
    },
    resendLinkInactive: {
      color: theme.fg,
      ...theme.type.money,
    },
  });
