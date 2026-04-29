import React, { useEffect } from "react";
import { Text, View, StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { Theme, useTheme } from "@/constants/theme";

const SIZE = 64;
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface DispenseRingProps {
  /** 0..1. */
  progress: number;
}

/**
 * 64×64 progress ring used inside DispenseProgressCard. Animates dashoffset
 * on the UI thread; never animates backwards (caller clamps).
 */
export default function DispenseRing({ progress }: DispenseRingProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  const sv = useSharedValue(0);

  useEffect(() => {
    const target = Math.max(0, Math.min(1, progress));
    sv.value = withTiming(target, {
      duration: 800,
      easing: Easing.out(Easing.quad),
    });
  }, [progress, sv]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRC * (1 - sv.value),
  }));

  const pct = Math.round(progress * 100);

  return (
    <View style={styles.wrap}>
      <Svg width={SIZE} height={SIZE}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={theme.surface}
          strokeWidth={STROKE}
          fill="none"
        />
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={theme.primary}
          strokeWidth={STROKE}
          strokeDasharray={CIRC}
          strokeLinecap="round"
          fill="none"
          // Rotate so progress starts at 12 o'clock.
          originX={SIZE / 2}
          originY={SIZE / 2}
          rotation={-90}
          animatedProps={animatedProps}
        />
      </Svg>
      <View style={styles.pctOverlay}>
        <Text style={styles.pctText}>{pct}%</Text>
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: {
      width: SIZE,
      height: SIZE,
      alignItems: "center",
      justifyContent: "center",
    },
    pctOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
    },
    pctText: {
      ...theme.type.caption,
      ...theme.type.money,
      color: theme.primary,
      fontWeight: "800",
    },
  });
