import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { useTheme } from "@/constants/theme";
import { StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context"; 
import Toast from 'react-native-toast-message';
import { zustandAsyncStorage } from "@/store/ZustandAsyncStorage";

export default function RootLayout() {

  // useEffect(() => {
  //   const clearStore = async () => {
  //     await zustandAsyncStorage.removeItem("order-store");
  //     console.log("🧹 order-store cleared");
  //   };

  //   clearStore();
  // }, []);

  const theme = useTheme();

  return (
    <>
      <Toast />
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar
            barStyle={theme.mode === "dark" ? "light-content" : "dark-content"}
            backgroundColor={theme.background}
          />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.background },
            }}
          >
            {/* Main navigators */}
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(modal)" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(legal)" />
            <Stack.Screen name="(stack)" />
          </Stack>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </>
  );
}