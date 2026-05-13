import React, { useEffect, useRef } from "react";
import { Stack, usePathname, useRouter } from "expo-router";
import { useTheme } from "@/constants/theme";
import { StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Toaster } from 'sonner-native';
import { PaystackProvider } from "react-native-paystack-webview";
import { useSessionStore } from "@/store/useSessionStore";
import { useWalletStore } from "@/store/useWalletStore";
import { usePendingSignupStore } from "@/store/usePendingSignupStore";
import Constants from "expo-constants";
import { api } from "@/lib/api";
import { connectSocket } from "@/lib/socket";
import { initActionQueue } from "@/lib/actionQueue";
import { getPaystackPublicKey } from "@/lib/paystackKey";
import DebugOverlay from "@/components/ui/global/DebugOverlay";
import ErrorBoundary from "@/components/ui/global/ErrorBoundary";
import RouteProbe from "@/components/ui/global/RouteProbe";
import { useAppLockOnResume } from "@/hooks/useAppLockOnResume";
import { StepUpAuthHost } from "@/components/ui/auth";

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
      verificationStatus: user.verificationStatus,
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
  const pathname = usePathname();

  // App-lock on resume after >5min in background (audit B.9). Hook
  // attaches its AppState listener once for the app lifetime.
  useAppLockOnResume();

  // Stash pathname in a ref so the (one-shot) Zustand subscriber
  // below can read the current route at the moment a logout fires
  // — it doesn't re-bind on every render. Without this, the
  // subscriber would aggressively route to welcome even when the
  // user is actively on an unlock screen and the logout was a
  // transient refresh-token failure.
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // Redirect to auth whenever the session is cleared (e.g. token refresh fails after server restart)
  const bootedAtRef = useRef(Date.now());
  useEffect(() => {
    let prev = useSessionStore.getState().isLoggedIn;
    let detachWallet: (() => void) | undefined;
    const unsub = useSessionStore.subscribe((state) => {
      if (prev && !state.isLoggedIn && state.hasHydrated) {
        const path = pathnameRef.current ?? "";
        const sinceBoot = Date.now() - bootedAtRef.current;
        // Tolerance window: if a logout fires within the first 10s of
        // app boot OR while the user is on an unlock screen, it's
        // almost certainly a transient refresh-token glitch (stale
        // access token + a refresh that hit reuse-detection because
        // the previous app session didn't persist its rotation).
        // Route to PIN unlock so the user can re-mint via /auth/login
        // with their cached PIN, NOT welcome (which forces a full
        // re-OTP signup).
        const onUnlock =
          path.includes("/(auth)/unlock") || path.includes("/unlock/");
        const earlyBoot = sinceBoot < 10_000;
        if (onUnlock || earlyBoot) {
          router.replace("/(auth)/unlock/pin" as never);
        } else {
          router.replace("/(auth)/welcome");
        }
        detachWallet?.();
        detachWallet = undefined;
        // Security hygiene — drop any half-finished signup draft so a
        // fresh user signing in on the same device doesn't accidentally
        // resume the previous account's verification token, role, or
        // PIN. Idempotent: a no-op when the draft is already empty.
        usePendingSignupStore.getState().reset();
      }
      // Register device token, connect socket, sync profile + wallet on login.
      // Every one of these is non-blocking — if any throws asynchronously
      // (Hermes / native-bridge / network), we trap it here so the React
      // tree above doesn't unmount. Without these guards a failure in
      // registerDeviceToken or syncWalletAndSubscribe surfaces as the
      // post-OTP blank screen / RouteProbe-disappears bug.
      if (!prev && state.isLoggedIn && state.hasHydrated) {
        try { registerDeviceToken(); } catch { /* swallow */ }
        try { connectSocket(state.accessToken); } catch { /* swallow */ }
        try { initActionQueue(); } catch { /* swallow */ }
        try { syncUserSession(); } catch { /* swallow */ }
        try {
          detachWallet?.();
          detachWallet = syncWalletAndSubscribe();
        } catch { /* swallow */ }
      }
      prev = state.isLoggedIn;
    });
    // Same flow on mount when the user is already logged in (app resume).
    //
    // Critical: we DO NOT call syncUserSession() on cold mount when
    // the user has a PIN configured. Cold mount routes to
    // /(auth)/unlock/biometric (or /unlock/pin) BEFORE the user has
    // proven local auth — firing /auth/me at that moment risks a 401
    // (access token expired overnight) → refreshTokens() failure →
    // logout() → subscriber routes to welcome AS THE USER IS
    // AUTHENTICATING via biometric. The fingerprint succeeds, but
    // they land on welcome anyway. We let unlock complete first; the
    // unlock screens (PIN flow especially) re-mint the session via
    // /auth/login, after which sync runs cleanly.
    const session = useSessionStore.getState();
    if (session.isLoggedIn) {
      try { registerDeviceToken(); } catch { /* swallow */ }
      try { connectSocket(session.accessToken); } catch { /* swallow */ }
      // Phase 10 — wire the offline action queue to drain whenever
      // the socket comes live. Idempotent — calling on every mount
      // is fine.
      try { initActionQueue(); } catch { /* swallow */ }
      if (!session.user?.hasPin) {
        // No PIN configured — no unlock screen on cold start, so the
        // network calls below are safe to fire immediately. With a
        // PIN configured we defer them until the unlock screen
        // promotes the user via /auth/login (which mints a fresh
        // access + refresh pair). Without this guard, ANY 401 here
        // (e.g. expired access token + a stale refresh in
        // SecureStore) trips refreshTokens() → logout() → the
        // session subscriber routes to welcome WHILE the user is
        // mid-fingerprint.
        try { syncUserSession(); } catch { /* swallow */ }
        try { detachWallet = syncWalletAndSubscribe(); } catch { /* swallow */ }
      }
    }
    return () => {
      unsub();
      detachWallet?.();
    };
  }, []);

  // PaystackProvider on react-native-paystack-webview throws when
  // mounted with an empty publicKey. Don't render it until we have
  // either an env-baked fallback OR a server-supplied key. Without
  // this guard a fresh APK install (no key in EAS env, no /initialize
  // call yet) crashes the root tree synchronously, which surfaces as
  // the post-OTP blank-screen / RouteProbe-disappears bug.
  const paystackKey = getPaystackPublicKey();
  const paystackReady = paystackKey.length > 0;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          {paystackReady ? (
            <PaystackProvider publicKey={paystackKey} currency="NGN" debug={__DEV__}>
              <RootChildren theme={theme} />
            </PaystackProvider>
          ) : (
            <RootChildren theme={theme} />
          )}
        </SafeAreaProvider>
        <Toaster richColors position="top-center" toastOptions={{ style: { borderRadius: 14 } }} />
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

function RootChildren({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
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
        {/* Main navigators.
            Every route group reachable from the bootstrap router
            MUST be declared here. In dev (Metro) Expo Router
            auto-discovers file-based routes; in production builds
            the bundler tree-shakes anything not declared on the
            Stack, which surfaces as a blank/white screen on first
            navigation (because the screen doesn't exist in the
            registered Stack even though the JS file is in the
            bundle). */}
        <Stack.Screen name="index" />
        <Stack.Screen name="modal" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(customer)" />
        <Stack.Screen name="(rider)" />
        <Stack.Screen name="(vendor)" />
        <Stack.Screen name="(screens)" />
        <Stack.Screen name="(legal)" />
      </Stack>
      {/* Phase 6 debug overlay — invisible long-press hit-area in
          the top-left corner. */}
      <DebugOverlay />
      {/* TEMP — diagnose routing issue in prod build. Remove
          alongside RouteProbe.tsx once fixed. */}
      <RouteProbe />
      {/* Step-up auth host — listens to a Zustand store for any
          `requireStepUpAuth({ reason })` call and shows a PIN-entry
          sheet. Biometric is tried first inside the helper; the
          sheet is only the fallback. */}
      <StepUpAuthHost />
    </BottomSheetModalProvider>
  );
}