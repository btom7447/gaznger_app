// app/_layout.tsx
import React from "react";
import { Stack } from "expo-router";
import { useTheme } from "@/constants/theme";
import { StatusBar } from "react-native";

export default function RootLayout() {
  const theme = useTheme();

  return (
    <>
      <StatusBar
        barStyle={theme.mode === "dark" ? "light-content" : "dark-content"}
        backgroundColor={theme.background}
      />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        {/* Main navigators */}
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(modal)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(legal)" />
        <Stack.Screen name="(stack)" />
      </Stack>
    </>
  );
}
