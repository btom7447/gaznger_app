import { Stack } from "expo-router";
import React from "react";

/**
 * Order group Stack. Routes registered in flow order for clarity:
 *
 *   Liquid + LPG-Refill: index → delivery → stations → payment → receipt
 *   LPG-Swap:            index → cylinder → photo → delivery → schedule →
 *                        stations → payment → receipt
 *
 * Stack ordering here is purely declarative — actual navigation is driven
 * by `router.push` calls in each screen.
 *
 * `history` and `[id]` are sibling routes that live under the order
 * group too — per locked decision (10b), order history stays in the
 * order folder since it's part of the order flow. They're NOT part of
 * the checkout flow, so the tab bar should remain visible on those
 * screens (handled by FULLBLEED_EXCLUDE in CustomTabBar).
 */
export default function OrderLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: "Order" }} />
      <Stack.Screen name="cylinder" />
      <Stack.Screen name="photo" />
      <Stack.Screen name="delivery" />
      <Stack.Screen name="schedule" />
      <Stack.Screen name="stations" />
      <Stack.Screen name="payment" />
      <Stack.Screen name="receipt" />
      <Stack.Screen name="history" options={{ title: "Your orders" }} />
      <Stack.Screen name="[id]" options={{ title: "Order" }} />
    </Stack>
  );
}
