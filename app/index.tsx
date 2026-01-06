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

  const { isLoggedIn, hasHydrated } = useSessionStore();

  /**
   * 🔧 DEV ONLY
   * Toggle this to force onboarding flow
   */
  const FORCE_ONBOARDING = false;

  useEffect(() => {
    if (!fontsLoaded || !hasHydrated) return;

    const timer = setTimeout(() => {
      if (FORCE_ONBOARDING) {
        router.replace("/(auth)/onboarding");
        return;
      }

      if (isLoggedIn) {
        router.replace("/(tabs)/(home)");
      } else {
        router.replace("/(auth)/onboarding");
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
