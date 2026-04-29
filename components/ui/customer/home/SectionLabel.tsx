import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Theme, useTheme } from "@/constants/theme";

interface SectionLabelProps {
  /** Eyebrow text. Rendered uppercase via theme.type.micro. */
  children: React.ReactNode;
  /** Optional right-aligned link (e.g., "See all"). */
  trailing?: { label: string; onPress: () => void };
  /** Use h2 instead of micro for the heading (e.g., "Recent" h2 + "See all" link). */
  asHeading?: boolean;
  style?: ViewStyle;
}

/**
 * Reusable section eyebrow / heading. Standardizes the "WHAT DO YOU NEED?"
 * micro labels and the "Recent / See all" h2-with-link pattern.
 */
export default function SectionLabel({
  children,
  trailing,
  asHeading = false,
  style,
}: SectionLabelProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={[styles.row, style]}>
      <Text
        style={asHeading ? styles.heading : styles.eyebrow}
        accessibilityRole="header"
      >
        {children}
      </Text>
      {trailing ? (
        <Pressable
          onPress={trailing.onPress}
          accessibilityRole="button"
          accessibilityLabel={trailing.label}
          hitSlop={6}
        >
          <Text style={styles.trailing}>{trailing.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    eyebrow: {
      ...theme.type.micro,
      fontSize: 13,
      lineHeight: 17,
      letterSpacing: 0.6,
      color: theme.fgMuted,
    },
    heading: {
      ...theme.type.h2,
      color: theme.fg,
    },
    trailing: {
      ...theme.type.caption,
      color: theme.primary,
      fontWeight: "700",
    },
  });
