import { Stack } from "expo-router";
import React from "react";

export default function BulkOrderDetailLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="reconcile" />
      <Stack.Screen name="dispute" />
    </Stack>
  );
}
