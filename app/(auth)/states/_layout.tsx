import { Stack } from "expo-router";
import React from "react";
import { useTheme } from "@/constants/theme";

export default function StatesLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "fade",
        contentStyle: { backgroundColor: theme.bg },
      }}
    >
      <Stack.Screen name="suspended" />
      <Stack.Screen name="deleted" />
      <Stack.Screen name="maintenance" />
      <Stack.Screen name="force-update" />
      <Stack.Screen name="new-device" />
      <Stack.Screen name="withdrawal-hold" />
    </Stack>
  );
}
