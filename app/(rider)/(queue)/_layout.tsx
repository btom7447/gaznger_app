import React, { useCallback } from "react";
import { Tabs } from "expo-router";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
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

const TABS: TabConfig[] = [
  { route: "index", icon: "bicycle-outline", iconFocused: "bicycle", label: "Queue" },
  { route: "history", icon: "time-outline", iconFocused: "time", label: "History" },
  { route: "earnings", icon: "wallet-outline", iconFocused: "wallet", label: "Earnings" },
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
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={styles.tabItem}
    >
      <View style={[styles.pill, isFocused && { backgroundColor: theme.primary }]}>
        <Ionicons
          name={isFocused ? tab.iconFocused : tab.icon}
          size={20}
          color={isFocused ? "#FFFFFF" : theme.tabIconDefault}
        />
      </View>
      <Text
        style={[
          styles.label,
          {
            color: isFocused ? "#FFFFFF" : theme.tabIconDefault,
            fontWeight: isFocused ? "700" : "400",
          },
        ]}
      >
        {tab.label}
      </Text>
    </TouchableOpacity>
  );
}

function RiderTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <View
      style={[
        styles.outerWrap,
        { backgroundColor: theme.tab, paddingBottom: Math.max(insets.bottom, 10) },
      ]}
    >
      <View style={styles.bar}>
        {state.routes.map((route, index) => (
          <RiderTabItem
            key={route.key}
            route={route}
            isFocused={state.index === index}
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
  outerWrap: { paddingTop: 10 },
  bar: { flexDirection: "row", marginHorizontal: 16, borderRadius: 18, overflow: "hidden" },
  tabItem: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 6 },
  pill: { width: 46, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  label: { marginTop: 3, fontSize: 11, letterSpacing: 0.2 },
});
