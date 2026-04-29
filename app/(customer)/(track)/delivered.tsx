import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Theme, useTheme, formatCurrency } from "@/constants/theme";
import { useOrderStore } from "@/store/useOrderStore";
import { useSessionStore } from "@/store/useSessionStore";
import {
  Button,
  ReceiptRow,
  ScreenContainer,
} from "@/components/ui/primitives";

// Fallback only — surfaced when the server hasn't emitted pointsEarned
// yet (e.g. legacy orders pre-this-revamp). Real value rides on the
// delivery-confirm payload via order:update.
const POINTS_EARNED_FALLBACK = 0;

export default function DeliveredScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const draft = useOrderStore((s) => s.order);
  const userEmail = useSessionStore((s) => s.user?.email);
  const userPoints = useSessionStore((s) => s.user?.points ?? 0);

  // Real values from the delivery-confirm socket payload.
  const riderFirstName = draft.rider?.firstName ?? "your rider";
  const pointsEarned = draft.pointsEarned ?? POINTS_EARNED_FALLBACK;

  const heroScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled) return;
      if (reduced) {
        heroScale.setValue(1);
        return;
      }
      Animated.spring(heroScale, {
        toValue: 1,
        damping: 12,
        stiffness: 200,
        useNativeDriver: true,
      }).start();
    });
    return () => {
      cancelled = true;
    };
  }, [heroScale]);

  const fuelCost = (draft.station?.totalKobo ?? 0) / 100;
  // Delivery fee was already baked into the locked total at Stations.
  // The breakdown line below back-derives it for the receipt rather than
  // adding a flat ₦500 on top (the previous implementation overcharged
  // the customer on long-distance orders).
  const totalCharged = draft.totalCharged ?? fuelCost;
  const deliveryFee = Math.max(0, totalCharged - fuelCost);

  const fuelLine = `${draft.qty ?? 0} ${draft.unit ?? "L"} ${
    draft.fuelTypeId ?? ""
  }`.trim();

  const isLpg = draft.product === "lpg";
  const isSwap = isLpg && draft.serviceType === "swap";

  // Real timestamp from the delivery-confirm payload, formatted in
  // Lagos time. Falls back to "just now" when the screen mounts before
  // the socket event lands (rare — Track auto-routes here on `arrived`).
  const deliveredTimeStr = useMemo(() => {
    const iso = draft.deliveredAt;
    if (!iso) return "just now";
    return new Date(iso).toLocaleTimeString("en-NG", {
      hour: "numeric",
      minute: "2-digit",
    });
  }, [draft.deliveredAt]);

  const heroSub = isSwap
    ? `${draft.cylinderType ?? "cylinder"} swapped at ${deliveredTimeStr}.`
    : isLpg
      ? `${draft.cylinderType ?? "cylinder"} refilled at ${deliveredTimeStr}.`
      : `${draft.qty ?? 0} L ${draft.fuelTypeId ?? ""} delivered at ${deliveredTimeStr}.`;

  const handleRate = useCallback(() => {
    router.push("/(customer)/(track)/rate" as never);
  }, [router]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `Order #${draft.orderId ?? ""}: ${fuelLine}. Total ${formatCurrency(totalCharged)}.`,
      });
    } catch {
      // user cancelled
    }
  }, [draft.orderId, fuelLine, totalCharged]);

  const handleReorder = useCallback(() => {
    router.push("/(customer)/(order)" as never);
  }, [router]);

  return (
    <ScreenContainer
      edges={["top", "bottom"]}
      contentStyle={styles.scroll}
    >
      <View style={styles.heroWrap}>
        <Animated.View
          style={[
            styles.heroCheck,
            { transform: [{ scale: heroScale }] },
          ]}
        >
          <Ionicons name="checkmark" size={44} color="#fff" />
        </Animated.View>
      </View>

      <Text style={styles.heroTitle} accessibilityRole="header">
        Fueled.
      </Text>
      <Text style={styles.heroSub}>
        {heroSub}
        {userEmail ? ` Receipt sent to ${userEmail}.` : ""}
      </Text>

      <View style={styles.receiptCard}>
        <View style={styles.receiptHeaderRow}>
          <Text style={styles.eyebrow}>RECEIPT</Text>
          <Text style={styles.orderId}>#{draft.orderId ?? "—"}</Text>
        </View>

        <ReceiptRow
          label={
            isSwap
              ? `Swap · ${draft.cylinderType ?? ""}`
              : isLpg
                ? `Refill · ${draft.cylinderType ?? ""}`
                : `${draft.fuelTypeId ?? ""} · ${draft.qty ?? 0} L`
          }
          value={fuelCost}
        />
        <ReceiptRow
          label={isLpg ? "Pickup" : "Delivery"}
          value={deliveryFee}
        />

        <View style={styles.divider} />

        <ReceiptRow label="Total paid" value={totalCharged} isTotal />
      </View>

      {pointsEarned > 0 ? (
        <View style={styles.pointsCard}>
          <View style={styles.pointsCoin}>
            <Ionicons name="star" size={18} color={theme.palette.neutral900} />
          </View>
          <View style={styles.pointsBody}>
            <Text style={styles.pointsTitle}>
              +{pointsEarned} points earned
            </Text>
            <Text style={styles.pointsSub}>
              You now have {(userPoints + pointsEarned).toLocaleString()} points
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.actionRow}>
        <View style={{ flex: 1 }}>
          <Button
            variant="outline"
            size="md"
            iconLeft="receipt-outline"
            full
            onPress={handleShare}
          >
            Share receipt
          </Button>
        </View>
        <View style={{ flex: 1 }}>
          <Button
            variant="outline"
            size="md"
            iconLeft="refresh"
            full
            onPress={handleReorder}
          >
            Reorder
          </Button>
        </View>
      </View>

      <View style={{ marginTop: 'auto' }}>
        <Button variant="primary" size="lg" full onPress={handleRate}>
          Rate {riderFirstName} & finish
        </Button>
      </View>
    </ScreenContainer>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    scroll: {
      paddingHorizontal: theme.space.s4,
      paddingTop: theme.space.s5,
      paddingBottom: theme.space.s5,
      gap: theme.space.s3,
      alignItems: "stretch",
    },
    heroWrap: {
      width: 88,
      height: 88,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
      marginTop: theme.space.s4,
      marginBottom: theme.space.s2,
    },
    heroCheck: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: theme.success,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: theme.success,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.35,
      shadowRadius: 32,
      elevation: 8,
    },
    heroTitle: {
      ...theme.type.display,
      color: theme.fg,
      textAlign: "left",
    },
    heroSub: {
      ...theme.type.bodyLg,
      color: theme.fgMuted,
    },
    receiptCard: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: theme.radius.lg,
      paddingHorizontal: theme.space.s4,
      paddingVertical: theme.space.s4,
      marginTop: theme.space.s2,
    },
    receiptHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: theme.space.s2,
    },
    eyebrow: {
      ...theme.type.micro,
      color: theme.fgMuted,
    },
    orderId: {
      ...theme.type.caption,
      ...theme.type.money,
      color: theme.fgMuted,
      fontWeight: "700",
    },
    divider: {
      height: 1,
      backgroundColor: theme.divider,
      marginVertical: theme.space.s2,
    },
    pointsCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s3,
      backgroundColor: theme.accentTint,
      borderRadius: theme.radius.lg,
      paddingHorizontal: theme.space.s3 + 2,
      paddingVertical: theme.space.s3,
    },
    pointsCoin: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    pointsBody: { flex: 1, gap: 2 },
    pointsTitle: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "800",
    },
    pointsSub: {
      ...theme.type.caption,
      color: theme.fgMuted,
    },
    actionRow: {
      flexDirection: "row",
      gap: theme.space.s2,
      marginTop: theme.space.s2,
    },
  });
