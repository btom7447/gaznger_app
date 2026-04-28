import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BANNER_WIDTH = SCREEN_WIDTH - 32;
const AUTO_SCROLL_MS = 5000;

interface VendorBanner {
  id: string;
  label: string;
  title: string;
  subtitle: string;
  bg: string;
  circleColor: string;
  labelBg: string;
  labelText: string;
  iconColor: string;
  route: string;
  iconType: "ionicons" | "material";
  icon: string;
}

const VENDOR_BANNERS: VendorBanner[] = [
  {
    id: "partner",
    label: "Partner Badge",
    title: "Boost Your\nVisibility",
    subtitle: "Partner vendors appear first in customer search",
    bg: "#1A3A6B",
    circleColor: "rgba(255,255,255,0.08)",
    labelBg: "rgba(255,255,255,0.18)",
    labelText: "#FFFFFF",
    iconColor: "rgba(255,255,255,0.90)",
    route: "/(vendor)/(dashboard)/profile",
    iconType: "ionicons",
    icon: "ribbon-outline",
  },
  {
    id: "verify",
    label: "Verification",
    title: "Get Verified\nToday",
    subtitle: "Verified vendors earn more customer trust & orders",
    bg: "#1A4A1A",
    circleColor: "rgba(34,197,94,0.12)",
    labelBg: "rgba(34,197,94,0.2)",
    labelText: "#22C55E",
    iconColor: "#22C55E",
    route: "/(vendor)/verification",
    iconType: "material",
    icon: "verified",
  },
  {
    id: "auto-accept",
    label: "Pro Tip",
    title: "Save Time\nWith Auto-Accept",
    subtitle: "Automatically confirm orders the moment they arrive",
    bg: "#4A1A00",
    circleColor: "rgba(245,197,24,0.12)",
    labelBg: "rgba(245,197,24,0.2)",
    labelText: "#F5C518",
    iconColor: "#F5C518",
    route: "/(vendor)/(dashboard)/index",
    iconType: "material",
    icon: "update",
  },
  {
    id: "earnings",
    label: "Earnings",
    title: "Track Your\nRevenue",
    subtitle: "View pending & settled earnings in real time",
    bg: "#2D0A3A",
    circleColor: "rgba(139,92,246,0.12)",
    labelBg: "rgba(139,92,246,0.2)",
    labelText: "#A78BFA",
    iconColor: "#A78BFA",
    route: "/(vendor)/(dashboard)/earnings",
    iconType: "ionicons",
    icon: "wallet-outline",
  },
];

export default function VendorPromoBanner() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const dotAnims = useRef(VENDOR_BANNERS.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;

  const animateDots = (next: number) => {
    dotAnims.forEach((anim, i) => {
      Animated.timing(anim, { toValue: i === next ? 1 : 0, duration: 250, useNativeDriver: false }).start();
    });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const next = (activeIndexRef.current + 1) % VENDOR_BANNERS.length;
      scrollRef.current?.scrollTo({ x: BANNER_WIDTH * next, animated: true });
      activeIndexRef.current = next;
      setActiveIndex(next);
      animateDots(next);
    }, AUTO_SCROLL_MS);
    return () => clearInterval(interval);
  }, []);

  const handleScroll = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / BANNER_WIDTH);
    if (idx !== activeIndexRef.current && idx >= 0 && idx < VENDOR_BANNERS.length) {
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
        {VENDOR_BANNERS.map((banner) => (
          <TouchableOpacity
            key={banner.id}
            activeOpacity={0.88}
            onPress={() => router.push(banner.route as any)}
            style={[styles.banner, { width: BANNER_WIDTH, backgroundColor: banner.bg }]}
          >
            <View style={[styles.circleOuter, { backgroundColor: banner.circleColor }]} />
            <View style={[styles.circleInner, { backgroundColor: banner.circleColor }]} />
            <View style={styles.content}>
              <View style={styles.left}>
                <View style={[styles.labelPill, { backgroundColor: banner.labelBg }]}>
                  <Text style={[styles.labelText, { color: banner.labelText }]}>{banner.label}</Text>
                </View>
                <Text style={styles.title}>{banner.title}</Text>
                <Text style={styles.subtitle}>{banner.subtitle}</Text>
              </View>
              <View style={styles.iconWrap}>
                {banner.iconType === "material" ? (
                  <MaterialIcons name={banner.icon as any} size={48} color={banner.iconColor} />
                ) : (
                  <Ionicons name={banner.icon as any} size={48} color={banner.iconColor} />
                )}
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {VENDOR_BANNERS.map((_, i) => {
          const width = dotAnims[i].interpolate({ inputRange: [0, 1], outputRange: [6, 20] });
          const opacity = dotAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
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
  wrapper: { marginBottom: 4 },
  banner: {
    height: 136,
    borderRadius: 20,
    overflow: "hidden",
    position: "relative",
  },
  circleOuter: {
    position: "absolute", width: 180, height: 180, borderRadius: 90, right: -40, top: -50,
  },
  circleInner: {
    position: "absolute", width: 110, height: 110, borderRadius: 55, right: 20, bottom: -30,
  },
  content: {
    flex: 1, flexDirection: "row", alignItems: "center",
    paddingHorizontal: 22, paddingVertical: 18,
  },
  left: { flex: 1, gap: 6 },
  labelPill: {
    alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 20, marginBottom: 2,
  },
  labelText: { fontSize: 11, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase" },
  title: { fontSize: 20, fontWeight: "700", color: "#FFFFFF", lineHeight: 26, letterSpacing: -0.3 },
  subtitle: { fontSize: 12, fontWeight: "300", color: "rgba(255,255,255,0.72)", lineHeight: 17 },
  iconWrap: { width: 72, alignItems: "center", justifyContent: "center" },
  dots: {
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 5, marginTop: 10,
  },
  dot: { height: 6, borderRadius: 3 },
});
