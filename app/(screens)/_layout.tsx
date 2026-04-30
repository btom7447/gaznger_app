import { Stack } from "expo-router";

export default function ScreensLayout() {
  return (
    <Stack>
      <Stack.Screen name="address-book" options={{ headerShown: false }} />
      <Stack.Screen name="notification" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen name="personal-info" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="security-privacy" options={{ headerShown: false }} />
      <Stack.Screen name="help-support" options={{ headerShown: false }} />
      <Stack.Screen name="contact-support" options={{ headerShown: false }} />
      <Stack.Screen name="points" options={{ headerShown: false }} />
      <Stack.Screen name="payment-method" options={{ headerShown: false }} />
      <Stack.Screen name="saved-cylinder" options={{ headerShown: false }} />
      <Stack.Screen name="change-pin" options={{ headerShown: false }} />
      <Stack.Screen name="active-sessions" options={{ headerShown: false }} />
      <Stack.Screen
        name="notifications-customer"
        options={{
          headerShown: false,
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen name="_primitives-preview" options={{ headerShown: false }} />
    </Stack>
  );
}
