import { Stack } from "expo-router";
import React from "react";
import { useTheme } from "@/constants/theme";

export default function UnlockLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "fade",
        contentStyle: { backgroundColor: theme.bg },
      }}
    >
      <Stack.Screen name="pin" />
      <Stack.Screen name="biometric" />
    </Stack>
  );
}
