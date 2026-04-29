import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  TextStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Theme, useTheme } from "@/constants/theme";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "tertiary"
  | "destructive"
  | "ghost"
  | "outline";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to fill parent width. */
  full?: boolean;
  /** Optional leading icon (Ionicons name). */
  iconLeft?: React.ComponentProps<typeof Ionicons>["name"];
  /** Optional trailing icon. */
  iconRight?: React.ComponentProps<typeof Ionicons>["name"];
  /** Subtitle line (used by FloatingCTA — "₦12,500" echo). */
  subtitle?: string;
  /** Loading state — replaces icon with spinner, disables interaction. */
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  children: React.ReactNode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Optional style override — applied to the outer Pressable. */
  style?: ViewStyle;
}

/**
 * Foundation Button. Six variants, three sizes, haptic on primary press.
 * No raw colors / spacing — everything resolves via the theme.
 */
export default function Button({
  variant = "primary",
  size = "md",
  full = false,
  iconLeft,
  iconRight,
  subtitle,
  loading = false,
  disabled = false,
  onPress,
  children,
  accessibilityLabel,
  accessibilityHint,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const sizeStyles = SIZE[size];
  const isInactive = disabled || loading;

  const handlePress = () => {
    if (isInactive) return;
    if (variant === "primary" || variant === "destructive") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress?.();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={isInactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isInactive, busy: loading }}
      android_ripple={
        variant === "ghost" || variant === "outline" || variant === "tertiary"
          ? { color: theme.bgMuted }
          : undefined
      }
      style={({ pressed }) => [
        styles.base,
        // Disabled trumps the variant style — flat gray pill per design.
        // Loading keeps the variant style (still looks "active") and just
        // shows a spinner inline.
        disabled ? styles.disabledBase : styles[variant],
        {
          paddingVertical: sizeStyles.padY,
          paddingHorizontal: sizeStyles.padX,
          minHeight: sizeStyles.minHeight,
          borderRadius: theme.radius.md,
        },
        full && styles.full,
        pressed && !isInactive && styles.pressed,
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={getFgColor(variant, theme, disabled)}
            style={styles.iconSpacing}
          />
        ) : iconLeft ? (
          <Ionicons
            name={iconLeft}
            size={sizeStyles.iconSize}
            color={getFgColor(variant, theme, disabled)}
            style={styles.iconSpacing}
          />
        ) : null}

        <View style={styles.labelCol}>
          <Text
            numberOfLines={1}
            style={[
              styles.label,
              {
                fontFamily: theme.type.h2.fontFamily,
                fontSize: sizeStyles.fontSize,
                lineHeight: sizeStyles.fontSize * 1.2,
                color: getFgColor(variant, theme, disabled),
              },
            ]}
          >
            {children}
          </Text>
          {subtitle ? (
            <Text
              numberOfLines={1}
              style={[
                styles.subtitle,
                {
                  fontFamily: theme.type.bodySm.fontFamily,
                  color: getFgColor(variant, theme, disabled, true),
                },
              ]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>

        {!loading && iconRight ? (
          <Ionicons
            name={iconRight}
            size={sizeStyles.iconSize}
            color={getFgColor(variant, theme, disabled)}
            style={styles.iconSpacingRight}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

const SIZE = {
  sm: { padY: 8, padX: 12, fontSize: 13, iconSize: 16, minHeight: 36 },
  md: { padY: 12, padX: 16, fontSize: 14, iconSize: 18, minHeight: 44 },
  lg: { padY: 16, padX: 20, fontSize: 16, iconSize: 20, minHeight: 52 },
} as const;

function getFgColor(
  variant: ButtonVariant,
  theme: Theme,
  disabled: boolean,
  muted = false
): string {
  // Disabled overrides every variant — flat muted fg.
  if (disabled) return theme.fgMuted;
  switch (variant) {
    case "primary":
    case "destructive":
      return muted ? "rgba(255,255,255,0.82)" : theme.fgOnPrimary;
    case "secondary":
      return muted ? theme.fgMuted : theme.primary;
    case "tertiary":
    case "ghost":
    case "outline":
      return muted ? theme.fgMuted : theme.fg;
    default:
      return theme.fg;
  }
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    base: {
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    labelCol: {
      alignItems: "center",
      justifyContent: "center",
    },
    label: {
      fontWeight: "700",
      textAlign: "center",
    },
    subtitle: {
      fontSize: 12,
      lineHeight: 14,
      marginTop: 2,
      textAlign: "center",
      opacity: 0.95,
    },
    iconSpacing: { marginRight: theme.space.s2 },
    iconSpacingRight: { marginLeft: theme.space.s2 },
    full: { alignSelf: "stretch" },
    pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    // Disabled buttons: flat gray pill, no shadow/elevation, no border.
    // Per design — independent of variant.
    disabledBase: {
      backgroundColor: theme.bgMuted,
    },

    primary: {
      backgroundColor: theme.primary,
      ...theme.elevation.card,
    },
    secondary: {
      backgroundColor: theme.primaryTint,
    },
    tertiary: {
      backgroundColor: theme.bgMuted,
    },
    destructive: {
      backgroundColor: theme.error,
      ...theme.elevation.card,
    },
    ghost: {
      backgroundColor: "transparent",
    },
    outline: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: theme.border,
    },
  });
