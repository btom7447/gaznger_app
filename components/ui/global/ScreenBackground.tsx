import React from "react";
import { StyleSheet, View, ColorValue } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/constants/theme";

type GradientColors = readonly [ColorValue, ColorValue, ...ColorValue[]];

interface ScreenBackgroundProps {
  children?: React.ReactNode; // optional
  colors?: GradientColors;
  start?: { x: number; y: number };
  end?: { x: number; y: number };
}

export default function ScreenBackground({
  children,
  colors,
  start = { x: 0.5, y: 0 },
  end = { x: 0.5, y: 1 },
}: ScreenBackgroundProps) {
  const theme = useTheme();

  const lightGradient: GradientColors = [
    "rgba(255, 255, 255, 0.6)",
    "rgba(207, 238, 173, 0.35)",
    "rgba(255, 255, 255, 0.5)",
  ];

  const darkGradient: GradientColors = [
    "rgba(29, 51, 6, 1)",
    "rgba(39, 82, 39, 1)",
    "rgba(29, 51, 6, 1)",
  ];

  const resolvedColors =
    colors ?? (theme.mode === "dark" ? darkGradient : lightGradient);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={resolvedColors}
        start={start}
        end={end}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});