import React, { useEffect, useMemo, useRef } from "react";
import { Stack, usePathname, useRouter } from "expo-router";
import { useTheme } from "@/constants/theme";
import { AppState, StatusBar } from "react-native";
import { enableFreeze, enableScreens } from "react-native-screens";

// Keep react-native-screens enabled so previous screens unmount on
// navigation. The earlier workaround disabled screens entirely, which
// left the auth stack mounted after router.replace into the customer
// or vendor home — visible as a double-rendered home. Freezing stays
// off because it (not the native-screen optimisation) was what clashed
// with Fabric's commit phase on the OTP → unlock/pin transition.
enableScreens(true);
enableFreeze(false);
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
import { getCurrentPathname, setCurrentPathname } from "@/lib/pathnameMirror";
import DebugOverlay from "@/components/ui/global/DebugOverlay";
import ErrorBoundary from "@/components/ui/global/ErrorBoundary";
import { useAppLockOnResume } from "@/hooks/useAppLockOnResume";
import { StepUpAuthHost } from "@/components/ui/auth";
import ChatUnreadBridge from "@/components/ui/global/ChatUnreadBridge";

const isExpoGo = Constants.appOwnership === "expo";

// Global error hooks — surface ANY uncaught error/rejection to adb so
// we can see what's killing the JS surface. Without these the surface
// can tear down silently because the runtime swallows the throw.
if (typeof ErrorUtils !== "undefined") {
  const orig = ErrorUtils.getGlobalHandler?.();
  ErrorUtils.setGlobalHandler((err: Error, isFatal?: boolean) => {
    console.log(
      "[GLOBAL ERROR] fatal=" + !!isFatal +
        " name=" + (err?.name ?? "?") +
        " message=" + (err?.message ?? "?") +
        " stack=" + (err?.stack?.split("\n").slice(0, 5).join(" | ") ?? "?")
    );
    if (orig) orig(err, isFatal);
  });
}
// PROBE: intercept console.error too. React calls console.error for
// internal "tried to render Suspense fallback" / "Maximum update depth"
// / "Element type invalid" warnings BEFORE the surface tears down. The
// original ErrorUtils handler only catches throws, not these warnings.
const __origConsoleError = console.error;
console.error = (...args: any[]) => {
  try {
    console.log(
      "[CONSOLE.ERROR] " +
        args
          .map((a) =>
            a instanceof Error
              ? (a.message + " | " + (a.stack ?? "").split("\n").slice(0, 4).join(" / "))
              : typeof a === "string"
              ? a
              : (() => {
                  try { return JSON.stringify(a); } catch { return String(a); }
                })()
          )
          .join(" ")
          .slice(0, 600)
    );
  } catch { /* never throw from logger */ }
  __origConsoleError(...args);
};
// PROBE: catch promise rejections that bubble past the Hermes tracker.
if (typeof global !== "undefined") {
  // @ts-ignore
  const g: any = global;
  if (typeof g.addEventListener === "function") {
    try {
      g.addEventListener("unhandledrejection", (ev: any) => {
        const reason = ev?.reason;
        console.log(
          "[UNHANDLED REJECTION via addEventListener] " +
            (reason?.message ?? String(reason))
        );
      });
    } catch { /* not supported on Hermes */ }
  }
}
// @ts-ignore - global
if (typeof global !== "undefined") {
  // @ts-ignore
  const g: any = global;
  if (g.HermesInternal?.enablePromiseRejectionTracker) {
    g.HermesInternal.enablePromiseRejectionTracker({
      allRejections: true,
      onUnhandled: (id: number, err: any) => {
        console.log(
          "[UNHANDLED REJECTION] id=" + id +
            " name=" + (err?.name ?? "?") +
            " message=" + (err?.message ?? String(err))
        );
      },
    });
  }
}

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

