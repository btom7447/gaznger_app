import React, { useEffect, useMemo, useRef } from "react";
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";

export interface ActiveOrderInfo {
  orderId: string;
  /** Customer-facing status label (already mapped via getStatusLabel). */
  statusLabel: string;
  /** ETA in minutes — null when unknown / "Matching rider". */
  etaMinutes: number | null;
}

interface ActiveOrderBannerProps {
  order: ActiveOrderInfo;
  onPress?: (orderId: string) => void;
}

/**
 * Replaces the PromoBanner when an order is in flight.
 * Pulses the leading dot via Reanimated; halts on reduced motion.
 */
export default function ActiveOrderBanner({
  order,
  onPress,
}: ActiveOrderBannerProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let mounted = true;
    let anim: Animated.CompositeAnimation | null = null;

    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!mounted || reduced) return;
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.4,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      anim.start();
    });

    return () => {
      mounted = false;
      anim?.stop();
    };
  }, [opacity]);

  const etaText =
    order.etaMinutes != null
      ? `ETA ${order.etaMinutes} min`
      : "Tracking your order";

  return (
    <Pressable
      onPress={() => onPress?.(order.orderId)}
      accessibilityRole="button"
      accessibilityLabel={`Active order ${order.orderId}. ${order.statusLabel}. ${etaText}.`}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
    >
      <View style={styles.statusRow}>
        <Animated.View style={[styles.dot, { opacity }]} />
        <Text style={styles.statusText}>{order.statusLabel}</Text>
      </View>
      <Text style={styles.eta}>{etaText}</Text>
      <View style={styles.footer}>
        <Text style={styles.orderId}>Order {order.orderId}</Text>
        <View style={styles.cta}>
          <Text style={styles.ctaText}>Track</Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color="#fff"
          />
        </View>
      </View>
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.primary,
      borderRadius: theme.radius.xl,
      paddingVertical: theme.space.s5,
      paddingHorizontal: theme.space.s5,
      minHeight: 200,
      ...theme.elevation.card,
      justifyContent: "space-between",
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s2,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#fff",
    },
    statusText: {
      ...theme.type.bodySm,
      color: "rgba(255,255,255,0.92)",
      fontWeight: "700",
      letterSpacing: 0.3,
      textTransform: "uppercase",
    },
    eta: {
      ...theme.type.h1,
      ...theme.type.money,
      color: "#fff",
      marginTop: theme.space.s2,
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: theme.space.s2 + 2,
    },
    orderId: {
      ...theme.type.caption,
      ...theme.type.money,
      color: "rgba(255,255,255,0.75)",
      fontWeight: "700",
    },
    cta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "rgba(255,255,255,0.18)",
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.space.s3,
      paddingVertical: 6,
    },
    ctaText: {
      ...theme.type.caption,
      color: "#fff",
      fontWeight: "800",
    },
  });
