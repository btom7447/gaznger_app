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

  const lightGradient: GradientColors = ["#FFFFFF", "#F2F8F2", "#FFFFFF"];
  const darkGradient: GradientColors = ["#090F09", "#0D170D", "#090F09"];

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