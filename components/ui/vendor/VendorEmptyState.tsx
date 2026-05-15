import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";

/**
 * Empty state — icon + headline + body + optional CTA.
 *
 * v6 uses this in:
 *   - Empty orders queue
 *   - Empty team
 *   - Empty supplies
 *   - Plant rejected (with a different tone via icon override)
 *
 * Terse copy convention: headline is 2–4 words, body is one short
 * sentence explaining what to do next.
 */
export interface VendorEmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  iconTone?: "neutral" | "primary" | "success" | "warning" | "error" | "info";
  headline: string;
  body?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

function iconColorFor(theme: Theme, tone: NonNullable<VendorEmptyStateProps["iconTone"]>) {
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
      return theme.fgMuted;
  }
}

function iconTintFor(theme: Theme, tone: NonNullable<VendorEmptyStateProps["iconTone"]>) {
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

export default function VendorEmptyState({
  icon = "ellipse-outline",
  iconTone = "neutral",
  headline,
  body,
  ctaLabel,
  onCta,
}: VendorEmptyStateProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const iconColor = iconColorFor(theme, iconTone);
  const iconTint = iconTintFor(theme, iconTone);

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityLabel={body ? `${headline}. ${body}` : headline}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconTint }]}>
        <Ionicons name={icon} size={28} color={iconColor} />
      </View>
      <Text style={styles.headline}>{headline}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {ctaLabel && onCta ? (
        <Pressable
          onPress={onCta}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          hitSlop={8}
          style={({ pressed }) => [
            styles.cta,
            pressed && { opacity: 0.9 },
          ]}
        >
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: {
      alignItems: "center",
      paddingHorizontal: 24,
      paddingVertical: 32,
      gap: 8,
    },
    iconWrap: {
      width: 64,
      height: 64,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    headline: {
      ...theme.type.h2,
      color: theme.fg,
      textAlign: "center",
    },
    body: {
      ...theme.type.body,
      color: theme.fgMuted,
      textAlign: "center",
      lineHeight: 21,
    },
    cta: {
      marginTop: 12,
      backgroundColor: theme.primary,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: theme.radius.pill,
    },
    ctaText: {
      ...theme.type.body,
      color: theme.fgOnPrimary,
      fontWeight: "700",
    },
  });
