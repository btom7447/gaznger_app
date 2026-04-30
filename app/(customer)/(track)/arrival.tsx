import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { toast } from "sonner-native";
import { Theme, useTheme, formatCurrency } from "@/constants/theme";
import { useOrderStore } from "@/store/useOrderStore";
import { useActiveOrder } from "@/hooks/useActiveOrder";
import { getSocket } from "@/lib/socket";
import { api } from "@/lib/api";
import {
  FloatingCTA,
  LiveBadge,
  StatusBadge,
} from "@/components/ui/primitives";
import DispenseRing from "@/components/ui/customer/track/DispenseRing";
import PulseRings from "@/components/ui/customer/track/PulseRings";

/**
 * Arrival screen — liquid only. Replaces Track once status === 'arrived'.
 * Shows the dispense ring as fuel pumps; CTA "I have my fuel" confirms.
 */
export default function ArrivalScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const draft = useOrderStore((s) => s.order);
  // Server-side fallback when the local draft is empty (Track auto-
  // routed to Arrival via the active-order hook, not via a hot
  // place-order flow). Without this the confirm CTA would silently
  // bail since `draft.orderId` is undefined post-migration.
  const { activeOrder } = useActiveOrder();
  const effectiveOrderId = draft.orderId ?? activeOrder?._id ?? null;

  const total = draft.qty ?? 15;

  /**
   * Dispense animation. The rider's app no longer tracks litres —
   * the customer ordered an exact quantity, so there's nothing to
   * tally up. Instead, when the server flips status to `dispensing`
   * (rider tapped "Dispense"), we run a one-shot 3-second count up
   * from 0 → total. It's a pure UX confirmation that pumping
   * started; the actual quantity isn't measured client-side.
   *
   * Animated.Value drives both the ring progress and the litres
   * counter. The native driver is off because the counter Text
   * needs to listen to the value via addListener.
   */
  const dispenseAnim = useRef(new Animated.Value(0)).current;
  const [filled, setFilled] = useState(0);

  // Track the server status locally so the animation triggers
  // exactly once when `dispensing` arrives. We seed from `arrived`
  // (the screen's entry condition) and listen for order:update.
  const [serverStatus, setServerStatus] = useState<string>("arrived");

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !effectiveOrderId) return;
    const handler = (data: { orderId?: string; status?: string }) => {
      if (data.orderId && data.orderId !== effectiveOrderId) return;
      if (data.status) setServerStatus(data.status);
    };
    socket.on("order:update", handler);
    return () => {
      socket.off("order:update", handler);
    };
  }, [effectiveOrderId]);

  useEffect(() => {
    if (serverStatus !== "dispensing") return;
    dispenseAnim.setValue(0);
    const id = dispenseAnim.addListener(({ value }) => {
      setFilled(value * total);
    });
    Animated.timing(dispenseAnim, {
      toValue: 1,
      duration: 3000,
      useNativeDriver: false,
    }).start();
    return () => {
      dispenseAnim.removeListener(id);
    };
  }, [serverStatus, total, dispenseAnim]);

  const progress = total > 0 ? filled / total : 0;
  const remainingSec = Math.max(0, Math.round((1 - progress) * 3));

  const riderFirstName = draft.rider?.firstName ?? "Your rider";
  const riderFullName = useMemo(() => {
    return (
      [draft.rider?.firstName, draft.rider?.lastName].filter(Boolean).join(" ") ||
      "Your rider"
    );
  }, [draft.rider?.firstName, draft.rider?.lastName]);

  const [confirming, setConfirming] = useState(false);
  const handleConfirm = useCallback(async () => {
    if (!effectiveOrderId) {
      toast.error("Order not loaded", {
        description: "Pull down to refresh and try again.",
      });
      return;
    }
    if (confirming) return;
    setConfirming(true);
    try {
      // PATCH /confirm-delivery flips order.status → "delivered" on
      // the server, which fires the points/notification side-effects
      // and emits order:update. Routing to /delivered immediately
      // gives an instant feel; the next screen reads the same draft.
      // The server only allows this transition from
      // `awaiting_confirmation` (the legacy rider app's "delivered"
      // signal) — if the rider hasn't tapped Delivered yet the
      // server returns 400, which we surface as a friendly toast
      // instead of a stuck button.
      await api.patch(`/api/orders/${effectiveOrderId}/confirm-delivery`);
      router.replace("/(customer)/(track)/delivered" as never);
    } catch (err: any) {
      toast.error("Couldn't confirm delivery", {
        description:
          err?.message ??
          "Ask your rider to tap Delivered, then try again.",
      });
      setConfirming(false);
    }
  }, [effectiveOrderId, confirming, router]);

  const handleCall = useCallback(() => {
    if (draft.rider?.phone) Linking.openURL(`tel:${draft.rider.phone}`);
  }, [draft.rider?.phone]);

  /**
   * Money figures shown in the receipt block. We prefer the active-
   * order hook's server values (they include `deliveryFee`, which the
   * local draft never tracks) and fall back to the locked-station
   * snapshot from the order draft when the hook hasn't returned yet.
   * Without the fallback the receipt would flash zeros for ~1 round-
   * trip on a fresh navigation into Arrival.
   */
  const perUnitNaira = (draft.station?.perUnitKobo ?? 0) / 100;
  const fuelCostNaira =
    activeOrder?.fuelCost ?? (draft.station?.totalKobo ?? 0) / 100;
  const deliveryFeeNaira = activeOrder?.deliveryFee ?? 0;
  const totalNaira =
    activeOrder?.totalPrice ??
    fuelCostNaira + deliveryFeeNaira;
  const paymentLabel =
    activeOrder?.paymentStatus === "paid"
      ? "Wallet"
      : activeOrder?.paymentStatus === "unpaid"
      ? "Pay on delivery"
      : draft.paymentMethodId
      ? "Wallet"
      : "Pay on delivery";

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      {/* Map ribbon — illustrative, not a real MapView for perf */}
      <View
        style={[
          styles.ribbon,
          { paddingTop: insets.top + 16 },
        ]}
      >
        <LinearGradient
          colors={
            theme.mode === "dark"
              ? [theme.palette.green900, theme.palette.green700]
              : [theme.palette.green50, theme.primaryTint]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Animated pulse rings around the rider's "here" check icon.
            The infinite ripple signals "rider is on-site" without
            needing copy — the screen already says RIDER ARRIVED below. */}
        <PulseRings />

        {/* Top overlay buttons */}
        <View
          style={[
            styles.topRow,
            { paddingTop: insets.top + 8 },
          ]}
        >
          <Pressable
            onPress={() => router.replace("/(customer)/(home)" as never)}
            accessibilityRole="button"
            accessibilityLabel="Cancel dispensing"
            style={({ pressed }) => [
              styles.roundBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons name="close" size={20} color={theme.fg} />
          </Pressable>
          <View style={styles.liveWrap}>
            <LiveBadge />
          </View>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <View style={styles.body}>
        <StatusBadge kind="success" pulse withDot>
          RIDER ARRIVED
        </StatusBadge>

        <Text style={styles.h1}>
          {serverStatus === "dispensing" ? "Dispensing now" : "Rider here"}
        </Text>
        <Text style={styles.body1}>
          {serverStatus === "dispensing"
            ? `${riderFirstName} is filling your tank. Stay close — you'll confirm in a sec.`
            : `${riderFirstName} has arrived. Pumping starts as soon as they tap Dispense.`}
        </Text>

        <View style={styles.dispenseCard}>
          <DispenseRing progress={progress} />
          <View style={styles.dispenseBody}>
            <Text style={styles.dispenseTitle}>
              {filled.toFixed(1)} L of {total} L
            </Text>
            <Text style={styles.dispenseSub}>
              {serverStatus !== "dispensing"
                ? "Waiting for rider to start"
                : remainingSec < 1
                ? "Almost done"
                : `~${remainingSec}s remaining`}
            </Text>
          </View>
        </View>

        <View style={styles.riderCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(draft.rider?.initials ?? riderFirstName.charAt(0)).toUpperCase()}
            </Text>
          </View>
          <View style={styles.riderInfo}>
            <Text style={styles.riderName}>{riderFullName}</Text>
            <Text style={styles.riderMeta}>
              {[
                draft.rider?.plate,
                draft.rider?.rating != null
                  ? `★ ${draft.rider.rating.toFixed(1)}`
                  : null,
                "here now",
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
          <Pressable
            onPress={handleCall}
            accessibilityRole="button"
            accessibilityLabel={`Call ${riderFirstName}`}
            style={({ pressed }) => [
              styles.callBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons name="call" size={18} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryEyebrow}>RECEIPT</Text>

          <View style={styles.summaryLineRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.summaryLineTitle} numberOfLines={1}>
                {draft.fuelTypeId
                  ? draft.fuelTypeId.charAt(0).toUpperCase() +
                    draft.fuelTypeId.slice(1)
                  : "Petrol"}
              </Text>
              <Text style={styles.summaryLineSub} numberOfLines={1}>
                {total} {draft.unit ?? "L"}
                {perUnitNaira > 0
                  ? ` · ${formatCurrency(perUnitNaira)}/${draft.unit ?? "L"}`
                  : ""}
              </Text>
            </View>
            <Text style={styles.summaryLineTotal}>
              {formatCurrency(fuelCostNaira)}
            </Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery fee</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(deliveryFeeNaira)}
            </Text>
          </View>

          <View style={styles.summaryTotalRow}>
            <Text style={styles.summaryTotalLabel}>Total</Text>
            <Text style={styles.summaryTotalValue}>
              {formatCurrency(totalNaira)}
            </Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Payment</Text>
            <Text style={styles.summaryValue} numberOfLines={1}>
              {paymentLabel}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Order ID</Text>
            <Text style={styles.summaryValue}>
              #{(effectiveOrderId ?? "—").slice(-6).toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      <FloatingCTA
        label={confirming ? "Confirming…" : "I have my fuel"}
        subtitle="Confirms delivery · final step"
        onPress={handleConfirm}
        loading={confirming}
        disabled={confirming}
        accessibilityLabel="I have my fuel — confirms delivery"
      />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1 },
    ribbon: {
      height: 220,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    topRow: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.space.s4,
    },
    roundBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
      ...theme.elevation.card,
    },
    liveWrap: {
      backgroundColor: theme.surface,
      borderRadius: theme.radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 4,
      ...theme.elevation.card,
    },
    body: {
      flex: 1,
      paddingHorizontal: theme.space.s4,
      paddingTop: theme.space.s4,
      gap: theme.space.s3,
    },
    h1: {
      ...theme.type.h1,
      color: theme.fg,
    },
    body1: {
      ...theme.type.body,
      color: theme.fgMuted,
    },
    dispenseCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s3,
      backgroundColor: theme.primaryTint,
      borderRadius: theme.radius.lg,
      padding: theme.space.s4,
    },
    dispenseBody: { flex: 1, gap: 2 },
    dispenseTitle: {
      ...theme.type.h2,
      color: theme.fg,
      ...theme.type.money,
    },
    dispenseSub: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    riderCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s3,
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: theme.radius.lg,
      paddingHorizontal: theme.space.s3 + 2,
      paddingVertical: theme.space.s3,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.primaryTint,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      ...theme.type.body,
      color: theme.primary,
      fontWeight: "800",
    },
    riderInfo: { flex: 1, gap: 2 },
    riderName: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "800",
    },
    riderMeta: {
      ...theme.type.caption,
      color: theme.fgMuted,
    },
    callBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    summaryCard: {
      backgroundColor: theme.bgMuted,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.space.s3 + 2,
      paddingVertical: theme.space.s3,
      gap: 6,
    },
    summaryEyebrow: {
      fontSize: 10.5,
      fontWeight: "800",
      color: theme.fgMuted,
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    summaryLineRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
    },
    summaryLineTitle: {
      fontSize: 13,
      fontWeight: "800",
      color: theme.fg,
    },
    summaryLineSub: {
      fontSize: 11.5,
      color: theme.fgMuted,
      marginTop: 2,
      ...theme.type.money,
    },
    summaryLineTotal: {
      fontSize: 13,
      fontWeight: "800",
      color: theme.fg,
      ...theme.type.money,
    },
    summaryDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.divider,
      marginVertical: 4,
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    summaryLabel: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    summaryValue: {
      ...theme.type.body,
      ...theme.type.money,
      color: theme.fg,
      fontWeight: "700",
    },
    summaryTotalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 2,
    },
    summaryTotalLabel: {
      fontSize: 12.5,
      fontWeight: "800",
      color: theme.fg,
      letterSpacing: 0.2,
    },
    summaryTotalValue: {
      fontSize: 16,
      fontWeight: "800",
      color: theme.fg,
      ...theme.type.money,
    },
  });
