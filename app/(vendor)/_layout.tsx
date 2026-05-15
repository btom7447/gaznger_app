import React, { useEffect } from "react";
import { BackHandler } from "react-native";
import { Tabs, useRouter } from "expo-router";
import VendorTabBar from "@/components/ui/vendor/VendorTabBar";
import { useSessionStore } from "@/store/useSessionStore";

/**
 * Vendor app root.
 *
 * Bottom tabs (v6 architecture):
 *   - Today    (hero layout)
 *   - Orders   (queue + assign rider — list + copy)
 *   - Supplies (bulk purchases + timeline tracker)
 *   - Profile  (identity + stations + tanks + team)
 *   - Finance  (wallet → payouts → KYC)
 *
 * Density tone: terse. Order density: comfortable.
 *
 * Vendor-role gate redirects non-vendors to their respective dashboards.
 * Approved vendors land here from the bootstrap router; unapproved
 * vendors are kept on /(auth)/verification/vendor by app/index.tsx.
 */
export default function VendorLayout() {
  const router = useRouter();
  const { user, isLoggedIn, hasHydrated } = useSessionStore();

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isLoggedIn) {
      router.replace("/(auth)/welcome" as never);
      return;
    }
    if (user?.role !== "vendor") {
      if (user?.role === "rider") {
        router.replace("/(rider)/(queue)" as never);
      } else {
        router.replace("/(customer)/(home)" as never);
      }
    }
  }, [hasHydrated, isLoggedIn, user?.role, router]);

  // Block Android hardware back from leaving the vendor area.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, []);

  return (
    <Tabs
      tabBar={(props) => <VendorTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        lazy: true,
      }}
    >
      <Tabs.Screen name="(today)" />
      <Tabs.Screen name="(orders)" />
      <Tabs.Screen name="(supplies)" />
      <Tabs.Screen name="(profile)" />
      <Tabs.Screen name="(finance)" />
    </Tabs>
  );
}
