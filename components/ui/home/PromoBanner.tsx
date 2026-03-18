import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  StyleSheet,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BANNER_WIDTH = SCREEN_WIDTH - 32;
const AUTO_SCROLL_MS = 4500;

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

interface Banner {
  id: string;
  label: string;
  title: string;
  subtitle: string;
  bg: string;
  circleColor: string;
  iconColor: string;
  labelBg: string;
  labelText: string;
  icon: IoniconsName;
}

const BANNERS: Banner[] = [
  {
    id: "1",
    label: "Delivery",
    title: "Fuel at Your\nDoorstep",
    subtitle: "Order gas & diesel in minutes — no queues",
    bg: "#1A6B1A",
    circleColor: "rgba(255,255,255,0.08)",
    iconColor: "rgba(255,255,255,0.90)",
    labelBg: "rgba(255,255,255,0.18)",
    labelText: "#FFFFFF",
    icon: "flash-outline",
  },
  {
    id: "2",
    label: "Rewards",
    title: "Earn on Every\nOrder",
    subtitle: "Redeem your Gaznger Points for real discounts",
    bg: "#0C1A0C",
    circleColor: "rgba(245,197,24,0.12)",
    iconColor: "#F5C518",
    labelBg: "rgba(245,197,24,0.2)",
    labelText: "#F5C518",
    icon: "star-outline",
  },
  {
    id: "3",
    label: "Trusted",
    title: "Verified Stations\nOnly",
    subtitle: "Licensed, quality-checked partners near you",
    bg: "#476F29",
    circleColor: "rgba(255,255,255,0.08)",
    iconColor: "rgba(255,255,255,0.90)",
    labelBg: "rgba(255,255,255,0.18)",
    labelText: "#FFFFFF",
    icon: "shield-checkmark-outline",
  },
];

export default function PromoBanner() {
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const dotAnims = useRef(BANNERS.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;

  const animateDots = (next: number) => {
    dotAnims.forEach((anim, i) => {
      Animated.timing(anim, {
        toValue: i === next ? 1 : 0,
        duration: 250,
        useNativeDriver: false,
      }).start();
    });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const next = (activeIndexRef.current + 1) % BANNERS.length;
      scrollRef.current?.scrollTo({ x: BANNER_WIDTH * next, animated: true });
      activeIndexRef.current = next;
      setActiveIndex(next);
      animateDots(next);
    }, AUTO_SCROLL_MS);
    return () => clearInterval(interval);
  }, []);

  const handleScroll = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / BANNER_WIDTH);
    if (idx !== activeIndexRef.current && idx >= 0 && idx < BANNERS.length) {
      activeIndexRef.current = idx;
      setActiveIndex(idx);
      animateDots(idx);
    }
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToInterval={BANNER_WIDTH}
        snapToAlignment="start"
        style={{ borderRadius: 20 }}
        contentContainerStyle={{ gap: 0 }}
      >
        {BANNERS.map((banner) => (
          <View
            key={banner.id}
            style={[styles.banner, { width: BANNER_WIDTH, backgroundColor: banner.bg }]}
          >
            {/* Decorative circles */}
            <View
              style={[
                styles.circleOuter,
                { backgroundColor: banner.circleColor },
              ]}
            />
            <View
              style={[
                styles.circleInner,
                { backgroundColor: banner.circleColor },
              ]}
            />

            {/* Content */}
            <View style={styles.content}>
              <View style={styles.left}>
                <View style={[styles.labelPill, { backgroundColor: banner.labelBg }]}>
                  <Text style={[styles.labelText, { color: banner.labelText }]}>
                    {banner.label}
                  </Text>
                </View>
                <Text style={styles.title}>{banner.title}</Text>
                <Text style={styles.subtitle}>{banner.subtitle}</Text>
              </View>

              <View style={styles.iconWrap}>
                <Ionicons name={banner.icon} size={48} color={banner.iconColor} />
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Animated pagination dots */}
      <View style={styles.dots}>
        {BANNERS.map((_, i) => {
          const width = dotAnims[i].interpolate({
            inputRange: [0, 1],
            outputRange: [6, 20],
          });
          const opacity = dotAnims[i].interpolate({
            inputRange: [0, 1],
            outputRange: [0.35, 1],
          });
          return (
            <Animated.View
              key={i}
              style={[styles.dot, { width, opacity, backgroundColor: "#476F29" }]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  banner: {
    height: 136,
    borderRadius: 20,
    overflow: "hidden",
    position: "relative",
  },
  circleOuter: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    right: -40,
    top: -50,
  },
  circleInner: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 55,
    right: 20,
    bottom: -30,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingVertical: 18,
  },
  left: {
    flex: 1,
    gap: 6,
  },
  labelPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    marginBottom: 2,
  },
  labelText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "300",
    color: "rgba(255,255,255,0.72)",
    lineHeight: 17,
  },
  iconWrap: {
    width: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
    marginTop: 10,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
});
