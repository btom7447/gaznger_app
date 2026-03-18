import React, { useEffect } from "react";
import { View, Image, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/constants/theme";
import { useAppFonts } from "@/constants/useFonts";
import { useSessionStore } from "@/store/useSessionStore";


export default function SplashScreen() {
  const router = useRouter();
  const theme = useTheme();
  const fontsLoaded = useAppFonts();

  const { isLoggedIn, hasHydrated, user, logout } = useSessionStore();

  /**
   * DEV ONLY — set true to wipe stored session and restart from login
   */
  const DEV_FORCE_LOGOUT = false;

  useEffect(() => {
    if (!fontsLoaded || !hasHydrated) return;

    const timer = setTimeout(() => {
      if (DEV_FORCE_LOGOUT) {
        logout();
        router.replace("/(auth)/authentication");
        return;
      }

      if (!isLoggedIn) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.replace("/(auth)/role-select" as any);
        return;
      }

      const role = user?.role ?? "customer";
      const isOnboarded = user?.isOnboarded ?? false;

      if (role === "vendor") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.replace((isOnboarded ? "/(vendor)/(dashboard)" : "/(vendor)/onboarding") as any);
      } else if (role === "rider") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.replace((isOnboarded ? "/(rider)/(queue)" : "/(rider)/onboarding") as any);
      } else {
        // customer and admin both go to customer home for now
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.replace("/(customer)/(home)" as any);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [fontsLoaded, hasHydrated, isLoggedIn]);

  if (!fontsLoaded || !hasHydrated) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.tint} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Image
        source={require("../assets/images/splash/splash-screen.png")}
        style={styles.image}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: 200,
    height: 200,
  },
});
