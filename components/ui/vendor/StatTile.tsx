import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";

/**
 * Single tile in a 3-col vendor stats row (Today screen, etc.).
 *
 * Composition: optional leading icon, large value, secondary label.
 * Tone tints the value + icon color (success for money, warning for
 * pending alerts, etc.).
 *
 * Sizing: comfortable density — 12 vertical padding, 16px value.
 */
export interface StatTileProps {
  /** Big number / currency string. */
  value: string;
  /** Caption beneath the value. */
  label: string;
  /** Tints the value + icon. */
  tone?: "neutral" | "primary" | "success" | "warning" | "error" | "info";
  /** Optional Ionicons glyph name. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** A11y override — if omitted, derived from value + label. */
  accessibilityLabel?: string;
}

function colorFor(theme: Theme, tone: NonNullable<StatTileProps["tone"]>) {
  switch (tone) {
    case "primary":
      return theme.primary;
    case "success":
      return theme.success;
    case "warning":
      return theme.warning;
    case "error":
      return theme.error;
    case "info":
      return theme.info;
    case "neutral":
    default:
      return theme.fg;
  }
}

function tintFor(theme: Theme, tone: NonNullable<StatTileProps["tone"]>) {
  switch (tone) {
    case "primary":
      return theme.primaryTint;
    case "success":
      return theme.successTint;
    case "warning":
      return theme.warningTint;
    case "error":
      return theme.errorTint;
    case "info":
      return theme.infoTint;
    case "neutral":
    default:
      return theme.bgMuted;
  }
}

export default function StatTile({
  value,
  label,
  tone = "neutral",
  icon,
  accessibilityLabel,
}: StatTileProps) {
  const theme = useTheme();
  const fg = colorFor(theme, tone);
  const bg = tintFor(theme, tone);
  const styles = useMemo(() => makeStyles(theme, bg), [theme, bg]);

  return (
    <View
      style={styles.tile}
      accessible
      accessibilityLabel={accessibilityLabel ?? `${label}: ${value}`}
    >
      {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text style={[styles.value, { color: fg }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const makeStyles = (theme: Theme, bg: string) =>
  StyleSheet.create({
    tile: {
      flex: 1,
      backgroundColor: bg,
      borderRadius: theme.radius.lg,
      paddingVertical: 12,
      paddingHorizontal: 10,
      gap: 4,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 84,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border + "22",
    },
    value: {
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: -0.2,
    },
    label: {
      ...theme.type.caption,
      color: theme.fgMuted,
      fontWeight: "500",
      textAlign: "center",
    },
  });
