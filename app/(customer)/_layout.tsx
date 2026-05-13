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
      router.replace("/(auth)/welcome" as any);
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

  // Explicit Tabs.Screen declarations are MANDATORY for production
  // builds. In dev the Metro bundler discovers all sibling route
  // groups automatically; once tree-shaken for a release build any
  // group not declared here renders as an empty body. The customer
  // tabs are (home), (order), (track), and wallet.
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        lazy: true,
      }}
    >
      <Tabs.Screen name="(home)" />
      <Tabs.Screen name="(order)" />
      <Tabs.Screen name="(track)" />
      <Tabs.Screen name="wallet" />
    </Tabs>
  );
}
