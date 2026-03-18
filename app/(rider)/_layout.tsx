import React from "react";
import { Stack } from "expo-router";
import { useTheme } from "@/constants/theme";

export default function RiderLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
        animation: "slide_from_right",
      }}
    />
  );
}
