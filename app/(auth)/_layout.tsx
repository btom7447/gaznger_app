import { Stack } from "expo-router";
import React from "react";
import { useTheme } from "@/constants/theme";

/**
 * Auth route group — Stack with no tab bar. Every pre-app and auth
 * surface lives under this group, so the customer/rider/vendor pill
 * tab bar is structurally impossible to render here.
 *
 * Background tracks the theme so dark-mode surfaces transition cleanly
 * between screens (no white-flash on push). The screens themselves
 * own their StatusBar via AuthScreenContainer.
 */
export default function AuthLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "fade_from_bottom",
        contentStyle: { backgroundColor: theme.bg },
      }}
    />
  );
}
