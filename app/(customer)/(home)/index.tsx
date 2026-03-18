import React, { useState, useCallback, useEffect, useRef } from "react";
import { View, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { api } from "@/lib/api";
import { SafeAreaView } from "react-native-safe-area-context";
import ScreenBackground from "@/components/ui/global/ScreenBackground";
import { useSessionStore } from "@/store/useSessionStore";
import { useOrderStore } from "@/store/useOrderStore";
import { useTheme } from "@/constants/theme";
import HomeHeader from "@/components/ui/home/HomeHeader";
import PointsBanner from "@/components/ui/home/PointsBanner";
import FuelGrid from "@/components/ui/home/FuelGrid";
import ActiveOrderBanner from "@/components/ui/home/ActiveOrderBanner";
import RecentOrders from "@/components/ui/home/RecentOrders";
import FuelPriceTicker from "@/components/ui/home/FuelPriceTicker";
import PromoBanner from "@/components/ui/home/PromoBanner";
import RedeemModal, { RedeemModalHandles } from "@/components/ui/home/RedeemModal";
import HomeHeaderSkeleton from "@/components/ui/skeletons/HomeHeaderSkeleton";
import PointsBannerSkeleton from "@/components/ui/skeletons/PointsBannerSkeleton";
import FuelGridSkeleton from "@/components/ui/skeletons/FuelGridSkeleton";

export default function HomeScreen() {
  const theme = useTheme();
  const user = useSessionStore((state) => state.user);
  const updateUser = useSessionStore((state) => state.updateUser);
  const fetchFuelTypes = useOrderStore((s) => s.fetchFuelTypes);
  const isFetchingFuelTypes = useOrderStore((s) => s.isFetchingFuelTypes);
  const fuelTypes = useOrderStore((s) => s.fuelTypes);
  const hasHydrated = useOrderStore((s) => s.hasHydrated);

  const redeemModalRef = useRef<RedeemModalHandles>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch fuel types once after hydration
  useEffect(() => {
    if (!hasHydrated) return;
    if (!fuelTypes.length && !isFetchingFuelTypes) {
      fetchFuelTypes();
    }
  }, [hasHydrated, fuelTypes.length, isFetchingFuelTypes, fetchFuelTypes]);

  const handleRefresh = useCallback(async () => {
    if (!user?.id) return;

    setRefreshing(true);
    try {
      const [, pointsData] = await Promise.all([
        fetchFuelTypes(),
        api.get<{ points: number }>("/api/points"),
      ]);

      updateUser({ points: pointsData.points });
    } catch (err) {
      // silent — PointsBanner handles its own error state
    } finally {
      setRefreshing(false);
    }
  }, [user, updateUser, fetchFuelTypes]);

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.text} // iOS spinner color
              colors={[theme.text]} // Android spinner color
            />
          }
        >
          {!hasHydrated ? <HomeHeaderSkeleton /> : <HomeHeader variant="home" user={user} />}
          {!hasHydrated ? <PointsBannerSkeleton /> : <PointsBanner onOpenRedeem={() => redeemModalRef.current?.open()} />}
          {isFetchingFuelTypes && !fuelTypes.length ? <FuelGridSkeleton /> : <FuelGrid />}

          {/* Promo banners */}
          <PromoBanner />

          {/* Active order */}
          {hasHydrated && <ActiveOrderBanner />}

          {/* Fuel price ticker */}
          {!!fuelTypes.length && <FuelPriceTicker />}

          {/* Recent orders */}
          {hasHydrated && <RecentOrders />}
        </ScrollView>
      </SafeAreaView>
      <RedeemModal ref={redeemModalRef} />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },
});
