import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";

export type StripVariant = "error" | "warning" | "info";

interface StripProps {
  message: string;
  /** Optional retry/dismiss action. */
  action?: { label: string; onPress: () => void };
  variant?: StripVariant;
  /** Slide in from top. Default true. */
  animated?: boolean;
  /** Override the leading icon. */
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  style?: ViewStyle;
}

/**
 * Inline non-blocking notice. ErrorStrip + InfoStrip are both this primitive
 * with different `variant` props.
 */
export default function ErrorStrip({
  message,
  action,
  variant = "error",
  animated = true,
  icon,
  style,
}: StripProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const translateY = useRef(new Animated.Value(animated ? -20 : 0)).current;
  const opacity = useRef(new Animated.Value(animated ? 0 : 1)).current;

  useEffect(() => {
    if (!animated) return;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [animated, translateY, opacity]);

  const colors = getColors(variant, theme);
  const resolvedIcon =
    icon ??
    (variant === "error"
      ? "alert-circle-outline"
      : variant === "warning"
        ? "warning-outline"
        : "information-circle-outline");

  return (
    <Animated.View
      style={[
        styles.strip,
        {
          backgroundColor: colors.bg,
          transform: [{ translateY }],
          opacity,
        },
        style,
      ]}
      accessibilityLiveRegion="polite"
    >
      <Ionicons name={resolvedIcon} size={18} color={colors.fg} />
      <Text style={[styles.message, { color: colors.fg }]} numberOfLines={2}>
        {message}
      </Text>
      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          hitSlop={6}
          style={({ pressed }) => [pressed && { opacity: 0.7 }]}
        >
          <Text style={[styles.action, { color: colors.fg }]}>
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

function getColors(variant: StripVariant, theme: Theme) {
  switch (variant) {
    case "error":
      return { bg: theme.errorTint, fg: theme.error };
    case "warning":
      return { bg: theme.warningTint, fg: theme.warning };
    case "info":
    default:
      return { bg: theme.infoTint, fg: theme.info };
  }
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    strip: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s2,
      paddingHorizontal: theme.space.s3,
      paddingVertical: theme.space.s2 + 2,
      borderRadius: theme.radius.md,
    },
    message: {
      ...theme.type.bodySm,
      flex: 1,
      fontWeight: "600",
    },
    action: {
      ...theme.type.caption,
      fontWeight: "800",
      textDecorationLine: "underline",
    },
  });
