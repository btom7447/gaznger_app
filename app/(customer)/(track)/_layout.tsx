import { Stack } from "expo-router";
import React from "react";

export default function TrackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: "Track" }} />
      <Stack.Screen name="arrival" />
      <Stack.Screen name="handoff" />
      <Stack.Screen name="delivered" />
      <Stack.Screen name="rate" />
      <Stack.Screen name="complete" />
    </Stack>
  );
}
