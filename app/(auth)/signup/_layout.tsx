import { Stack } from "expo-router";
import React from "react";
import { useTheme } from "@/constants/theme";

/**
 * Signup sub-stack. Without an explicit Stack here Expo Router's
 * production bundler tree-shakes the child screens and any
 * router.replace("/(auth)/signup/role") lands on an empty navigator.
 * Symptom: red RouteProbe banner disappears after OTP submit, screen
 * goes blank, no ErrorBoundary trigger.
 */
export default function SignupLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: theme.bg },
      }}
    >
      <Stack.Screen name="role" />
      <Stack.Screen name="profile-customer" />
      <Stack.Screen name="profile-rider" />
      <Stack.Screen name="profile-vendor" />
      <Stack.Screen name="pin-create" />
      <Stack.Screen name="security" />
      <Stack.Screen name="permissions" />
    </Stack>
  );
}
