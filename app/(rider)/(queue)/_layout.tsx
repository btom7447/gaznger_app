import React, { useCallback } from "react";
import { Tabs } from "expo-router";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useTheme } from "@/constants/theme";

type TabConfig = {
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
  label: string;
};

// Profile is intentionally excluded — accessed via the header avatar button.
const TABS: TabConfig[] = [
  { route: "index", icon: "bicycle-outline", iconFocused: "bicycle", label: "Queue" },
  { route: "track", icon: "navigate-outline", iconFocused: "navigate", label: "Track" },
  { route: "earnings", icon: "wallet-outline", iconFocused: "wallet", label: "Earnings" },
  { route: "payout", icon: "cash-outline", iconFocused: "cash", label: "Payout" },
];

interface TabItemProps {
  route: { key: string; name: string };
  isFocused: boolean;
  navigation: BottomTabBarProps["navigation"];
}

function RiderTabItem({ route, isFocused, navigation }: TabItemProps) {
  const theme = useTheme();
  const tab = TABS.find((t) => route.name === t.route) ?? TABS[0];

  const onPress = useCallback(() => {
    const event = navigation.emit({
      type: "tabPress",
      target: route.key,
      canPreventDefault: true,
    });
    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  }, [isFocused, navigation, route.key, route.name]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.tabItem}>
      <View style={styles.iconPillClip}>
        <View style={[styles.iconPill, isFocused && { backgroundColor: theme.primary }]}>
          <Ionicons
            name={isFocused ? tab.iconFocused : tab.icon}
            size={20}
            color={isFocused ? "#FFFFFF" : theme.tabIconDefault}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function RiderTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  // Only render the 3 listed tabs (hides profile and any other routes)
  const visibleRoutes = TABS.map((tab) =>
    state.routes.find((r) => r.name === tab.route)
  ).filter(Boolean) as typeof state.routes;

  return (
    <View style={[styles.outerWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={[styles.pill, { backgroundColor: theme.tab }]}>
        {visibleRoutes.map((route) => (
          <RiderTabItem
            key={route.key}
            route={route}
            isFocused={state.routes[state.index].name === route.name}
            navigation={navigation}
          />
        ))}
      </View>
    </View>
  );
}

export default function RiderQueueLayout() {
  return (
    <Tabs
      tabBar={(props) => <RiderTabBar {...props} />}
      screenOptions={{ headerShown: false, lazy: true }}
    />
  );
}

const styles = StyleSheet.create({
  outerWrap: { position: "absolute", bottom: 0, left: 0, right: 0, alignItems: "center" },
  pill: {
    flexDirection: "row",
    borderRadius: 40,
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  tabItem: { alignItems: "center", justifyContent: "center" },
  iconPillClip: { borderRadius: 17, overflow: "hidden" },
  iconPill: { width: 48, height: 34, alignItems: "center", justifyContent: "center" },
});
