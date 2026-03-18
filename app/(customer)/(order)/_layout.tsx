import { Stack } from "expo-router";
import React from "react";

export default function OrderLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: "Order" }} />
      <Stack.Screen name="delivery" />
      <Stack.Screen name="stations" />
      <Stack.Screen name="payment" />
      <Stack.Screen name="receipt" />
    </Stack>
  );
}
