import React, { useEffect } from "react";
import { BackHandler } from "react-native";
import { Tabs, useRouter } from "expo-router";
import CustomTabBar from "@/components/ui/global/CustomTabBar";
import { useSessionStore } from "@/store/useSessionStore";

export default function TabLayout() {
  const router = useRouter();
  const { user, isLoggedIn, hasHydrated } = useSessionStore();

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isLoggedIn) {
      router.replace("/(auth)/authentication" as any);
      return;
    }
    if (user?.role !== "customer" && user?.role !== "admin") {
      if (user?.role === "rider") {
        router.replace("/(rider)/(queue)" as any);
      } else if (user?.role === "vendor") {
        router.replace("/(vendor)/(dashboard)" as any);
      }
    }
  }, [hasHydrated, isLoggedIn, user?.role]);

  // Block Android hardware back from leaving the customer area
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, []);

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        lazy: true,
      }}
    />
  );
}
