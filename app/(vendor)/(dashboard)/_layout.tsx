import React, { useCallback } from "react";
import { Tabs } from "expo-router";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useTheme } from "@/constants/theme";

type TabConfig = {
  route: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  iconFocused: keyof typeof MaterialIcons.glyphMap;
  label: string;
};

// Profile is intentionally excluded — it lives behind the header avatar button.
// Plant is last (far right) per product spec.
const TABS: TabConfig[] = [
  {
    route: "index",
    icon: "grid-view",
    iconFocused: "grid-view",
    label: "Overview",
  },
  {
    route: "orders",
    icon: "receipt-long",
    iconFocused: "receipt-long",
    label: "Orders",
  },
  {
    route: "inventory",
    icon: "inventory",
    iconFocused: "inventory",
    label: "Inventory",
  },
  {
    route: "earnings",
    icon: "account-balance-wallet",
    iconFocused: "account-balance-wallet",
    label: "Earnings",
  },
  {
    route: "payout",
    icon: "payments",
    iconFocused: "payments",
    label: "Payout",
  },

  {
    route: "plant",
    icon: "oil-barrel",
    iconFocused: "oil-barrel",
    label: "Plant",
  },
];


interface TabItemProps {
  route: { key: string; name: string };
  isFocused: boolean;
  navigation: BottomTabBarProps["navigation"];
}

function VendorTabItem({ route, isFocused, navigation }: TabItemProps) {
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
    <TouchableOpacity
      key={route.key}
      onPress={onPress}
      activeOpacity={0.8}
      style={styles.tabItem}
    >
      <View style={styles.iconPillClip}>
        <View style={[styles.iconPill, isFocused && { backgroundColor: theme.primary }]}>
          <MaterialIcons
            name={isFocused ? tab.iconFocused : tab.icon}
            size={20}
            color={isFocused ? "#FFFFFF" : theme.tabIconDefault}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function VendorTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  // Only render routes that are explicitly listed in TABS (hides profile, etc.)
const visibleRoutes = TABS.map((tab) =>
  state.routes.find((r) => r.name === tab.route),
).filter(Boolean) as typeof state.routes;
  return (
    <View style={[styles.outerWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={[styles.pill, { backgroundColor: theme.tab }]}>
        {visibleRoutes.map((route) => (
          <VendorTabItem
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

export default function VendorDashboardLayout() {
  return (
    <Tabs
      tabBar={(props) => <VendorTabBar {...props} />}
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
  iconPill: { width: 44, height: 34, alignItems: "center", justifyContent: "center" },
});
