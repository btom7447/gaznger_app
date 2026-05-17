import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useRouter } from "expo-router";
import { useSessionStore } from "@/store/useSessionStore";
import { getBiometricEnabled } from "@/lib/auth";
import { getCurrentPathname } from "@/lib/pathnameMirror";

/**
 * App-lock on resume.
 *
 * SECURITY: banking-grade norm. When the app comes back to foreground
 * after being backgrounded for more than `LOCK_AFTER_MS`, force the
 * user through a re-auth screen (biometric → PIN fallback). Without
 * this, a stolen unlocked phone has the entire JWT-access-token
 * lifetime (15 min) of unattended access to a customer's order +
 * payment methods.
 *
 * Why we read pathname from the module-level mirror instead of
 * subscribing via usePathname(): this hook is called inside
 * RootLayout. Any pathname dependency at root level forces the
 * <Stack> to re-render on every navigation, which in turn re-mounts
 * the child screens and tears down GestureHandlerRootView — the
 * post-OTP blank-screen bug. <PathnameTracker /> in app/_layout.tsx
 * mirrors the pathname into a module variable; we read that here
 * without subscribing.
 *
 * Tunables:
 *   - `LOCK_AFTER_MS = 5min`
 */
const LOCK_AFTER_MS = 5 * 60 * 1000;

export function useAppLockOnResume() {
  const router = useRouter();
  const backgroundedAtRef = useRef<number | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener(
      "change",
      async (next: AppStateStatus) => {
        console.log("[appLockOnResume] AppState=" + next);
        if (next === "background" || next === "inactive") {
          backgroundedAtRef.current = Date.now();
          return;
        }
        if (next !== "active") return;
        const since = backgroundedAtRef.current;
        backgroundedAtRef.current = null;
        if (since == null) return;
        const elapsed = Date.now() - since;
        if (elapsed < LOCK_AFTER_MS) return;

        const session = useSessionStore.getState();
        if (!session.isLoggedIn) return;

        // Read the current pathname from the module-level mirror.
        const path = getCurrentPathname();
        if (
          path.startsWith("/(auth)/unlock") ||
          path.startsWith("/unlock") ||
          path.startsWith("/(auth)") ||
          path.startsWith("/auth")
        ) {
          return;
        }

        const bio = await getBiometricEnabled();
        console.log("[appLockOnResume] redirecting to unlock, bio=" + bio);
        if (bio) {
          router.replace("/(auth)/unlock/biometric" as never);
        } else {
          router.replace("/(auth)/unlock/pin" as never);
        }
      }
    );
    return () => sub.remove();
  }, [router]);
}
