import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { useSessionStore } from "@/store/useSessionStore";
import { getBiometricEnabled } from "@/lib/auth";

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
 * Why this implementation:
 *   - Single hook called from the root layout. AppState listener
 *     attaches once for the whole app lifetime.
 *   - Skipped when the user isn't logged in (signup / pre-PIN flows).
 *   - Skipped while already on the unlock screens (`/unlock/*`) so we
 *     don't infinite-loop a re-auth redirect.
 *   - Routes to `/(auth)/unlock/biometric` when bio is enabled,
 *     `/(auth)/unlock/pin` otherwise. Both screens already exist and
 *     handle the success path back into the app's main stack.
 *
 * Tunables:
 *   - `LOCK_AFTER_MS = 5min` — banking apps are usually 1-5 min. We
 *     pick the higher end because customer flows (placing an order)
 *     often background the app to switch to WhatsApp/payment apps.
 */
const LOCK_AFTER_MS = 5 * 60 * 1000;

export function useAppLockOnResume() {
  const router = useRouter();
  const pathname = usePathname();
  // Track when the app most recently went background. We don't depend
  // on AppState's prior value because we want the timestamp persisted
  // across React re-renders.
  const backgroundedAtRef = useRef<number | null>(null);
  // Cache the latest pathname in a ref so the AppState listener (which
  // captures the closure once) always reads the *current* route.
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const sub = AppState.addEventListener(
      "change",
      async (next: AppStateStatus) => {
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

        // Only lock when there's an actual session to lock. Signup /
        // unauth flows don't have a PIN yet so re-auth is impossible.
        const session = useSessionStore.getState();
        if (!session.isLoggedIn) return;

        // Don't redirect to unlock if we're already on an unlock /
        // auth screen — would cause a navigation loop.
        const path = pathnameRef.current ?? "";
        if (
          path.startsWith("/(auth)/unlock") ||
          path.startsWith("/unlock") ||
          path.startsWith("/(auth)") ||
          path.startsWith("/auth")
        ) {
          return;
        }

        const bio = await getBiometricEnabled();
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
