import { Stack } from "expo-router";
import React from "react";
import { useTheme } from "@/constants/theme";

export default function VerificationLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: theme.bg },
      }}
    >
      <Stack.Screen name="pending" />
      <Stack.Screen name="rider" />
      <Stack.Screen name="vendor" />
    </Stack>
  );
}