/**
 * Subscribes to the Expo Router pathname and mirrors it into the
 * shared `lib/pathnameMirror` module. This is the ONLY component in
 * the entire app that should call `usePathname()` at root-mount
 * altitude — every other consumer reads via getCurrentPathname() so
 * pathname changes don't ripple a re-render up to RootLayout and
 * cause <Stack> to remount mid-navigation. (The post-OTP blank
 * screen bug — adb log showed root render #7 at the exact moment
 * unlock/pin mounted, which tore down the gesture handler.)
 */
function PathnameTracker() {
  const pathname = usePathname();
  useEffect(() => {
    setCurrentPathname(pathname);
  }, [pathname]);
  return null;
}

let __rootRenders = 0;
export default function RootLayout() {
  __rootRenders += 1;
  console.log("[root] render #" + __rootRenders);
  const theme = useTheme();
  const router = useRouter();

  // PROBE: every AppState transition. If the OS is putting us to
  // "inactive" right after OTP→PIN nav (e.g. native dialog stealing
  // focus), we'll see it here even though useAppLockOnResume's own
  // logic only acts on >5min backgrounds.
  useEffect(() => {
    console.log("[root] AppState start=" + AppState.currentState);
    const sub = AppState.addEventListener("change", (next) => {
      console.log("[root] AppState change → " + next);
    });
    return () => sub.remove();
  }, []);

  // App-lock on resume after >5min in background (audit B.9). Hook
  // attaches its AppState listener once for the app lifetime.
  useAppLockOnResume();

  // Redirect to auth whenever the session is cleared (e.g. token refresh fails after server restart)
  const bootedAtRef = useRef(Date.now());
  useEffect(() => {
    let prev = useSessionStore.getState().isLoggedIn;
    let detachWallet: (() => void) | undefined;
    const unsub = useSessionStore.subscribe((state) => {
      if (prev && !state.isLoggedIn && state.hasHydrated) {
        const path = getCurrentPathname();
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

  // PaystackProvider key: read ONCE on initial mount and cache. If the
  // server-supplied key arrives later (via /payments/initialize), it
  // gets stored in the module-level cache but we deliberately do NOT
  // re-read here on subsequent renders. Reading on every render
  // caused the tree-shape to flip (Paystack-wrapped → bare → wrapped)
  // which unmounted GestureHandlerRootView and every child below it.
  // Smoking-gun adb log:
  //   [GESTURE HANDLER] Tearing down gesture handler registered for root view
  // fired right after OTP success. The cure is structural stability:
  // one Paystack wrapper for the lifetime of the app, with a dummy
  // placeholder key if needed.
  //
  // PaystackProvider accepts an empty string at mount; the actual
  // publicKey is re-supplied per-checkout via the openTransaction()
  // call's `publicKey` override on the latest version of the SDK. If
  // your version doesn't support that, the inner Paystack flow falls
  // back to the cached key on first charge — but the root tree stays
  // structurally identical.
  const paystackInitialKey = useMemo(() => getPaystackPublicKey() || "pk_test_PLACEHOLDER", []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <PaystackProvider publicKey={paystackInitialKey} currency="NGN" debug={__DEV__}>
            <RootChildren theme={theme} />
          </PaystackProvider>
        </SafeAreaProvider>
        <Toaster richColors position="top-center" toastOptions={{ style: { borderRadius: 14 } }} />
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const RootChildren = React.memo(function RootChildren({
  theme,
}: {
  theme: ReturnType<typeof useTheme>;
}) {
  console.log("[root children] render");
  useEffect(() => {
    console.log("[root children] MOUNT");
    return () => console.log("[root children] UNMOUNT");
  }, []);
  return (
    <BottomSheetModalProvider>
      <PathnameTracker />
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
      {/* Step-up auth host — listens to a Zustand store for any
          `requireStepUpAuth({ reason })` call and shows a PIN-entry
          sheet. Biometric is tried first inside the helper; the
          sheet is only the fallback. */}
      <StepUpAuthHost />
      <ChatUnreadBridge />
    </BottomSheetModalProvider>
  );
});