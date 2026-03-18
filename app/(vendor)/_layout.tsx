import React from "react";
import { Stack } from "expo-router";
import { useTheme } from "@/constants/theme";

export default function VendorLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.background },
        animation: "slide_from_right",
      }}
    />
  );
}
