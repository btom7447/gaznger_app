import React, { useMemo } from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { Theme, useTheme } from "@/constants/theme";

/**
 * Padded surface used as the building block for every vendor card-style
 * UI (stat tiles, alert chips, order rows, rider cards, hero blocks).
 *
 * Tone hints at semantic intent (alert backgrounds, info panels) but
 * defaults to a plain surface. The card is presentational only; for
 * interactive cards pass `onPress` and we wrap in <Pressable> with the
 * standard press feedback.
 *
 * Padding follows the "comfortable" order-density rule: 14 vertical
 * (12 in "tight" variant for nested cards).
 */
export interface VendorCardProps {
  tone?: "neutral" | "primary" | "success" | "warning" | "error" | "info";
  /** Reduce padding for nested cards. */
  tight?: boolean;
  /** Optional border override; defaults to a hairline border. */
  bordered?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

interface TonePalette {
  bg: string;
  border: string;
}

function toneFor(theme: Theme, tone: NonNullable<VendorCardProps["tone"]>): TonePalette {
  switch (tone) {
    case "primary":
      return { bg: theme.primaryTint, border: theme.primary + "33" };
    case "success":
      return { bg: theme.successTint, border: theme.success + "33" };
    case "warning":
      return { bg: theme.warningTint, border: theme.warning + "33" };
    case "error":
      return { bg: theme.errorTint, border: theme.error + "33" };
    case "info":
      return { bg: theme.infoTint, border: theme.info + "33" };
    case "neutral":
    default:
      return { bg: theme.surface, border: theme.border };
  }
}

export default function VendorCard({
  tone = "neutral",
  tight = false,
  bordered = true,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  children,
  style,
}: VendorCardProps) {
  const theme = useTheme();
  const palette = toneFor(theme, tone);
  const styles = useMemo(
    () => makeStyles(theme, palette, tight, bordered),
    [theme, palette, tight, bordered],
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={({ pressed }) => [
          styles.wrap,
          pressed && { opacity: 0.92 },
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[styles.wrap, style]}>{children}</View>;
}

const makeStyles = (
  theme: Theme,
  palette: TonePalette,
  tight: boolean,
  bordered: boolean,
) =>
  StyleSheet.create({
    wrap: {
      backgroundColor: palette.bg,
      borderRadius: theme.radius.lg,
      paddingHorizontal: tight ? 12 : 14,
      paddingVertical: tight ? 10 : 14,
      borderWidth: bordered ? StyleSheet.hairlineWidth : 0,
      borderColor: palette.border,
    },
  });
