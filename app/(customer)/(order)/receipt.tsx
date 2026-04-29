import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
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
import { getSocket } from "@/lib/socket";
import { paymentMethodLabel } from "@/lib/paymentLabel";
import {
  Button,
  ReceiptRow,
  ScreenContainer,
  StatusBadge,
} from "@/components/ui/primitives";

/**
 * Status badge labels driven by real server `order:update` events. No demo
 * timers — the screen sits on "Matching rider" until a rider is actually
 * assigned, at which point the badge flips to "Rider on the way".
 */
type ReceiptStatus = "matching" | "assigned" | "in_transit" | "arrived";

const STATUS_DISPLAY: Record<
  ReceiptStatus,
  { label: string; kind: "info" | "success" | "primary" }
> = {
  matching: { label: "Matching rider", kind: "info" },
  assigned: { label: "Rider on the way", kind: "success" },
  in_transit: { label: "On the way", kind: "primary" },
  arrived: { label: "At your gate", kind: "success" },
};

function mapServerStatus(s: string | undefined): ReceiptStatus {
  if (!s) return "matching";
  if (s === "assigned") return "assigned";
  if (s === "in_transit" || s === "in-transit" || s === "picked_up") return "in_transit";
  if (s === "arrived" || s === "awaiting_confirmation") return "arrived";
  // confirmed / pending / pending_payment / unknown → still matching.
  return "matching";
}

