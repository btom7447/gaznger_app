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
  // Explicit Stack.Screen list — production bundlers drop any route
  // group not declared here (see app/_layout.tsx for the full
  // rationale). Auth has both flat screens (welcome, onboarding,
  // phone, otp) and nested groups (signup, unlock, recovery, etc).
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "fade_from_bottom",
        contentStyle: { backgroundColor: theme.bg },
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="welcome-done" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="phone" />
      <Stack.Screen name="otp" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="unlock" />
      <Stack.Screen name="recovery" />
      <Stack.Screen name="verification" />
      <Stack.Screen name="states" />
    </Stack>
  );
}
