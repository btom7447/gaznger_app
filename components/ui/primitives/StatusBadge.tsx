import React, { useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Theme, useTheme } from "@/constants/theme";

export type StatusKind =
  | "success"
  | "warning"
  | "error"
  | "info"
  | "gold"
  | "neutral"
  | "primary";

interface StatusBadgeProps {
  kind: StatusKind;
  /** Optional pulsing dot (used for LIVE indicators). */
  pulse?: boolean;
  /** Compact variant — smaller padding. */
  compact?: boolean;
  /** Render with a leading dot. */
  withDot?: boolean;
  style?: ViewStyle;
  children: React.ReactNode;
}

/**
 * Single source for status pills. Used directly and wrapped by LiveBadge.
 */
export default function StatusBadge({
  kind,
  pulse = false,
  compact = false,
  withDot = false,
  style,
  children,
}: StatusBadgeProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pulse) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse, opacity]);

  const colors = getColors(kind, theme);

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.bg,
          paddingHorizontal: compact ? theme.space.s2 : theme.space.s3,
          paddingVertical: compact ? 2 : 4,
        },
        style,
      ]}
      accessibilityRole="text"
    >
      {withDot ? (
        <Animated.View
          style={[
            styles.dot,
            { backgroundColor: colors.fg, opacity: pulse ? opacity : 1 },
          ]}
        />
      ) : null}
      <Text
        style={[
          styles.text,
          {
            color: colors.fg,
            fontSize: compact ? 11 : 12,
          },
        ]}
        numberOfLines={1}
      >
        {children}
      </Text>
    </View>
  );
}

function getColors(kind: StatusKind, theme: Theme) {
  switch (kind) {
    case "success":
      return { bg: theme.successTint, fg: theme.success };
    case "warning":
      return { bg: theme.warningTint, fg: theme.warning };
    case "error":
      return { bg: theme.errorTint, fg: theme.error };
    case "info":
      return { bg: theme.infoTint, fg: theme.info };
    case "gold":
      return { bg: theme.accentTint, fg: theme.accent };
    case "primary":
      return { bg: theme.primaryTint, fg: theme.primary };
    case "neutral":
    default:
      return { bg: theme.bgMuted, fg: theme.fgMuted };
  }
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    badge: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: theme.radius.pill,
      alignSelf: "flex-start",
      gap: 6,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    text: {
      fontFamily: theme.type.caption.fontFamily,
      fontWeight: "700",
      letterSpacing: 0.2,
    },
  });