export default function ReceiptScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const draft = useOrderStore((s) => s.order);
  const setRiderInStore = useOrderStore((s) => s.setRider);
  const setDeliveryConfirmation = useOrderStore(
    (s) => s.setDeliveryConfirmation
  );
  const user = useSessionStore((s) => s.user);

  const [status, setStatus] = useState<ReceiptStatus>("matching");
  const heroScale = useRef(new Animated.Value(0)).current;
  const heroRingOpacity = useRef(new Animated.Value(0)).current;

  const station = draft.station;
  const total = (station?.totalKobo ?? 0) / 100;
  const orderId = draft.orderId ?? "—";
  const fuelLine = `${draft.qty ?? 0} ${draft.unit ?? "L"} ${
    draft.fuelTypeId ?? ""
  }`.trim();
  const stationName = station?.name ?? "—";
  const deliveryShort = draft.deliveryLabel ?? "Saved address";
  // Real method passthrough — resolves "card-saved" → brand+last4 from
  // the saved-card metadata, falls through to friendly labels for
  // wallet / transfer / new-card. Replaces the previous "GTB •••• 4892"
  // hard-code that showed regardless of what the user actually paid with.
  const methodSubLabel = paymentMethodLabel(draft.paymentMethodId, user);
  const timeStr = useMemo(
    () =>
      new Date().toLocaleTimeString("en-NG", {
        hour: "numeric",
        minute: "2-digit",
      }),
    []
  );

  // Hero entrance animation (skipped under reduced motion).
  useEffect(() => {
    let cancelledLocal = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelledLocal) return;
      if (reduced) {
        heroScale.setValue(1);
        heroRingOpacity.setValue(1);
        return;
      }
      Animated.spring(heroScale, {
        toValue: 1,
        damping: 12,
        stiffness: 180,
        useNativeDriver: true,
      }).start();
      Animated.timing(heroRingOpacity, {
        toValue: 1,
        duration: 600,
        delay: 200,
        useNativeDriver: true,
      }).start();
    });
    return () => {
      cancelledLocal = true;
    };
  }, [heroScale, heroRingOpacity]);

  // Real socket subscription — no demo setTimeout. The badge flips only
  // when the server actually emits an order:update with a new status.
  // Also persists rider + delivery-confirm fields to the draft so the
  // downstream Track / Delivered / Complete screens see them without
  // a follow-up GET.
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !draft.orderId) return;
    const handler = (data: {
      orderId?: string;
      status?: string;
      rider?: {
        firstName: string;
        lastName?: string;
        plate?: string;
        rating?: number;
        phone?: string;
        initials?: string;
      };
      deliveredAt?: string;
      totalCharged?: number;
      pointsEarned?: number;
    }) => {
      if (data.orderId && draft.orderId && data.orderId !== draft.orderId) return;
      setStatus(mapServerStatus(data.status));
      if (data.rider) setRiderInStore(data.rider);
      if (data.deliveredAt || data.totalCharged != null || data.pointsEarned != null) {
        setDeliveryConfirmation({
          deliveredAt: data.deliveredAt,
          totalCharged: data.totalCharged,
          pointsEarned: data.pointsEarned,
        });
      }
    };
    socket.on("order:update", handler);
    return () => {
      socket.off("order:update", handler);
    };
  }, [draft.orderId, setRiderInStore, setDeliveryConfirmation]);

  const handleTrack = useCallback(() => {
    router.replace("/(customer)/(track)" as never);
  }, [router]);

  const handleSharePdf = useCallback(async () => {
    try {
      await Share.share({
        title: `Gaznger receipt — Order ${orderId}`,
        message: `Order ${orderId}: ${fuelLine} from ${stationName}. Total ${formatCurrency(total)}.`,
      });
    } catch {
      // user cancelled
    }
  }, [orderId, fuelLine, stationName, total]);

  const display = STATUS_DISPLAY[status];

  return (
    <ScreenContainer edges={["top", "bottom"]} contentStyle={styles.scroll}>
      <View style={styles.heroWrap}>
        <Animated.View
          style={[
            styles.heroOuterRing,
            { opacity: heroRingOpacity },
          ]}
        />
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
        Paid. Order confirmed.
      </Text>
      <Text style={styles.heroSub}>
        Order #{orderId} · {status === "matching"
          ? "we're matching you to a rider"
          : "rider locked in — open tracking to follow live"}
      </Text>

      <View style={styles.receiptCard}>
        <View style={styles.receiptHeaderRow}>
          <Text style={styles.eyebrow}>RECEIPT</Text>
          <StatusBadge kind={display.kind}>{display.label}</StatusBadge>
        </View>

        <ReceiptRow label="Fuel" value={fuelLine} />
        <ReceiptRow label="Station" value={stationName} />
        <ReceiptRow label="Deliver to" value={deliveryShort} />
        <ReceiptRow label="Paid with" value={methodSubLabel} />
        <ReceiptRow label="Time" value={timeStr} />

        <View style={styles.divider} />

        <ReceiptRow label="Total paid" value={total} isTotal />
      </View>

      <View style={styles.actionRow}>
        <View style={{ flex: 1 }}>
          <Button
            variant="outline"
            size="md"
            iconLeft="receipt-outline"
            full
            onPress={handleSharePdf}
          >
            Receipt PDF
          </Button>
        </View>
        <View style={{ flex: 2 }}>
          <Button
            variant="primary"
            size="md"
            full
            onPress={handleTrack}
          >
            Track delivery
          </Button>
        </View>
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
      gap: theme.space.s4,
      alignItems: "center",
    },
    heroWrap: {
      width: 96,
      height: 96,
      alignItems: "center",
      justifyContent: "center",
      marginTop: theme.space.s4,
      marginBottom: theme.space.s2,
    },
    heroOuterRing: {
      position: "absolute",
      width: 130,
      height: 130,
      borderRadius: 65,
      borderWidth: 8,
      borderColor: "rgba(31,157,85,0.06)",
    },
    heroCheck: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: theme.success,
      alignItems: "center",
      justifyContent: "center",
      ...theme.elevation.card,
    },
    heroTitle: {
      ...theme.type.h1,
      color: theme.fg,
      textAlign: "center",
    },
    heroSub: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      textAlign: "center",
    },
    receiptCard: {
      alignSelf: "stretch",
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: theme.radius.lg,
      paddingHorizontal: theme.space.s4,
      paddingVertical: theme.space.s3,
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
    divider: {
      height: 1,
      backgroundColor: theme.divider,
      marginVertical: theme.space.s2,
    },
    actionRow: {
      alignSelf: "stretch",
      flexDirection: "row",
      gap: theme.space.s2,
      marginTop: theme.space.s2,
    },
  });
