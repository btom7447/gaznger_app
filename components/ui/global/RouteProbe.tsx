import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname, useSegments } from "expo-router";
import { useSessionStore } from "@/store/useSessionStore";

/**
 * TEMPORARY visible probe — prints the current Expo Router pathname +
 * segments + session-store state in a fixed-position banner at the top
 * of every screen. Used to diagnose "blank screen after sign-in"
 * issues in production builds where we can't see device logs.
 *
 * Remove this component (and its mount in app/_layout.tsx) once the
 * routing issue is fixed.
 */
export function RouteProbe() {
  const pathname = usePathname();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const isLoggedIn = useSessionStore((s) => s.isLoggedIn);
  const hasHydrated = useSessionStore((s) => s.hasHydrated);
  const user = useSessionStore((s) => s.user);

  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { top: insets.top }]}
    >
      <Text style={styles.line}>path: {pathname}</Text>
      <Text style={styles.line}>seg: {JSON.stringify(segments)}</Text>
      <Text style={styles.line}>
        hyd:{String(hasHydrated)} log:{String(isLoggedIn)} role:
        {String(user?.role)} pin:{String((user as any)?.hasPin)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "rgba(255, 59, 48, 0.92)",
    zIndex: 9999,
  },
  line: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "monospace",
    fontWeight: "700",
  },
});

export default RouteProbe;
