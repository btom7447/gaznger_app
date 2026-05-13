import { Stack } from "expo-router";
import React from "react";
import { useTheme } from "@/constants/theme";

export default function RecoveryLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: theme.bg },
      }}
    >
      <Stack.Screen name="phone" />
      <Stack.Screen name="new-pin" />
    </Stack>
  );
}
