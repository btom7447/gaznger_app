import React, { useEffect, useRef } from "react";
import {
  Animated,
  DimensionValue,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from "react-native";
import { useTheme } from "@/constants/theme";

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  /** Override the theme-driven skeleton color. */
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Skeleton placeholder. Theme-driven, 750ms pulse.
 * Single source — replaces the legacy `SkeletonBox`.
 */
export default function Skeleton({
  width,
  height = 12,
  borderRadius,
  color,
  style,
}: SkeletonProps) {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.box,
        {
          width,
          height,
          borderRadius: borderRadius ?? theme.radius.sm,
          backgroundColor: color ?? theme.skeleton,
          opacity,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  box: {},
});
