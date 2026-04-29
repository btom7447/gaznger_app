import React, { useEffect } from "react";
import { BackHandler } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useTheme } from "@/constants/theme";
import { useSessionStore } from "@/store/useSessionStore";

export default function RiderLayout() {
  const theme = useTheme();
  const router = useRouter();
  const { user, isLoggedIn, hasHydrated } = useSessionStore();

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isLoggedIn) {
      router.replace("/(auth)/authentication" as any);
      return;
    }
    if (user?.role !== "rider") {
      if (user?.role === "vendor") {
        router.replace("/(vendor)/(dashboard)" as any);
      } else {
        router.replace("/(customer)/(home)" as any);
      }
    }
  }, [hasHydrated, isLoggedIn, user?.role]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, []);

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
