import { Stack } from "expo-router";
import React from "react";

export default function HistoryLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: "Order History" }} />
    </Stack>
  );
}
