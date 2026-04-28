import React, { useCallback, useEffect, useRef } from "react";
import {
  View,
  TouchableOpacity,
  Image,
  StyleSheet,
  ImageSourcePropType,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
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

const getIcon = (name: string, focused: boolean): ImageSourcePropType | null => {
  const n = name.toLowerCase();
  if (n.includes("home")) return focused ? icons.homeFilled : icons.home;
  if (n.includes("order")) return focused ? icons.orderFilled : icons.order;
  if (n.includes("track")) return focused ? icons.trackFilled : icons.track;
  return null; // Use Ionicons fallback
};

const getIonicon = (name: string, focused: boolean): keyof typeof Ionicons.glyphMap => {
  const n = name.toLowerCase();
  if (n.includes("history")) return focused ? "time" : "time-outline";
  return focused ? "home" : "home-outline";
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
        top: 4,
        right: 4,
        width: 8,
        height: 8,
        borderRadius: 4,
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
    <View style={[styles.outerWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={[styles.pill, { backgroundColor: theme.tab }]}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
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
          const imageIcon = getIcon(route.name, isFocused);

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.8}
              style={styles.tabItem}
            >
              <View style={styles.iconPillClip}>
                <View style={[styles.iconPill, isFocused && { backgroundColor: theme.primary }]}>
                  {imageIcon ? (
                    <Image
                      source={imageIcon}
                      resizeMode="contain"
                      style={[styles.icon, { tintColor: isFocused ? "#FFFFFF" : theme.tabIconDefault }]}
                    />
                  ) : (
                    <Ionicons
                      name={getIonicon(route.name, isFocused)}
                      size={20}
                      color={isFocused ? "#FFFFFF" : theme.tabIconDefault}
                    />
                  )}
                  {showBadge && <PulsingDot />}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
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
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
  },
  iconPillClip: { borderRadius: 17, overflow: "hidden" },
  iconPill: {
    width: 48,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    width: 22,
    height: 22,
  },
});
