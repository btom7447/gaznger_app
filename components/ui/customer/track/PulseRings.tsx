import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/constants/theme";

/**
 * Animated rider-arrived marker. Two outer pulse rings (large +
 * medium) loop forever — scaling out from the centre while fading to
 * zero — and the inner solid circle holds the green check icon.
 *
 * The two rings run on a 1.6s cycle, offset by 800ms so the user sees
 * a continuous "ripple" rather than two synchronised pops. Native
 * driver is on for transform + opacity so the loop won't drop frames
 * on the JS thread when the screen is busy with socket updates.
 */
export default function PulseRings() {
  const theme = useTheme();
  const a = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const make = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration: 1600,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          // Snap back to 0 instantly — the next iteration scales out
          // from zero again. Without this reset the value stays at 1
          // and subsequent loops are no-ops.
          Animated.timing(val, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );

    const loops = [make(a, 0), make(b, 800)];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [a, b]);

  // Scale from 0.6 → 1 (so the ring grows out from behind the inner
  // circle) and fade from 0.55 → 0.
  const ringStyle = (val: Animated.Value, size: number) => ({
    width: size,
    height: size,
    borderRadius: size / 2,
    transform: [
      {
        scale: val.interpolate({
          inputRange: [0, 1],
          outputRange: [0.6, 1],
        }),
      },
    ],
    opacity: val.interpolate({
      inputRange: [0, 1],
      outputRange: [0.55, 0],
    }),
  });

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[
          styles.ring,
          { backgroundColor: "rgba(255,255,255,0.18)" },
          ringStyle(a, 130),
        ]}
      />
      <Animated.View
        style={[
          styles.ring,
          { backgroundColor: "rgba(255,255,255,0.32)" },
          ringStyle(b, 96),
        ]}
      />
      <View
        style={[
          styles.inner,
          {
            backgroundColor: theme.success,
            ...theme.elevation.card,
          },
        ]}
      >
        <Ionicons name="checkmark" size={20} color="#fff" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
  },
  inner: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
});
