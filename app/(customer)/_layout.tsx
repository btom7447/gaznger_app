import { Tabs } from "expo-router";
import CustomTabBar from "@/components/ui/global/CustomTabBar";

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        lazy: true, // This is important to keep inactive tabs from unmounting
      }}
    />
  );
}
