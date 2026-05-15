import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, ViewStyle } from "react-native";
import { useTheme } from "@/constants/theme";

/**
 * Skeleton block — animated shimmer placeholder for loading state.
 *
 * Re-used by every vendor screen during initial fetch. The shimmer is
 * a low-cost opacity pulse rather than a gradient sweep so the dozen
 * skeletons that mount during a list-load don't trigger one Animated
 * driver per node.
 *
 * Default radius matches v6: 8px (sm). For circular placeholders
 * (avatars) pass `radius="full"`.
 */
export interface SkelProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number | "full";
  style?: ViewStyle;
}

export default function Skel({
  width = "100%",
  height = 16,
  radius = 8,
  style,
}: SkelProps) {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  const resolvedRadius = radius === "full" ? height / 2 : radius;

  return (
    <Animated.View
      style={[
        styles.base,
        {
          width: width as ViewStyle["width"],
          height,
          borderRadius: resolvedRadius,
          backgroundColor: theme.bgMuted,
          opacity,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: "hidden",
  },
});

// Lightweight container that just lays children in a column with gaps.
// Useful for stacked skeleton lists.
export function SkelStack({
  children,
  gap = 12,
}: {
  children: React.ReactNode;
  gap?: number;
}) {
  return <View style={{ gap }}>{children}</View>;
}
