import { Stack } from "expo-router";
import React from "react";

export default function WalletLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: "Wallet" }} />
      <Stack.Screen name="topup" options={{ presentation: "modal" }} />
    </Stack>
  );
}
