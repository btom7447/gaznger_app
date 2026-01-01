// app/index.tsx
import React, { useEffect } from "react";
import { View, Image, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/constants/theme";
import { useAppFonts } from "@/constants/useFonts";

export default function SplashScreen() {
  const router = useRouter();
  const theme = useTheme();
  const fontsLoaded = useAppFonts();

  // Hardcoded user login state for now
  const loggedIn = false; // change to true to simulate logged-in user

  useEffect(() => {
    const timer = setTimeout(() => {
      if (loggedIn) {
        router.replace("/(tabs)/(home)");
      } else {
        router.replace("/(auth)/onboarding"); // go to onboarding if not
      }
    }, 2000); // 2 seconds splash

    return () => clearTimeout(timer);
  }, []);

  if (!fontsLoaded) {
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
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  image: { width: 200, height: 200 },
});
