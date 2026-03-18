import React, { useCallback, useEffect, useRef } from "react";
import {
  View,
  TouchableOpacity,
  Image,
  Text,
  StyleSheet,
  ImageSourcePropType,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useTheme } from "@/constants/theme";
import { useActiveOrder } from "@/hooks/useActiveOrder";

const icons: Record<string, ImageSourcePropType> = {
  home: require("../../../assets/icons/tab/home.png"),
  homeFilled: require("../../../assets/icons/tab/home-filled.png"),
  order: require("../../../assets/icons/tab/gas-pump.png"),
  orderFilled: require("../../../assets/icons/tab/gas-pump-fill.png"),
  track: require("../../../assets/icons/tab/delivery.png"),
  trackFilled: require("../../../assets/icons/tab/delivery-fill.png"),
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
  if (n.includes("home")) return "Home";
  if (n.includes("order")) return "Order";
  if (n.includes("track")) return "Track";
  return "";
};

function PulsingDot() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.2, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: -2,
        right: -2,
        width: 9,
        height: 9,
        borderRadius: 5,
        backgroundColor: "#F97316",
        opacity,
      }}
    />
  );
}

export default function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { hasActiveOrder } = useActiveOrder();

  return (
    <View style={[styles.outerWrap, { backgroundColor: theme.tab, paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.bar}>
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

          const isTrack = route.name.toLowerCase().includes("track");
          const showBadge = isTrack && hasActiveOrder;

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.8}
              style={styles.tabItem}
            >
              <View style={{ position: "relative" }}>
                <View style={[styles.pill, isFocused && { backgroundColor: theme.primary }]}>
                  <Image
                    source={icon}
                    resizeMode="contain"
                    style={[styles.icon, { tintColor: isFocused ? "#FFFFFF" : theme.tabIconDefault }]}
                  />
                </View>
                {showBadge && <PulsingDot />}
              </View>
              <Text style={[styles.label, { color: isFocused ? "#FFFFFF" : theme.tabIconDefault, fontWeight: isFocused ? "700" : "400" }]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrap: {
    paddingTop: 10,
  },
  bar: {
    flexDirection: "row",
    marginHorizontal: 16,
    borderRadius: 18,
    overflow: "hidden",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  pill: {
    width: 46,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    width: 22,
    height: 22,
  },
  label: {
    marginTop: 3,
    fontSize: 11,
    letterSpacing: 0.2,
  },
});
