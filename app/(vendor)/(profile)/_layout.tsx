import { Stack } from "expo-router";
import React from "react";

export default function VendorProfileLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="team" />
      <Stack.Screen name="invite" />
      <Stack.Screen name="stations" />
      <Stack.Screen name="station-add" />
      <Stack.Screen name="station/[id]" />
      <Stack.Screen name="tanks" />
    </Stack>
  );
}
