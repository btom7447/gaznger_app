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
    </Stack>
  );
}
