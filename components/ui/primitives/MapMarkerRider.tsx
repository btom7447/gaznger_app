import React, { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Marker } from "react-native-maps";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Theme, useTheme } from "@/constants/theme";

interface MapMarkerRiderProps {
  /** Current rider coordinate. */
  coordinate: { latitude: number; longitude: number };
  /** Rider direction in degrees (optional rotation). */
  heading?: number;
  /** Show pulsing ring. Default true. */
  pulse?: boolean;
  /** Disable animation entirely (reduced motion). */
  reducedMotion?: boolean;
  /** Marker tracksViewChanges — keep false in production for perf. */
  tracksViewChanges?: boolean;
}

/**
 * Pulsing rider marker with smoothly-animated lat/lng.
 * Used by Track + Arrival.
 *
 * Note: rider pin position updates should be throttled to 1Hz at the
 * socket consumer level — see 15-screen-track.md.
 */
export default function MapMarkerRider({
  coordinate,
  heading,
  pulse = true,
  reducedMotion = false,
  tracksViewChanges = false,
}: MapMarkerRiderProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.4);

  useEffect(() => {
    if (!pulse || reducedMotion) {
      pulseScale.value = 1;
      pulseOpacity.value = 0.4;
      return;
    }
    pulseScale.value = withRepeat(
      withTiming(1.6, { duration: 1400, easing: Easing.out(Easing.quad) }),
      -1,
      false
    );
    pulseOpacity.value = withRepeat(
      withTiming(0, { duration: 1400, easing: Easing.out(Easing.quad) }),
      -1,
      false
    );
  }, [pulse, reducedMotion, pulseScale, pulseOpacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      flat
      rotation={heading}
      tracksViewChanges={tracksViewChanges}
    >
      <View style={styles.wrap} accessibilityLabel="Rider location" accessible>
        <Animated.View style={[styles.pulse, pulseStyle]} />
        <View style={styles.outer}>
          <View style={styles.inner} />
        </View>
      </View>
    </Marker>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    pulse: {
      position: "absolute",
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.primary,
    },
    outer: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.primary,
      borderWidth: 3,
      borderColor: "#fff",
      alignItems: "center",
      justifyContent: "center",
      ...theme.elevation.card,
    },
    inner: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#fff",
    },
  });
