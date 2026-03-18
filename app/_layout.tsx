import React, { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { useTheme } from "@/constants/theme";
import { StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Toaster } from 'sonner-native';
import { useSessionStore } from "@/store/useSessionStore";

export default function RootLayout() {
  const theme = useTheme();
  const router = useRouter();

  // Redirect to auth whenever the session is cleared (e.g. token refresh fails after server restart)
  useEffect(() => {
    let prev = useSessionStore.getState().isLoggedIn;
    const unsub = useSessionStore.subscribe((state) => {
      if (prev && !state.isLoggedIn && state.hasHydrated) {
        router.replace("/(auth)/authentication");
      }
      prev = state.isLoggedIn;
    });
    return unsub;
  }, []);

  return (
    <>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar
            barStyle={theme.mode === "dark" ? "light-content" : "dark-content"}
            backgroundColor={theme.background}
          />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.background },
            }}
          >
            {/* Main navigators */}
            <Stack.Screen name="index" />
            <Stack.Screen name="modal" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(screens)" />
            <Stack.Screen name="(legal)/privacy" />
            <Stack.Screen name="(legal)/terms" />
          </Stack>
        </SafeAreaProvider>
        <Toaster richColors position="top-center" toastOptions={{ style: { borderRadius: 14 } }} />
      </GestureHandlerRootView>
    </>
  );
}