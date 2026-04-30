import React, { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { useTheme } from "@/constants/theme";
import { StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Toaster } from 'sonner-native';
import { PaystackProvider } from "react-native-paystack-webview";
import { useSessionStore } from "@/store/useSessionStore";
import { useWalletStore } from "@/store/useWalletStore";
import Constants from "expo-constants";
import { api } from "@/lib/api";
import { connectSocket } from "@/lib/socket";
import { getPaystackPublicKey } from "@/lib/paystackKey";
import DebugOverlay from "@/components/ui/global/DebugOverlay";

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
      lastPaystackAuth: user.lastPaystackAuth,
      accountStatus: user.accountStatus,
      withdrawalHold: user.withdrawalHold,
      lpgOrderCount: user.lpgOrderCount,
      savedCylinder: user.savedCylinder,
      preferences: user.preferences,
      hasPin: user.hasPin,
      addressBook: Array.isArray(user.addressBook) ? user.addressBook : undefined,
    });
  } catch {
    // Non-fatal — stale session still works; token refresh / 401 logout is handled by api wrapper
  }
}

/**
 * Pull wallet balance + wire socket subscription on login. Wallet socket
 * pushes (`wallet:update`) update the store automatically; this kicks
 * off the initial GET so balances are warm before any screen reads them.
 */
function syncWalletAndSubscribe(): () => void {
  const wallet = useWalletStore.getState();
  wallet.refresh();
  return wallet.attachSocket();
}

export default function RootLayout() {
  const theme = useTheme();
  const router = useRouter();

  // Redirect to auth whenever the session is cleared (e.g. token refresh fails after server restart)
  useEffect(() => {
    let prev = useSessionStore.getState().isLoggedIn;
    let detachWallet: (() => void) | undefined;
    const unsub = useSessionStore.subscribe((state) => {
      if (prev && !state.isLoggedIn && state.hasHydrated) {
        router.replace("/(auth)/authentication");
        detachWallet?.();
        detachWallet = undefined;
      }
      // Register device token, connect socket, sync profile + wallet on login
      if (!prev && state.isLoggedIn && state.hasHydrated) {
        registerDeviceToken();
        connectSocket(state.accessToken);
        syncUserSession();
        detachWallet?.();
        detachWallet = syncWalletAndSubscribe();
      }
      prev = state.isLoggedIn;
    });
    // Same flow on mount when the user is already logged in (app resume)
    const session = useSessionStore.getState();
    if (session.isLoggedIn) {
      registerDeviceToken();
      connectSocket(session.accessToken);
      syncUserSession();
      detachWallet = syncWalletAndSubscribe();
    }
    return () => {
      unsub();
      detachWallet?.();
    };
  }, []);

  return (
    <>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <PaystackProvider publicKey={getPaystackPublicKey()} currency="NGN" debug={__DEV__}>
            <BottomSheetModalProvider>
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
              {/* Phase 6 debug overlay — invisible long-press hit-area
                  in the top-left corner. Mounted at root so it overlays
                  every screen. Production builds keep it because the
                  cost is one Pressable + one ring buffer; the modal
                  only renders when the user deliberately opens it. */}
              <DebugOverlay />
            </BottomSheetModalProvider>
          </PaystackProvider>
        </SafeAreaProvider>
        <Toaster richColors position="top-center" toastOptions={{ style: { borderRadius: 14 } }} />
      </GestureHandlerRootView>
    </>
  );
}