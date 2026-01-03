import React, { useCallback } from "react";
import {
  View,
  TouchableOpacity,
  Image,
  Text,
  StyleSheet,
  ImageSourcePropType,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useTheme } from "@/constants/theme";

const icons: Record<string, ImageSourcePropType> = {
  home: require("../../../assets/icons/tab/home.png"),
  homeFilled: require("../../../assets/icons/tab/home-filled.png"),
  order: require("../../../assets/icons/tab/gas-pump.png"),
  orderFilled: require("../../../assets/icons/tab/gas-pump-fill.png"),
  track: require("../../../assets/icons/tab/delivery.png"),
  trackFilled: require("../../../assets/icons/tab/delivery-fill.png"),
};

const labels: Record<string, string> = {
  home: "Home",
  order: "Order",
  track: "Tracking",
};

const getIcon = (name: string, focused: boolean): ImageSourcePropType => {
  const n = name.toLowerCase();

  if (n.includes("home")) return focused ? icons.homeFilled : icons.home;
  if (n.includes("order")) return focused ? icons.orderFilled : icons.order;
  if (n.includes("track")) return focused ? icons.trackFilled : icons.track;

  return icons.home;
};

const getLabel = (name: string): string => {
  const n = name.toLowerCase();

  if (n.includes("home")) return labels.home;
  if (n.includes("order")) return labels.order;
  if (n.includes("track")) return labels.track;

  return "";
};

export default function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.tab,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const icon = getIcon(route.name, isFocused);
        const label = getLabel(route.name);

        const onPress = useCallback(() => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        }, [isFocused, navigation, route]);

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            activeOpacity={0.7}
            style={styles.tab}
          >
            <Image
              source={icon}
              resizeMode="contain"
              style={[
                styles.icon,
                {
                  opacity: isFocused ? 1 : 0.6,
                },
              ]}
            />

            <Text
              style={[
                styles.label,
                {
                  color: isFocused
                    ? "#FFFFFF"
                    : theme.tabIconDefault,
                  fontWeight: isFocused ? "600" : "400",
                },
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 12,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    width: 28,
    height: 28,
  },
  label: {
    marginTop: 4,
    fontSize: 14,
  },
});
