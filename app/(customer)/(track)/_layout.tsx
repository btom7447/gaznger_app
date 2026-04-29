import { Stack } from "expo-router";
import React from "react";

export default function TrackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: "Track" }} />
      <Stack.Screen name="arrival" />
      <Stack.Screen name="handoff" />
      <Stack.Screen name="delivered" />
      <Stack.Screen
        name="rate"
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen name="complete" />
    </Stack>
  );
}
