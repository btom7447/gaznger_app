import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Theme, useTheme } from "@/constants/theme";
import { AuthScreenContainer, TrustStrip } from "@/components/ui/auth";
import { PinDots, PinKeypad } from "@/components/ui/primitives";
import { usePendingSignupStore } from "@/store/usePendingSignupStore";
import { preparePinForTransmission } from "@/lib/auth";

const PIN_LENGTH = 4;

type Step = "create" | "confirm";

/**
 * PIN setup — two-step (create then confirm). Uses local state for the
 * raw plaintext during entry; only the prepared form (currently a
 * normalised string; see `preparePinForTransmission`) hits the
 * persisted store. Mismatch on confirm shows an error inline AND
 * keeps the user on confirm-step (we drop the digits and let them
 * retry rather than restarting from create — that matches the design
 * note "Mismatch on confirm shows error inline; doesn't force restart").
 *
 * Tapping back from confirm returns to create with both fields cleared.
 */
export default function PinCreateScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const setPreparedPin = usePendingSignupStore((s) => s.setPreparedPin);
  const setLastStep = usePendingSignupStore((s) => s.setLastStep);

  const [step, setStep] = useState<Step>("create");
  const [first, setFirst] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const active = step === "create" ? first : confirm;
  const filled = active.length;

  const handleDigit = useCallback(
    (d: string) => {
      if (active.length >= PIN_LENGTH) return;
      if (error) setError(null);
      if (step === "create") setFirst((s) => (s + d).slice(0, PIN_LENGTH));
      else setConfirm((s) => (s + d).slice(0, PIN_LENGTH));
    },
    [active.length, step, error]
  );

  const handleBackspace = useCallback(() => {
    if (error) setError(null);
    if (step === "create") setFirst((s) => s.slice(0, -1));
    else setConfirm((s) => s.slice(0, -1));
  }, [step, error]);

  // Auto-advance when 4 digits entered.
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
      // Match — persist and advance.
      (async () => {
        const prepared = await preparePinForTransmission(confirm);
        setPreparedPin(prepared);
        setLastStep("/(auth)/signup/security");
        router.push("/(auth)/signup/security" as never);
      })();
    }
  }, [step, first, confirm, setPreparedPin, setLastStep, router]);

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
  const title = isConfirm ? "Confirm your PIN" : "Create a 4-digit PIN";
  const sub = isConfirm
    ? "Enter the PIN again to confirm."
    : "Choose something only you know. Not your birthday.";

  return (
    <AuthScreenContainer
      onBack={handleBack}
      showHelp={false}
      scrollable={false}
      contentStyle={styles.content}
    >
      {/* Top zone — header + dots stacked tight, no gap blowing them
          apart. Centred horizontally so the dots line up under the
          headline regardless of screen size. */}
      <View style={styles.topZone}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subText}>{sub}</Text>

        <View style={styles.dotsWrap}>
          <PinDots filled={filled} length={PIN_LENGTH} error={!!error} />
        </View>

        {error ? (
          <View style={styles.errorRow}>
            <Ionicons name="warning" size={14} color={theme.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>

      {/* Bottom zone — trust strip stacked directly above the keypad.
          Keypad anchored to the bottom of the screen via
          `justifyContent: flex-end` on the parent, so the layout
          stays solid on tall and short devices alike. */}
      <View style={styles.bottomZone}>
        {!isConfirm ? (
          <TrustStrip
            icon="shield-checkmark"
            text="Your PIN is encrypted in transit and stored as a hash. We never see it in plain text."
          />
        ) : null}
        <PinKeypad onDigit={handleDigit} onBackspace={handleBackspace} />
      </View>
    </AuthScreenContainer>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      flex: 1,
      paddingTop: theme.space.s4,
      // Override the default gap from AuthScreenContainer so our two
      // zones manage their own spacing without a parent gap injecting
      // extra space.
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
    subText: {
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
      gap: 6,
      justifyContent: "center",
    },
    errorText: {
      ...theme.type.bodySm,
      color: theme.error,
      fontWeight: "700",
    },
    bottomZone: {
      // `flex: 1` consumes the remaining vertical space and the
      // `justifyContent: flex-end` pushes the keypad to the bottom
      // (with the optional trust strip stacked just above it). This
      // is what makes the layout feel anchored on every screen size
      // instead of floating in the middle.
      flex: 1,
      justifyContent: "flex-end",
      gap: theme.space.s3,
      paddingBottom: theme.space.s3,
    },
  });
