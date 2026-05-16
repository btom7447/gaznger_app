import { Stack } from "expo-router";
import React, { useEffect } from "react";
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
  console.log("[auth layout] render");
  useEffect(() => {
    console.log("[auth layout] MOUNT");
    return () => console.log("[auth layout] UNMOUNT");
  }, []);
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
      <Stack.Screen name="welcome/index" />
      <Stack.Screen name="welcome/vendor" />
      <Stack.Screen name="welcome/rider" />
      <Stack.Screen name="welcome-done" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="phone" />
      <Stack.Screen name="otp" />
      {/* Unlock screens declared flat — there's no app/(auth)/unlock/_layout.tsx
          so the route names use literal slashes, matching how signup/
          recovery/verification/states are declared below. */}
      <Stack.Screen name="unlock/pin" />
      <Stack.Screen name="unlock/biometric" />
      <Stack.Screen name="signup/role" />
      <Stack.Screen name="signup/profile-customer" />
      <Stack.Screen name="signup/profile-rider" />
      <Stack.Screen name="signup/profile-vendor" />
      <Stack.Screen name="signup/pin-create" />
      <Stack.Screen name="signup/security" />
      <Stack.Screen name="signup/permissions" />
      <Stack.Screen name="recovery/phone" />
      <Stack.Screen name="recovery/new-pin" />
      <Stack.Screen name="verification/pending" />
      <Stack.Screen name="verification/rider" />
      <Stack.Screen name="verification/vendor" />
      <Stack.Screen name="states/suspended" />
      <Stack.Screen name="states/deleted" />
      <Stack.Screen name="states/maintenance" />
      <Stack.Screen name="states/force-update" />
      <Stack.Screen name="states/new-device" />
      <Stack.Screen name="states/withdrawal-hold" />
    </Stack>
  );
}
