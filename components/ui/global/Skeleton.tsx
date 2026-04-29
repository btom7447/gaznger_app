import React, { useEffect, useRef } from "react";
import { Animated, DimensionValue, StyleProp, ViewStyle } from "react-native";

export default function Skeleton({
  width,
  height = 12,
  borderRadius = 6,
  color = "#D1D5DB",
  style,
}: {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 750, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: color }, { opacity }, style]}
    />
  );
}
