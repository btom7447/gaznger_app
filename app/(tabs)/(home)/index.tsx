import React, { useState, useCallback, useEffect } from "react";
import { View, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ScreenBackground from "@/components/ui/global/ScreenBackground";
import { useSessionStore } from "@/store/useSessionStore";
import { useOrderStore } from "@/store/useOrderStore";
import { useTheme } from "@/constants/theme";
import HomeHeader from "@/components/ui/home/HomeHeader";
import PointsBanner from "@/components/ui/home/PointsBanner";
import FuelGrid from "@/components/ui/home/FuelGrid";

export default function HomeScreen() {
  const theme = useTheme();
  const user = useSessionStore((state) => state.user);
  const updateUser = useSessionStore((state) => state.updateUser);
  const fetchFuelTypes = useOrderStore((s) => s.fetchFuelTypes);
  const isFetchingFuelTypes = useOrderStore((s) => s.isFetchingFuelTypes);
  const fuelTypes = useOrderStore((s) => s.fuelTypes);
  const hasHydrated = useOrderStore((s) => s.hasHydrated);

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
      const [fuelData, pointsRes] = await Promise.all([
        fetchFuelTypes(),
        fetch(`${process.env.EXPO_PUBLIC_BASE_URL}/api/points/${user.id}`),
      ]);

      const pointsData = await pointsRes.json();
      if (pointsRes.ok) {
        updateUser({ points: pointsData.points });
      }
    } catch (err) {
      console.error("HomeScreen refresh failed:", err);
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
          <HomeHeader variant="home" user={user} />
          <PointsBanner />
          <FuelGrid />
          {/* Future sections */}
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 10,
    paddingTop: 10,
  },
});
