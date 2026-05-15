import React, { useMemo } from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { Theme, useTheme } from "@/constants/theme";

/**
 * Status pill — small inline badge used throughout vendor screens to
 * label order/delivery/rider state.
 *
 * Tone maps to a semantic colour pair (tint background + strong fg).
 * Optional leading dot for emphasis. Size variants follow the v6
 * design's "sm" (chips inside cards) and "md" (standalone status row).
 *
 * Terse copy convention: 1–2 words. Never wraps; truncates with
 * ellipsis if the caller's content overflows.
 */
export type PillTone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "error"
  | "info";

export interface VendorPillProps {
  tone?: PillTone;
  size?: "sm" | "md";
  /** Render a leading dot. */
  dot?: boolean;
  /** Pill label — keep terse. */
  children: React.ReactNode;
  style?: ViewStyle;
  /** Hide from a11y tree (e.g. when the surrounding row already announces state). */
  accessibilityHidden?: boolean;
}

interface TonePalette {
  bg: string;
  fg: string;
  dot: string;
}

function toneFor(theme: Theme, tone: PillTone): TonePalette {
  switch (tone) {
    case "primary":
      return {
        bg: theme.primaryTint,
        fg: theme.primary,
        dot: theme.primary,
      };
    case "success":
      return {
        bg: theme.successTint,
        fg: theme.success,
        dot: theme.success,
      };
    case "warning":
      return {
        bg: theme.warningTint,
        fg: theme.warning,
        dot: theme.warning,
      };
    case "error":
      return {
        bg: theme.errorTint,
        fg: theme.error,
        dot: theme.error,
      };
    case "info":
      return {
        bg: theme.infoTint,
        fg: theme.info,
        dot: theme.info,
      };
    case "neutral":
    default:
      return {
        bg: theme.bgMuted,
        fg: theme.fgMuted,
        dot: theme.fgSubtle,
      };
  }
}

export default function VendorPill({
  tone = "neutral",
  size = "sm",
  dot = false,
  children,
  style,
  accessibilityHidden = false,
}: VendorPillProps) {
  const theme = useTheme();
  const palette = toneFor(theme, tone);
  const styles = useMemo(
    () => makeStyles(theme, palette, size),
    [theme, palette, size],
  );

  return (
    <View
      style={[styles.wrap, style]}
      accessibilityElementsHidden={accessibilityHidden}
      importantForAccessibility={accessibilityHidden ? "no-hide-descendants" : "auto"}
    >
      {dot ? <View style={styles.dot} /> : null}
      <Text style={styles.label} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

const makeStyles = (theme: Theme, palette: TonePalette, size: "sm" | "md") => {
  const horizontal = size === "sm" ? 8 : 10;
  const vertical = size === "sm" ? 3 : 5;
  const fontSize = size === "sm" ? 11 : 12;
  const dotSize = size === "sm" ? 5 : 6;
  return StyleSheet.create({
    wrap: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: horizontal,
      paddingVertical: vertical,
      borderRadius: theme.radius.pill,
      backgroundColor: palette.bg,
    },
    dot: {
      width: dotSize,
      height: dotSize,
      borderRadius: dotSize / 2,
      backgroundColor: palette.dot,
    },
    label: {
      fontSize,
      fontWeight: "700",
      letterSpacing: 0.2,
      color: palette.fg,
    },
  });
};
