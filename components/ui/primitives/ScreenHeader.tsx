import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Theme, useTheme } from "@/constants/theme";

interface TrailingAction {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  badge?: boolean | number;
  accessibilityLabel: string;
}

interface ScreenHeaderProps {
  title?: string;
  /** Show a back chip; default true unless this is a tab root. */
  showBack?: boolean;
  /** Override the default `router.back()` behavior. */
  onBack?: () => void;
  /** Optional trailing icon button. */
  trailing?: TrailingAction;
  /** When set, replaces title with a custom node (e.g., for hero screens). */
  custom?: React.ReactNode;
  /** Title left-aligned (next to back chip) instead of centered. Default false. */
  titleLeft?: boolean;
}

/**
 * Consistent header bar — back chip + title + optional trailing icon.
 */
export default function ScreenHeader({
  title,
  showBack = true,
  onBack,
  trailing,
  custom,
  titleLeft = false,
}: ScreenHeaderProps) {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const handleBack = () => {
    if (onBack) onBack();
    else if (router.canGoBack()) router.back();
  };

  if (titleLeft) {
    return (
      <View style={styles.rowLeft}>
        {showBack ? (
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [
              styles.backChip,
              pressed && { opacity: 0.7 },
            ]}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={20} color={theme.fg} />
          </Pressable>
        ) : null}
        {custom ? (
          custom
        ) : title ? (
          <Text
            style={[styles.titleLeft, { color: theme.fg }]}
            numberOfLines={1}
            accessibilityRole="header"
          >
            {title}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <View style={styles.side}>
        {showBack ? (
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [
              styles.backChip,
              pressed && { opacity: 0.7 },
            ]}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={20} color={theme.fg} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.center} pointerEvents="box-none">
        {custom ? (
          custom
        ) : title ? (
          <Text
            style={[styles.title, { color: theme.fg }]}
            numberOfLines={1}
            accessibilityRole="header"
          >
            {title}
          </Text>
        ) : null}
      </View>

      <View style={[styles.side, styles.sideRight]}>
        {trailing ? (
          <Pressable
            onPress={trailing.onPress}
            accessibilityRole="button"
            accessibilityLabel={trailing.accessibilityLabel}
            style={({ pressed }) => [
              styles.backChip,
              pressed && { opacity: 0.7 },
            ]}
            hitSlop={8}
          >
            <Ionicons name={trailing.icon} size={20} color={theme.fg} />
            {trailing.badge ? (
              <View style={styles.badge}>
                {typeof trailing.badge === "number" ? (
                  <Text style={styles.badgeText}>
                    {trailing.badge > 99 ? "99+" : String(trailing.badge)}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.space.s4,
      paddingVertical: theme.space.s2,
      minHeight: 52,
    },
    rowLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s3,
      paddingHorizontal: theme.space.s4,
      paddingVertical: theme.space.s2,
      minHeight: 52,
    },
    side: {
      width: 40,
      alignItems: "flex-start",
      justifyContent: "center",
    },
    sideRight: { alignItems: "flex-end" },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    backChip: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.bgMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      ...theme.type.h2,
      fontWeight: "800",
    },
    titleLeft: {
      ...theme.type.h1,
      fontWeight: "800",
      flex: 1,
    },
    badge: {
      position: "absolute",
      top: 6,
      right: 6,
      minWidth: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.error,
      paddingHorizontal: 3,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeText: {
      color: theme.fgOnPrimary,
      fontSize: 9,
      fontWeight: "800",
      lineHeight: 9,
    },
  });
