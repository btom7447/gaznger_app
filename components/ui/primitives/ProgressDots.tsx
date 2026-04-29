import React, { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Theme, useTheme } from "@/constants/theme";

interface ProgressDotsProps {
  /** 0-indexed current step. */
  step: number;
  /** Total steps. */
  total: number;
  /** Visual style. */
  variant?: "dots" | "bars";
  /** Override accessibility label (default: "Step N of M"). */
  accessibilityLabel?: string;
}

/**
 * Step indicator. `bars` for the order flow (default), `dots` for compact contexts.
 *
 * Bars animate width (flex 1 ↔ 2) and color smoothly when `step` changes.
 */
export default function ProgressDots({
  step,
  total,
  variant = "bars",
  accessibilityLabel,
}: ProgressDotsProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View
      style={styles.row}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? `Step ${step + 1} of ${total}`}
      accessibilityValue={{ min: 0, max: total, now: step + 1 }}
    >
      {Array.from({ length: total }).map((_, i) => {
        if (variant === "bars") {
          return (
            <AnimatedBar
              key={i}
              index={i}
              step={step}
              activeColor={theme.primary}
              inactiveColor={theme.borderStrong}
              styles={styles}
            />
          );
        }
        const active = i === step;
        const past = i < step;
        return (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor:
                  active || past ? theme.primary : theme.borderStrong,
                width: active ? 12 : 6,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

function AnimatedBar({
  index,
  step,
  activeColor,
  inactiveColor,
  styles,
}: {
  index: number;
  step: number;
  activeColor: string;
  inactiveColor: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  const active = index === step;
  const past = index < step;
  // 0 = inactive, 1 = past (filled), 2 = active (wider + filled)
  const stateValue = active ? 2 : past ? 1 : 0;
  const sv = useSharedValue<number>(stateValue);

  useEffect(() => {
    sv.value = withTiming(stateValue, {
      duration: 320,
      easing: Easing.out(Easing.cubic),
    });
  }, [stateValue, sv]);

  const animStyle = useAnimatedStyle(() => {
    // Flex weight: inactive=1, past=1, active=2 (smooth interpolation).
    const flex = sv.value < 1 ? 1 : 1 + (sv.value - 1);
    const color = interpolateColor(
      sv.value,
      [0, 1, 2],
      [inactiveColor, activeColor, activeColor]
    );
    return {
      flex,
      backgroundColor: color,
    };
  });

  return <Animated.View style={[styles.bar, animStyle]} />;
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s1 + 2, // 6
    },
    bar: {
      height: 4,
      borderRadius: theme.space.s1,
    },
    dot: {
      height: 6,
      borderRadius: theme.radius.pill,
    },
  });
