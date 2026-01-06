import { Stack } from "expo-router";

export default function ScreensLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="address-book"
        options={{ headerShown: false, title: "Address Book " }}
      />
      <Stack.Screen
        name="notification"
        options={{ headerShown: false, title: "Notifications" }}
      />
      <Stack.Screen
        name="profile"
        options={{ headerShown: false, title: "Profile" }}
      />
    </Stack>
  );
}
