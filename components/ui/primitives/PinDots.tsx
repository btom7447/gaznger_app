import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Theme, useTheme } from "@/constants/theme";

export interface PinDotsProps {
  /** Total dots (default 4 — financial-app convention). */
  length?: number;
  /** How many filled. */
  filled: number;
  /** Error tint — flips dots + ring to error color. */
  error?: boolean;
}

/**
 * 4-dot PIN progress. Pure visual — keypad sits below and reports
 * fill count via prop. Filled dots are solid primary; empty are a
 * 1.5pt outline. Error state turns everything red so the user gets
 * feedback before the next attempt.
 */
export default function PinDots({
  length = 4,
  filled,
  error = false,
}: PinDotsProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View
      style={styles.row}
      accessibilityRole="progressbar"
      accessibilityLabel={`${filled} of ${length} digits entered`}
      accessibilityValue={{ min: 0, max: length, now: filled }}
    >
      {Array.from({ length }).map((_, i) => {
        const isFilled = i < filled;
        return (
          <View
            key={i}
            style={[
              styles.dot,
              isFilled && styles.dotFilled,
              error && styles.dotError,
              error && isFilled && styles.dotErrorFilled,
            ]}
          />
        );
      })}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 14,
    },
    dot: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: theme.borderStrong,
      backgroundColor: "transparent",
    },
    dotFilled: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    dotError: {
      borderColor: theme.error,
    },
    dotErrorFilled: {
      backgroundColor: theme.error,
      borderColor: theme.error,
    },
  });
