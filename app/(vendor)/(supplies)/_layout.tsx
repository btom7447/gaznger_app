import { Stack } from "expo-router";
import React from "react";

export default function VendorSuppliesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="new" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="[id]/reconcile" />
      <Stack.Screen name="[id]/dispute" />
    </Stack>
  );
}
