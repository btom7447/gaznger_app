import React, { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { useTheme } from "@/constants/theme";
import { StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Toaster } from 'sonner-native';
import { useSessionStore } from "@/store/useSessionStore";
import Constants from "expo-constants";
import { api } from "@/lib/api";
import { connectSocket } from "@/lib/socket";

const isExpoGo = Constants.appOwnership === "expo";

/**
 * Load expo-notifications and register the device token.
 * The entire module is loaded via async import() so that Expo Go never
 * touches the native push code (which crashes since SDK 53).
 */
async function registerDeviceToken() {
  if (isExpoGo) return;
  try {
    const { registerDeviceToken: register } = await import("@/lib/notifications");
    await register();
  } catch {
    // Non-fatal — app works without push
  }
}

/** Refresh the persisted session with the latest data from the server. */
async function syncUserSession() {
  const { isLoggedIn, updateUser } = useSessionStore.getState();
  if (!isLoggedIn) return;
  try {
    const user = await api.get<any>("/auth/me");
    updateUser({
      displayName: user.displayName,
      phone: user.phone,
      gender: user.gender,
      profileImage: user.profileImage,
      points: user.points,
      defaultAddress: user.defaultAddress ?? null,
      isOnboarded: user.isOnboarded,
    });
  } catch {
    // Non-fatal — stale session still works; token refresh / 401 logout is handled by api wrapper
  }
}

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
      // Register device token, connect socket, and sync profile whenever user logs in
      if (!prev && state.isLoggedIn && state.hasHydrated) {
        registerDeviceToken();
        connectSocket(state.accessToken);
        syncUserSession();
      }
      prev = state.isLoggedIn;
    });
    // Also register, connect socket, and sync profile if already logged in on mount (app resume)
    const session = useSessionStore.getState();
    if (session.isLoggedIn) {
      registerDeviceToken();
      connectSocket(session.accessToken);
      syncUserSession();
    }
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