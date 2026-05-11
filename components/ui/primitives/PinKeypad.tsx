import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Theme, useTheme } from "@/constants/theme";

export type BiometricSlot = "face" | "touch" | null;

export interface PinKeypadProps {
  /** Biometric shortcut in the bottom-left key slot. Null = empty cell. */
  biometric?: BiometricSlot;
  /** Append a digit to the active value. */
  onDigit: (d: string) => void;
  /** Backspace — caller decides whether to clear or pop one. */
  onBackspace: () => void;
  /** Tapped the biometric shortcut (only fires when `biometric !== null`). */
  onBiometric?: () => void;
  /** Disable input (e.g. during lockout countdown or while verifying). */
  disabled?: boolean;
}

/**
 * Custom 3×4 numeric keypad. Financial-app convention: NEVER use the
 * system keyboard for PIN entry — system keyboards expose the digits
 * via predictive text + clipboard sync, and they pop layout up/down.
 *
 * Layout:
 *   1 2 3
 *   4 5 6
 *   7 8 9
 *   ⓕ 0 ⌫    (ⓕ = Face/Touch shortcut, only if `biometric` set)
 *
 * Haptics: light tap on every press. The Apple HIG recommends impact
 * feedback for keypads; subtle "tick" feel makes the keypad feel
 * mechanical instead of mushy.
 */
export default function PinKeypad({
  biometric = null,
  onDigit,
  onBackspace,
  onBiometric,
  disabled = false,
}: PinKeypadProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const tap = () => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const renderDigit = (d: string) => (
    <Pressable
      key={d}
      onPress={() => {
        tap();
        onDigit(d);
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Digit ${d}`}
      style={({ pressed }) => [
        styles.key,
        styles.keyDigit,
        pressed && !disabled && styles.keyPressed,
      ]}
    >
      <Text style={styles.keyText}>{d}</Text>
    </Pressable>
  );

  const biometricKey = (() => {
    if (!biometric) return <View key="bio-empty" style={styles.key} />;
    return (
      <Pressable
        key="bio"
        onPress={() => {
          tap();
          onBiometric?.();
        }}
        disabled={disabled || !onBiometric}
        accessibilityRole="button"
        accessibilityLabel={
          biometric === "face" ? "Use Face ID" : "Use fingerprint"
        }
        style={({ pressed }) => [
          styles.key,
          pressed && !disabled && styles.keyPressed,
        ]}
      >
        {/* Biometric glyph — fingerprint everywhere. Same icon for
            face + touch slots so the keypad reads as "biometric
            shortcut" without distracting per-platform variants. */}
        <Ionicons name="finger-print" size={28} color={theme.fg} />
      </Pressable>
    );
  })();

  const backspaceKey = (
    <Pressable
      key="back"
      onPress={() => {
        tap();
        onBackspace();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Delete"
      style={({ pressed }) => [
        styles.key,
        pressed && !disabled && styles.keyPressed,
      ]}
    >
      <Ionicons name="backspace-outline" size={24} color={theme.fg} />
    </Pressable>
  );

  return (
    <View style={styles.grid}>
      {["1", "2", "3"].map(renderDigit)}
      {["4", "5", "6"].map(renderDigit)}
      {["7", "8", "9"].map(renderDigit)}
      {biometricKey}
      {renderDigit("0")}
      {backspaceKey}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: theme.space.s2,
      paddingHorizontal: theme.space.s1,
    },
    key: {
      width: "32%",
      height: 56,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    keyDigit: {
      backgroundColor: theme.bgMuted,
    },
    keyPressed: {
      backgroundColor: theme.borderStrong,
    },
    keyText: {
      ...theme.type.h2,
      ...theme.type.money,
      color: theme.fg,
      fontSize: 24,
      fontWeight: "700",
    },
  });
