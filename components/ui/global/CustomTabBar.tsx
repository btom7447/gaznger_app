import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated as RNAnimated,
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Theme, useTheme } from "@/constants/theme";
import { useActiveOrder } from "@/hooks/useActiveOrder";

const tabIcons: Record<string, ImageSourcePropType> = {
  home: require("../../../assets/icons/tab/home.png"),
  homeFilled: require("../../../assets/icons/tab/home-filled.png"),
  order: require("../../../assets/icons/tab/gas-pump.png"),
  orderFilled: require("../../../assets/icons/tab/gas-pump-fill.png"),
  track: require("../../../assets/icons/tab/delivery.png"),
  trackFilled: require("../../../assets/icons/tab/delivery-fill.png"),
};

interface TabConfig {
  /** Match against route.name; "profile" is virtual (no route in this group). */
  match: string;
  label: string;
  /** Custom raster icon (preferred); falls back to ionicon if both supplied. */
  imageIcon?: { active: ImageSourcePropType; inactive: ImageSourcePropType };
  ionicon?: {
    active: keyof typeof Ionicons.glyphMap;
    inactive: keyof typeof Ionicons.glyphMap;
  };
  /** Routes the tab also "owns" — focuses when current route matches any. */
  alsoMatches?: string[];
}

const TABS: TabConfig[] = [
  {
    match: "(home)",
    label: "Home",
    imageIcon: { active: tabIcons.homeFilled, inactive: tabIcons.home },
  },
  {
    match: "(order)",
    label: "Order",
    imageIcon: { active: tabIcons.orderFilled, inactive: tabIcons.order },
  },
  {
    match: "(track)",
    label: "Track",
    imageIcon: { active: tabIcons.trackFilled, inactive: tabIcons.track },
  },
  {
    // Virtual: this entry doesn't correspond to a customer-tab route. The
    // press handler pushes to /(screens)/profile instead.
    match: "__profile",
    label: "Profile",
    ionicon: { active: "person", inactive: "person-outline" },
  },
];

// Routes that exist inside the (customer) tabs group but are NOT tab destinations.
// Expo Router's `href: null` hides them from `Link`, but `state.routes` still
// includes them; the custom tab bar must filter explicitly.
const HIDDEN_TAB_ROUTES = new Set(["notifications", "(history)"]);

// Routes whose presence in the active tab should HIDE the entire tab bar
// (full-bleed checkout flow per design). The tab bar reappears as soon as
// the user navigates away from the order group.
const FULLBLEED_TABS = new Set(["(order)"]);

function PulsingDot({ color }: { color: string }) {
  const opacity = useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    const pulse = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(opacity, {
          toValue: 0.2,
          duration: 700,
          useNativeDriver: true,
        }),
        RNAnimated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <RNAnimated.View
      style={{
        position: "absolute",
        top: 4,
        right: 4,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: color,
        opacity,
      }}
    />
  );
}

export default function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
  const { hasActiveOrder } = useActiveOrder();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // The route name currently focused (e.g. "(home)"); used for the virtual
  // profile button which has no route in this navigator.
  const focusedRouteName = state.routes[state.index]?.name ?? "";

  // Slide-fade transition when entering / leaving order group (full-bleed
  // checkout). Always mount so the animation has something to drive; the
  // bar is purely visual when fully translated off-screen.
  const isHidden = FULLBLEED_TABS.has(focusedRouteName);
  const visibility = useSharedValue(isHidden ? 0 : 1);

  useEffect(() => {
    visibility.value = withTiming(isHidden ? 0 : 1, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [isHidden, visibility]);

  const wrapStyle = useAnimatedStyle(() => ({
    opacity: visibility.value,
    transform: [
      // Slide ~80px down when hiding, back to 0 when showing.
      { translateY: (1 - visibility.value) * 80 },
    ],
  }));

  return (
    <Animated.View
      pointerEvents={isHidden ? "none" : "auto"}
      style={[
        styles.outerWrap,
        { paddingBottom: Math.max(insets.bottom, 16) },
        wrapStyle,
      ]}
    >
      <View style={styles.pill}>
        {TABS.map((tab) => {
          // Resolve focus + press behavior.
          if (tab.match === "__profile") {
            const isFocused = false; // profile is a separate stack
            return (
              <TabItem
                key={tab.match}
                tab={tab}
                isFocused={isFocused}
                showBadge={false}
                onPress={() => router.push("/(screens)/profile" as never)}
                styles={styles}
                theme={theme}
              />
            );
          }

          // Real tab — find its index in state.routes (skipping hidden ones).
          const routeIndex = state.routes.findIndex(
            (r) => r.name === tab.match
          );
          if (routeIndex === -1 || HIDDEN_TAB_ROUTES.has(tab.match)) {
            return null;
          }

          const route = state.routes[routeIndex];
          const isFocused =
            state.index === routeIndex ||
            (focusedRouteName === tab.match);
          const showBadge = tab.match === "(track)" && hasActiveOrder;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TabItem
              key={route.key}
              tab={tab}
              isFocused={isFocused}
              showBadge={showBadge}
              onPress={onPress}
              styles={styles}
              theme={theme}
            />
          );
        })}
      </View>
    </Animated.View>
  );
}

function TabItem({
  tab,
  isFocused,
  showBadge,
  onPress,
  styles,
  theme,
}: {
  tab: TabConfig;
  isFocused: boolean;
  showBadge: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  theme: Theme;
}) {
  const fg = isFocused ? "#FFFFFF" : theme.tabIconDefault;

  return (
    <Animated.View layout={LinearTransition.springify().damping(22).stiffness(220)}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: isFocused }}
        accessibilityLabel={tab.label}
        style={({ pressed }) => [
          styles.tabItem,
          isFocused && styles.tabItemActive,
          pressed && { opacity: 0.85 },
        ]}
      >
        {tab.imageIcon ? (
          <Image
            source={isFocused ? tab.imageIcon.active : tab.imageIcon.inactive}
            resizeMode="contain"
            style={[styles.icon, { tintColor: fg }]}
          />
        ) : tab.ionicon ? (
          <Ionicons
            name={isFocused ? tab.ionicon.active : tab.ionicon.inactive}
            size={20}
            color={fg}
          />
        ) : null}
        {isFocused ? (
          <Animated.Text
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(120)}
            style={[styles.label, { color: fg }]}
            numberOfLines={1}
          >
            {tab.label}
          </Animated.Text>
        ) : null}
        {showBadge ? <PulsingDot color={theme.warning} /> : null}
      </Pressable>
    </Animated.View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    outerWrap: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      alignItems: "center",
    },
    pill: {
      flexDirection: "row",
      backgroundColor: theme.tab,
      borderRadius: 999,
      paddingHorizontal: 6,
      paddingVertical: 6,
      gap: 4,
      ...theme.elevation.modal,
      alignItems: "center",
      // Subtle border in dark mode so the pill reads against near-black bg.
      borderWidth: theme.mode === "dark" ? 1 : 0,
      borderColor: theme.border,
    },
    tabItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      width: 46,
      height: 40,
      borderRadius: 999,
    },
    tabItemActive: {
      backgroundColor: theme.primary,
      paddingHorizontal: 10,
      width: "auto",
      minWidth: 92,
    },
    icon: {
      width: 20,
      height: 20,
    },
    label: {
      ...theme.type.body,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: "800",
    },
  });
