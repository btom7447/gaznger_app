import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { toast } from "sonner-native";
import { Theme, useTheme } from "@/constants/theme";
import { AuthScreenContainer } from "@/components/ui/auth";
import { PinDots, PinKeypad } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { newIdempotencyKey } from "@/lib/idempotency";
import {
  getDeviceLabel,
  getOrCreateDeviceId,
  preparePinForTransmission,
} from "@/lib/auth";
import { useSessionStore, type SessionUser } from "@/store/useSessionStore";
import { usePendingSignupStore } from "@/store/usePendingSignupStore";

const PIN_LENGTH = 4;

type Step = "create" | "confirm";

interface ResetResponse {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
}

/**
 * Forgot-PIN — step 3 of 3. New PIN + confirm, then POST
 * /auth/forgot-pin/reset with the resetToken from the recovery OTP
 * step. On success the server revokes all old refresh tokens and
 * mints a fresh session — we log in client-side and route to the
 * appropriate dashboard.
 */
export default function NewPinScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const verificationToken = usePendingSignupStore((s) => s.verificationToken);
  const isVerificationValid = usePendingSignupStore(
    (s) => s.isVerificationValid
  );
  const resetPending = usePendingSignupStore((s) => s.reset);
  const login = useSessionStore((s) => s.login);

  const [step, setStep] = useState<Step>("create");
  const [first, setFirst] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const active = step === "create" ? first : confirm;

  const reset = useCallback(
    async (newPin: string) => {
      if (submitting) return;
      if (!verificationToken || !isVerificationValid()) {
        toast.error("Reset expired", {
          description: "Try the recovery flow again.",
        });
        router.replace("/(auth)/recovery/phone" as never);
        return;
      }
      setSubmitting(true);
      try {
        const deviceId = await getOrCreateDeviceId();
        const prepared = await preparePinForTransmission(newPin);
        const res = await api.post<ResetResponse>(
          "/auth/forgot-pin/reset",
          { resetToken: verificationToken, newPin: prepared },
          {
            headers: {
              "X-Device-Id": deviceId,
              "X-Device-Label": getDeviceLabel(),
              "Idempotency-Key": newIdempotencyKey(),
            },
          }
        );
        login(res);
        resetPending();

        toast.success("PIN reset", { description: "You're back in." });
        const role = res.user.role;
        if (role === "rider") {
          router.replace(
            res.user.verificationStatus === "approved"
              ? ("/(rider)/(queue)" as never)
              : ("/(auth)/verification/pending?role=rider" as never)
          );
          return;
        }
        if (role === "vendor") {
          router.replace(
            res.user.verificationStatus === "approved"
              ? ("/(vendor)/(today)" as never)
              : ("/(auth)/verification/pending?role=vendor" as never)
          );
          return;
        }
        router.replace("/(customer)/(home)" as never);
      } catch (err: any) {
        setError(err?.message ?? "Couldn't reset. Try again.");
        setStep("create");
        setFirst("");
        setConfirm("");
      } finally {
        setSubmitting(false);
      }
    },
    [submitting, verificationToken, isVerificationValid, login, resetPending, router]
  );

  const handleDigit = useCallback(
    (d: string) => {
      if (submitting || active.length >= PIN_LENGTH) return;
      if (error) setError(null);
      if (step === "create") setFirst((s) => (s + d).slice(0, PIN_LENGTH));
      else setConfirm((s) => (s + d).slice(0, PIN_LENGTH));
    },
    [submitting, active.length, step, error]
  );

  const handleBackspace = useCallback(() => {
    if (submitting) return;
    if (error) setError(null);
    if (step === "create") setFirst((s) => s.slice(0, -1));
    else setConfirm((s) => s.slice(0, -1));
  }, [submitting, step, error]);

  // Auto-advance.
  useEffect(() => {
    if (step === "create" && first.length === PIN_LENGTH) {
      setStep("confirm");
      return;
    }
    if (step === "confirm" && confirm.length === PIN_LENGTH) {
      if (confirm !== first) {
        setError("PINs don't match. Try again.");
        setConfirm("");
        return;
      }
      reset(confirm);
    }
  }, [step, first, confirm, reset]);

  const handleBack = useCallback(() => {
    if (step === "confirm") {
      setStep("create");
      setFirst("");
      setConfirm("");
      setError(null);
      return;
    }
    if (router.canGoBack()) router.back();
  }, [step, router]);

  const isConfirm = step === "confirm";
  const title = isConfirm ? "Confirm new PIN" : "New PIN";
  const sub = isConfirm
    ? "Enter the PIN again to confirm."
    : "Choose a new 4-digit PIN. Not your birthday.";

  return (
    <AuthScreenContainer
      onBack={handleBack}
      showHelp={false}
      scrollable={false}
      contentStyle={styles.content}
    >
      <View style={styles.topZone}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{sub}</Text>
        <View style={styles.dotsWrap}>
          <PinDots filled={active.length} length={PIN_LENGTH} error={!!error} />
        </View>
        {error ? (
          <View style={styles.errorRow}>
            <Ionicons name="warning" size={14} color={theme.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.bottomZone}>
        <PinKeypad
          onDigit={handleDigit}
          onBackspace={handleBackspace}
          disabled={submitting}
        />
      </View>
    </AuthScreenContainer>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      flex: 1,
      paddingTop: theme.space.s4,
      paddingHorizontal: theme.space.s5,
    },
    topZone: {
      alignItems: "center",
      gap: theme.space.s2,
      paddingTop: theme.space.s2,
    },
    title: {
      fontSize: 26,
      lineHeight: 30,
      fontWeight: "800",
      letterSpacing: -0.6,
      color: theme.fg,
      textAlign: "center",
    },
    sub: {
      ...theme.type.body,
      color: theme.fgMuted,
      textAlign: "center",
      maxWidth: 280,
    },
    dotsWrap: {
      paddingTop: theme.space.s5 + 8,
      paddingBottom: theme.space.s3,
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
      paddingBottom: theme.space.s3,
    },
  });
