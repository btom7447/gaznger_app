import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { toast } from "sonner-native";
import { Theme, useTheme } from "@/constants/theme";
import { api } from "@/lib/api";
import { useSessionStore } from "@/store/useSessionStore";
import {
  ScreenContainer,
  ScreenHeader,
} from "@/components/ui/primitives";

/**
 * Change PIN — v3.
 *
 * Three flow modes derived from `user.hasPin`:
 *
 *   - SET (no PIN yet): password → newPin → confirmNewPin
 *   - CHANGE (has PIN): currentPin → newPin → confirmNewPin
 *   - CLEAR (separate entry from Settings, not built here yet — handled
 *     by an Alert in the Saved-cylinder pattern)
 *
 * Keypad is custom (no system keyboard) so the user always sees four
 * dots without the IME taking the screen. Layout:
 *
 *     [ 1 ] [ 2 ] [ 3 ]
 *     [ 4 ] [ 5 ] [ 6 ]
 *     [ 7 ] [ 8 ] [ 9 ]
 *     [   ] [ 0 ] [ ⌫ ]
 *
 * On a wrong PIN we shake the dot row + clear the digits.
 */

type Step = "current" | "password" | "new" | "confirm";

export default function ChangePinScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const user = useSessionStore((s) => s.user);
  const updateUser = useSessionStore((s) => s.updateUser);
  const hasPin = !!user?.hasPin;

  // First step depends on whether the user already has a PIN.
  const initialStep: Step = hasPin ? "current" : "password";

  const [step, setStep] = useState<Step>(initialStep);
  const [digits, setDigits] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [password, setPassword] = useState("");
  const [newPin, setNewPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const passwordInputRef = useRef<TextInput>(null);

  // Shake animation for wrong PIN / mismatched confirm.
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const triggerShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 1,
        duration: 60,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -1,
        duration: 60,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 1,
        duration: 60,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 60,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]).start();
  }, [shakeAnim]);
  const dotShakeStyle = {
    transform: [
      {
        translateX: shakeAnim.interpolate({
          inputRange: [-1, 1],
          outputRange: [-12, 12],
        }),
      },
    ],
  };

  // Flush digits when stepping forward.
  useEffect(() => {
    setDigits("");
  }, [step]);

  // Auto-focus the password field when we land on the password step.
  useEffect(() => {
    if (step === "password") {
      const t = setTimeout(() => passwordInputRef.current?.focus(), 200);
      return () => clearTimeout(t);
    }
  }, [step]);

  const submitSetOrChange = useCallback(
    async (newPinValue: string) => {
      setSubmitting(true);
      try {
        await api.post("/auth/pin/set", {
          newPin: newPinValue,
          currentPin: hasPin ? currentPin : undefined,
          password: hasPin ? undefined : password,
        });
        updateUser({ hasPin: true });
        toast.success(hasPin ? "PIN updated" : "PIN set");
        router.back();
      } catch (err: any) {
        toast.error("Couldn't update PIN", {
          description: err?.message ?? "Try again in a moment.",
        });
        // Drop back to the first credential step so the user can retry.
        setCurrentPin("");
        setPassword("");
        setNewPin("");
        setDigits("");
        setStep(initialStep);
      } finally {
        setSubmitting(false);
      }
    },
    [hasPin, currentPin, password, updateUser, router, initialStep]
  );

  const handleDigit = useCallback(
    (d: string) => {
      if (digits.length >= 4) return;
      const next = digits + d;
      setDigits(next);

      if (next.length === 4) {
        // Step transition.
        if (step === "current") {
          setCurrentPin(next);
          setStep("new");
        } else if (step === "new") {
          setNewPin(next);
          setStep("confirm");
        } else if (step === "confirm") {
          if (next !== newPin) {
            triggerShake();
            toast.error("PINs don't match", {
              description: "Try entering the new PIN again.",
            });
            setNewPin("");
            setDigits("");
            setStep("new");
          } else {
            submitSetOrChange(next);
          }
        }
      }
    },
    [digits, step, newPin, triggerShake, submitSetOrChange]
  );

  const handleBackspace = useCallback(() => {
    setDigits((d) => d.slice(0, -1));
  }, []);

  const handlePasswordContinue = useCallback(() => {
    if (password.length < 8) {
      Alert.alert(
        "Password too short",
        "Enter the same password you signed in with."
      );
      return;
    }
    setStep("new");
  }, [password]);

  const headerCopy = useMemo(() => {
    switch (step) {
      case "current":
        return {
          title: "Enter current PIN",
          sub: "Verify it's really you before changing.",
        };
      case "password":
        return {
          title: "Confirm with password",
          sub: "We'll use this once to set your PIN.",
        };
      case "new":
        return {
          title: hasPin ? "Choose a new PIN" : "Set a 4-digit PIN",
          sub: "Easy to remember, hard to guess. No 1234.",
        };
      case "confirm":
        return {
          title: "Confirm new PIN",
          sub: "Enter it once more to lock it in.",
        };
    }
  }, [step, hasPin]);

  return (
    <ScreenContainer
      edges={["top", "bottom"]}
      header={
        <ScreenHeader
          title={hasPin ? "Change PIN" : "Set PIN"}
          onBack={() => router.back()}
        />
      }
    >
      <View style={styles.body}>
        <View style={styles.stepProgress}>
          {(["current", "password", "new", "confirm"] as Step[])
            // Skip the irrelevant first step.
            .filter((s) =>
              hasPin ? s !== "password" : s !== "current"
            )
            .map((s, i, arr) => {
              const idx = arr.indexOf(step);
              const myIdx = arr.indexOf(s);
              return (
                <View
                  key={s}
                  style={[
                    styles.stepBar,
                    myIdx <= idx && styles.stepBarActive,
                  ]}
                />
              );
            })}
        </View>

        <Text style={styles.title}>{headerCopy.title}</Text>
        <Text style={styles.sub}>{headerCopy.sub}</Text>

        {step === "password" ? (
          <View style={styles.passwordWrap}>
            <View style={styles.passwordRow}>
              <Ionicons
                name="lock-closed"
                size={16}
                color={theme.fgMuted}
              />
              <TextInput
                ref={passwordInputRef}
                value={password}
                onChangeText={setPassword}
                placeholder="Account password"
                placeholderTextColor={theme.fgSubtle}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.passwordInput}
              />
            </View>
            <Pressable
              onPress={handlePasswordContinue}
              disabled={password.length < 8}
              accessibilityRole="button"
              accessibilityLabel="Continue with password"
              style={({ pressed }) => [
                styles.continueBtn,
                password.length < 8 && styles.continueBtnDisabled,
                pressed && password.length >= 8 && { opacity: 0.85 },
              ]}
            >
              <Text
                style={[
                  styles.continueBtnText,
                  password.length < 8 && {
                    color: theme.fgMuted,
                  },
                ]}
              >
                Continue
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Animated.View style={[styles.dotsRow, dotShakeStyle]}>
              {[0, 1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    digits.length > i && styles.dotFilled,
                  ]}
                />
              ))}
            </Animated.View>

            {submitting ? (
              <Text style={styles.submittingText}>Updating PIN…</Text>
            ) : null}

            <View style={styles.keypad}>
              {KEYS.map((row, ri) => (
                <View key={ri} style={styles.keyRow}>
                  {row.map((k, ki) => {
                    if (k === "") {
                      return <View key={ki} style={styles.keyEmpty} />;
                    }
                    if (k === "back") {
                      return (
                        <Pressable
                          key={ki}
                          onPress={handleBackspace}
                          disabled={submitting}
                          accessibilityRole="button"
                          accessibilityLabel="Backspace"
                          style={({ pressed }) => [
                            styles.key,
                            pressed && { opacity: 0.7 },
                          ]}
                        >
                          <Ionicons
                            name="backspace-outline"
                            size={22}
                            color={theme.fg}
                          />
                        </Pressable>
                      );
                    }
                    return (
                      <Pressable
                        key={ki}
                        onPress={() => handleDigit(k)}
                        disabled={submitting}
                        accessibilityRole="button"
                        accessibilityLabel={`Digit ${k}`}
                        style={({ pressed }) => [
                          styles.key,
                          pressed && styles.keyPressed,
                        ]}
                      >
                        <Text style={styles.keyText}>{k}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

const KEYS: string[][] = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", "back"],
];

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    body: {
      flex: 1,
      paddingHorizontal: theme.space.s4,
      paddingTop: theme.space.s2,
    },

    stepProgress: {
      flexDirection: "row",
      gap: 6,
      marginBottom: theme.space.s4,
    },
    stepBar: {
      flex: 1,
      height: 3,
      borderRadius: 2,
      backgroundColor: theme.bgMuted,
    },
    stepBarActive: {
      backgroundColor: theme.primary,
    },

    title: {
      ...theme.type.h2,
      color: theme.fg,
      fontWeight: "800",
      marginBottom: 6,
    },
    sub: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      marginBottom: theme.space.s5,
    },

    /* Dots */
    dotsRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 18,
      marginBottom: theme.space.s5,
    },
    dot: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: theme.bgMuted,
      borderWidth: 1.5,
      borderColor: theme.borderStrong,
    },
    dotFilled: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    submittingText: {
      ...theme.type.caption,
      color: theme.fgMuted,
      textAlign: "center",
      marginTop: -theme.space.s3,
      marginBottom: theme.space.s3,
    },

    /* Keypad */
    keypad: {
      gap: 12,
      marginTop: "auto",
      paddingBottom: theme.space.s4,
    },
    keyRow: {
      flexDirection: "row",
      gap: 12,
    },
    key: {
      flex: 1,
      height: 64,
      borderRadius: 16,
      backgroundColor: theme.bgMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    keyPressed: {
      backgroundColor: theme.primaryTint,
    },
    keyEmpty: {
      flex: 1,
      height: 64,
    },
    keyText: {
      ...theme.type.h2,
      ...theme.type.money,
      color: theme.fg,
      fontWeight: "700",
    },

    /* Password fallback (set flow only) */
    passwordWrap: {
      gap: theme.space.s3,
      marginBottom: theme.space.s4,
    },
    passwordRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 14,
      height: 50,
      borderRadius: 12,
      backgroundColor: theme.bgMuted,
      borderWidth: 1,
      borderColor: theme.border,
    },
    passwordInput: {
      flex: 1,
      ...theme.type.body,
      color: theme.fg,
      paddingVertical: 0,
    },
    continueBtn: {
      height: 48,
      borderRadius: 12,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    continueBtnDisabled: {
      backgroundColor: theme.bgMuted,
    },
    continueBtnText: {
      ...theme.type.body,
      color: "#fff",
      fontWeight: "800",
    },
  });
