import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";

/**
 * Vendor app bottom tab bar.
 *
 * Hard rules from the v6 design brief:
 *   - density tone:    terse       — single-word labels
 *   - order density:   comfortable — slightly larger touch targets
 *
 * 5 tabs, in v6 visual order: Today / Orders / Supplies / Profile / Finance.
 * Icons are Ionicons (outline → filled when active). No active-order
 * badge here unlike the customer bar — vendor's "active order" lives
 * inside the Orders tab itself, not as a route signal.
 */

interface TabConfig {
  /** Matches state.routes[N].name (the route group folder). */
  match: string;
  label: string;
  iconActive: keyof typeof Ionicons.glyphMap;
  iconInactive: keyof typeof Ionicons.glyphMap;
}

const TABS: TabConfig[] = [
  {
    match: "(today)",
    label: "Today",
    iconActive: "home",
    iconInactive: "home-outline",
  },
  {
    match: "(orders)",
    label: "Orders",
    iconActive: "list",
    iconInactive: "list-outline",
  },
  {
    match: "(supplies)",
    label: "Supplies",
    iconActive: "cube",
    iconInactive: "cube-outline",
  },
  {
    match: "(profile)",
    label: "Profile",
    iconActive: "person",
    iconInactive: "person-outline",
  },
  {
    match: "(finance)",
    label: "Finance",
    iconActive: "wallet",
    iconInactive: "wallet-outline",
  },
];

export default function VendorTabBar({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const focusedRouteName = state.routes[state.index]?.name;

  return (
    <View
      style={[
        styles.outerWrap,
        { paddingBottom: Math.max(insets.bottom, 12) },
      ]}
    >
      <View style={styles.bar}>
        {TABS.map((tab) => {
          const isActive = focusedRouteName === tab.match;
          const onPress = () => {
            if (isActive) return;
            const target = state.routes.find((r) => r.name === tab.match);
            if (!target) return;
            navigation.navigate(target.name);
          };
          return (
            <Pressable
              key={tab.match}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isActive }}
              hitSlop={6}
              style={styles.item}
            >
              <Ionicons
                name={isActive ? tab.iconActive : tab.iconInactive}
                size={22}
                color={isActive ? theme.primary : theme.fgMuted}
              />
              <Text
                style={[
                  styles.label,
                  {
                    color: isActive ? theme.primary : theme.fgMuted,
                    fontWeight: isActive ? "700" : "500",
                  },
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    outerWrap: {
      backgroundColor: theme.bg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
      paddingTop: 6,
    },
    bar: {
      flexDirection: "row",
      paddingHorizontal: 4,
    },
    item: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 8,
      gap: 4,
    },
    label: {
      fontSize: 11,
      letterSpacing: 0.1,
    },
  });
