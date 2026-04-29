import React, { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
} from "react-native";
import { useTheme } from "@/constants/theme";

/**
 * Pill toggle. Knob slides between two end stops; track flips to the
 * primary tint when on. Wrapped in a Pressable with role="switch" so
 * the entire control is one tap target (vs the row swallowing taps in
 * the parent Row primitive).
 *
 * Animation respects reduced-motion.
 */
interface SwitchProps {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}

const TRACK_WIDTH = 38;
const TRACK_HEIGHT = 22;
const KNOB_SIZE = 18;
const KNOB_INSET = 2;
const KNOB_TRAVEL = TRACK_WIDTH - KNOB_SIZE - KNOB_INSET * 2;

export default function Switch({
  value,
  onValueChange,
  disabled,
  accessibilityLabel,
}: SwitchProps) {
  const theme = useTheme();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!cancelled) reducedMotionRef.current = reduced;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: reducedMotionRef.current ? 0 : 180,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: false, // backgroundColor + translateX both animate
    }).start();
  }, [value, anim]);

  const trackBg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      theme.mode === "dark" ? theme.palette.neutral700 : theme.palette.neutral200,
      theme.primary,
    ],
  });
  const knobX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [KNOB_INSET, KNOB_INSET + KNOB_TRAVEL],
  });

  return (
    <Pressable
      onPress={() => !disabled && onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [pressed && { opacity: 0.85 }]}
    >
      <Animated.View
        style={[
          styles.track,
          { backgroundColor: trackBg, opacity: disabled ? 0.5 : 1 },
        ]}
      >
        <Animated.View
          style={[
            styles.knob,
            { transform: [{ translateX: knobX }] },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    justifyContent: "center",
  },
  knob: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2,
  },
});
