import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";
import * as Clipboard from "expo-clipboard";
import { toast } from "sonner-native";
import {
  AlertChip,
  AssignRiderSheet,
  type AssignRiderSheetRef,
  Skel,
  SkelStack,
  VendorCard,
  VendorEmptyState,
  VendorPill,
  type PillTone,
  VendorScreenShell,
} from "@/components/ui/vendor";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { type OrderStatus } from "@/components/ui/vendor/OrderRow";

interface OrderDetail {
  _id: string;
  status: OrderStatus;
  quantity: number;
  fuelCost: number;
  deliveryFee: number;
  serviceFee: number;
  totalPrice: number;
  paymentStatus: "unpaid" | "paid" | "refunded";
  riderAssignedAt?: string;
  createdAt: string;
  deliveredAt?: string;
  cancellationReason?: string;
  note?: string;
  user?: { _id: string; displayName?: string; phone?: string; profileImage?: string };
  fuel?: { _id: string; name?: string; unit?: string };
  station?: {
    _id: string;
    name?: string;
    address?: string;
    location?: { lat: number; lng: number };
  };
  deliveryAddress?: { street?: string; city?: string; state?: string; latitude?: number; longitude?: number };
  riderId?: { _id: string; displayName?: string; phone?: string; profileImage?: string } | string | null;
  riderProfile?: { plate?: string; rating?: number } | null;
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  new: "New",
  confirmed: "Confirmed",
  assigned: "Assigned",
  "in-transit": "In-flight",
  awaiting_confirmation: "At gate",
  delivered: "Done",
  cancelled: "Cancelled",
};

const STATUS_TONE: Record<OrderStatus, PillTone> = {
  new: "warning",
  confirmed: "info",
  assigned: "info",
  "in-transit": "primary",
  awaiting_confirmation: "primary",
  delivered: "success",
  cancelled: "neutral",
};

function fmtNaira(value: number): string {
  return `₦${value.toLocaleString("en-NG")}`;
}

function relativeTime(iso: string | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function VendorOrderDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const orderId = params.id;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const sheetRef = useRef<AssignRiderSheetRef>(null);

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await api.get<OrderDetail>(
        `/api/vendor/orders/${orderId}`,
        { timeoutMs: 10_000 },
      );
      setOrder(res);
    } catch (err: any) {
      if (err?.status === 404) {
        // Order doesn't exist or doesn't belong to this vendor — bounce back.
        toast.error("Order not found");
        router.back();
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId, router]);

  useEffect(() => {
    setLoading(true);
    fetchOrder();
  }, [fetchOrder]);

  useFocusEffect(
    useCallback(() => {
      fetchOrder();
    }, [fetchOrder]),
  );

  // WS_VS_API P0 #1 — Phase 2A server now sends `fullOrder` in the
  // vendor's order:update payload. Patch local state directly
  // instead of doing a full GET on every event. Falls back to
  // refetch only when the payload doesn't include fullOrder
  // (old server build or partial event).
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onUpdate = (data: { orderId?: string; fullOrder?: any } | undefined) => {
      if (!data?.orderId || data.orderId !== orderId) return;
      if (data.fullOrder) {
        // Merge — keep populated refs (station, fuel, riderId) from
        // the initial GET; overlay the scalar fields from the
        // socket so we react to status/version/riderId changes.
        setOrder((prev) =>
          prev ? ({ ...prev, ...data.fullOrder } as any) : prev,
        );
      } else {
        fetchOrder();
      }
    };
    // Granular rider-assignment event — patches the rider card
    // without a full refetch when someone else (admin / auto-
    // dispatch) assigns / reassigns.
    const onRiderAssigned = (data: {
      orderId?: string;
      riderId?: string;
      riderName?: string | null;
      riderPlate?: string | null;
    }) => {
      if (!data?.orderId || data.orderId !== orderId) return;
      fetchOrder();
    };
    socket.on("order:update", onUpdate);
    socket.on("order:rider-assigned", onRiderAssigned);
    return () => {
      socket.off("order:update", onUpdate);
      socket.off("order:rider-assigned", onRiderAssigned);
    };
  }, [fetchOrder, orderId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOrder();
  }, [fetchOrder]);

  const riderResolved = useMemo(() => {
    const r = order?.riderId;
    if (!r || typeof r === "string") return null;
    return r;
  }, [order?.riderId]);

  const handleOpenAssign = useCallback(() => {
    if (!order?.station?._id) return;
    const isReassign =
      !!order.riderId && ["assigned", "in-transit"].includes(order.status);
    sheetRef.current?.open({
      orderId: order._id,
      stationId: order.station._id,
      mode: isReassign ? "reassign" : "assign",
      currentRiderId:
        typeof order.riderId === "object" && order.riderId !== null
          ? (order.riderId as any)._id
          : (order.riderId as string | undefined) ?? null,
    });
  }, [order]);

  const handleCallRider = useCallback(() => {
    if (!riderResolved?.phone) return;
    Linking.openURL(`tel:${riderResolved.phone}`).catch(() => {});
  }, [riderResolved?.phone]);

  const handleCopyRiderPhone = useCallback(async () => {
    if (!riderResolved?.phone) return;
    try {
      await Clipboard.setStringAsync(riderResolved.phone);
      toast.success("Phone copied", { description: riderResolved.phone });
    } catch {
      toast.error("Couldn't copy phone");
    }
  }, [riderResolved?.phone]);

  const handleCancel = useCallback(() => {
    if (!order) return;
    Alert.alert(
      "Cancel this order?",
      "The customer will be notified and refunded if they paid.",
      [
        { text: "Keep order", style: "cancel" },
        {
          text: "Cancel order",
          style: "destructive",
          onPress: async () => {
            setCancelling(true);
            try {
              await api.patch(`/api/vendor/orders/${order._id}/cancel`, {});
              toast.success("Order cancelled");
              router.back();
            } catch (err: any) {
              toast.error(err?.message ?? "Couldn't cancel");
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  }, [order, router]);

  const styles = useMemo(() => makeStyles(theme), [theme]);

  // Cancellable statuses.
  const canCancel = order
    ? !["delivered", "cancelled"].includes(order.status)
    : false;

  // Show the "assign" CTA only when there's no rider on the order yet
  // OR when we're still pre-pickup and can swap.
  const showAssign = order
    ? !order.riderId
      ? ["pending", "confirmed"].includes(order.status)
      : ["assigned", "in-transit"].includes(order.status)
    : false;

  return (
    <VendorScreenShell title="Order" hideStationSwitcher>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Back link */}
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to orders"
          hitSlop={6}
          style={({ pressed }) => [
            styles.backRow,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons name="chevron-back" size={18} color={theme.fgMuted} />
          <Text style={styles.backText}>Back to queue</Text>
        </Pressable>

        {loading && !order ? (
          <SkelStack gap={14}>
            <Skel height={80} radius={16} />
            <Skel height={120} radius={16} />
            <Skel height={80} radius={16} />
          </SkelStack>
        ) : !order ? (
          <VendorEmptyState
            icon="cloud-offline-outline"
            headline="Couldn't load order"
            body="Pull down to retry."
          />
        ) : (
          <>
            {/* Order hero — dark gradient matching Today/Wallet */}
            <LinearGradient
              colors={[theme.palette.green700, theme.palette.green900]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.hero}
            >
              <View pointerEvents="none" style={styles.heroCircles}>
                <Svg width={120} height={120} viewBox="0 0 120 120">
                  <Circle
                    cx={60}
                    cy={60}
                    r={50}
                    stroke="#fff"
                    strokeWidth={2}
                    fill="none"
                    opacity={0.08}
                  />
                  <Circle
                    cx={60}
                    cy={60}
                    r={30}
                    stroke="#fff"
                    strokeWidth={2}
                    fill="none"
                    opacity={0.08}
                  />
                </Svg>
              </View>

              <Text style={styles.heroEyebrow}>
                Order · #{order._id.slice(-6).toUpperCase()}
              </Text>

              <Text
                style={styles.heroAmount}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {fmtNaira(order.totalPrice)}
              </Text>
              <Text style={styles.heroSub} numberOfLines={1}>
                {order.user?.displayName ?? "Customer"} · {order.quantity}{" "}
                {order.fuel?.unit ?? ""} {order.fuel?.name ?? ""} ·{" "}
                {relativeTime(order.createdAt)}
              </Text>

              <View style={styles.heroDivider} />

              <View style={styles.heroTileRow}>
                <HeroTile label="Fuel" value={fmtNaira(order.fuelCost)} />
                <HeroTile
                  label="Delivery"
                  value={fmtNaira(order.deliveryFee)}
                />
                <HeroTile
                  label="Status"
                  valueComponent={
                    <View style={styles.heroStatusPill}>
                      <Text style={styles.heroStatusText}>
                        {STATUS_LABEL[order.status]}
                      </Text>
                    </View>
                  }
                />
              </View>
              <Text style={styles.heroPayNote}>
                Payment:{" "}
                {order.paymentStatus === "paid"
                  ? "Paid"
                  : order.paymentStatus === "refunded"
                    ? "Refunded"
                    : "Unpaid"}
              </Text>
            </LinearGradient>

            {/* Cancellation reason (if any) */}
            {order.status === "cancelled" && order.cancellationReason ? (
              <AlertChip
                tone="error"
                title="Cancelled"
                sub={order.cancellationReason}
              />
            ) : null}

            {/* Delivery + customer contact */}
            <VendorCard>
              <Text style={styles.cardLabel}>Deliver to</Text>
              <Text style={styles.deliverPrimary} numberOfLines={2}>
                {order.deliveryAddress?.street ?? "—"}
              </Text>
              <Text style={styles.deliverSecondary} numberOfLines={1}>
                {[order.deliveryAddress?.city, order.deliveryAddress?.state]
                  .filter(Boolean)
                  .join(", ") || ""}
              </Text>

              {order.user?.phone ? (
                <View style={styles.contactRow}>
                  <Pressable
                    onPress={() => Linking.openURL(`tel:${order.user!.phone}`).catch(() => {})}
                    accessibilityRole="button"
                    accessibilityLabel={`Call customer ${order.user.phone}`}
                    hitSlop={6}
                    style={({ pressed }) => [
                      styles.contactBtn,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Ionicons name="call" size={14} color={theme.primary} />
                    <Text style={styles.contactBtnText}>Call</Text>
                  </Pressable>
                  <Pressable
                    onPress={async () => {
                      if (!order.user?._id) return;
                      try {
                        const res = await api.post<{
                          chat: { _id: string };
                        }>("/api/chats", {
                          peerUserId: order.user._id,
                          peerRole: "customer",
                          orderRef: order._id,
                        });
                        router.push({
                          pathname: "/(screens)/chat/[id]" as never,
                          params: { id: res.chat._id } as never,
                        });
                      } catch (err: any) {
                        toast.error(
                          err?.message ?? "Couldn't open chat",
                        );
                      }
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Message customer"
                    hitSlop={6}
                    style={({ pressed }) => [
                      styles.contactBtn,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Ionicons
                      name="chatbubble-ellipses"
                      size={14}
                      color={theme.primary}
                    />
                    <Text style={styles.contactBtnText}>Message</Text>
                  </Pressable>
                  <Pressable
                    onPress={async () => {
                      try {
                        await Clipboard.setStringAsync(order.user!.phone!);
                        toast.success("Phone copied", { description: order.user!.phone });
                      } catch {
                        toast.error("Couldn't copy");
                      }
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Copy customer phone"
                    hitSlop={6}
                    style={({ pressed }) => [
                      styles.contactBtnOutline,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Ionicons name="copy-outline" size={14} color={theme.fg} />
                    <Text style={styles.contactBtnOutlineText}>Copy</Text>
                  </Pressable>
                </View>
              ) : null}

              {order.note ? (
                <View style={styles.noteWrap}>
                  <Text style={styles.cardLabel}>Note</Text>
                  <Text style={styles.note}>{order.note}</Text>
                </View>
              ) : null}
            </VendorCard>

            {/* Rider section */}
            <VendorCard>
              <View style={styles.riderHeader}>
                <Text style={styles.cardLabel}>Rider</Text>
                {showAssign ? (
                  <Pressable
                    onPress={handleOpenAssign}
                    accessibilityRole="button"
                    accessibilityLabel={
                      riderResolved ? "Swap rider" : "Assign rider"
                    }
                    hitSlop={6}
                    style={({ pressed }) => [
                      styles.assignBtn,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={styles.assignBtnText}>
                      {riderResolved ? "Swap" : "Assign"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              {!riderResolved ? (
                <Text style={styles.deliverSecondary}>
                  No rider yet. Tap Assign to pick one.
                </Text>
              ) : (
                <View style={{ gap: 8 }}>
                  <Text style={styles.deliverPrimary}>
                    {riderResolved.displayName ?? "Rider"}
                  </Text>
                  <Text style={styles.deliverSecondary}>
                    {[
                      order.riderProfile?.plate,
                      typeof order.riderProfile?.rating === "number"
                        ? `★ ${order.riderProfile.rating.toFixed(1)}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join("  ·  ")}
                  </Text>
                  {riderResolved.phone ? (
                    <View style={styles.contactRow}>
                      <Pressable
                        onPress={handleCallRider}
                        accessibilityRole="button"
                        accessibilityLabel={`Call rider ${riderResolved.phone}`}
                        hitSlop={6}
                        style={({ pressed }) => [
                          styles.contactBtn,
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <Ionicons name="call" size={14} color={theme.primary} />
                        <Text style={styles.contactBtnText}>Call</Text>
                      </Pressable>
                      <Pressable
                        onPress={async () => {
                          if (!riderResolved?._id) return;
                          try {
                            const res = await api.post<{
                              chat: { _id: string };
                            }>("/api/chats", {
                              peerUserId: riderResolved._id,
                              peerRole: "rider",
                              orderRef: order._id,
                            });
                            router.push({
                              pathname: "/(screens)/chat/[id]" as never,
                              params: { id: res.chat._id } as never,
                            });
                          } catch (err: any) {
                            toast.error(
                              err?.message ?? "Couldn't open chat",
                            );
                          }
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Message rider"
                        hitSlop={6}
                        style={({ pressed }) => [
                          styles.contactBtn,
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <Ionicons
                          name="chatbubble-ellipses"
                          size={14}
                          color={theme.primary}
                        />
                        <Text style={styles.contactBtnText}>Message</Text>
                      </Pressable>
                      <Pressable
                        onPress={handleCopyRiderPhone}
                        accessibilityRole="button"
                        accessibilityLabel="Copy rider phone"
                        hitSlop={6}
                        style={({ pressed }) => [
                          styles.contactBtnOutline,
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <Ionicons name="copy-outline" size={14} color={theme.fg} />
                        <Text style={styles.contactBtnOutlineText}>Copy</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              )}
            </VendorCard>

            {canCancel ? (
              <Pressable
                onPress={handleCancel}
                disabled={cancelling}
                accessibilityRole="button"
                accessibilityLabel="Cancel this order"
                style={({ pressed }) => [
                  styles.cancelBtn,
                  pressed && { opacity: 0.85 },
                  cancelling && { opacity: 0.6 },
                ]}
              >
                <Ionicons name="close-circle" size={16} color={theme.error} />
                <Text style={styles.cancelBtnText}>
                  {cancelling ? "Cancelling…" : "Cancel order"}
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>

      <AssignRiderSheet
        ref={sheetRef}
        onAssigned={() => fetchOrder()}
      />
    </VendorScreenShell>
  );
}

function HeroTile({
  label,
  value,
  valueComponent,
}: {
  label: string;
  value?: string;
  valueComponent?: React.ReactNode;
}) {
  return (
    <View style={heroTileStyles.tile}>
      <Text style={heroTileStyles.label} numberOfLines={1}>
        {label}
      </Text>
      {valueComponent ?? (
        <Text style={heroTileStyles.value} numberOfLines={1}>
          {value}
        </Text>
      )}
    </View>
  );
}

const heroTileStyles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  label: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  value: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
  },
});

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    scroll: {
      padding: 20,
      gap: 14,
      paddingBottom: 80,
    },
    backRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginBottom: -4,
    },
    backText: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      fontWeight: "600",
    },
    hero: {
      borderRadius: 20,
      padding: 20,
      overflow: "hidden",
      position: "relative",
    },
    heroCircles: {
      position: "absolute",
      right: -20,
      top: -20,
    },
    heroEyebrow: {
      fontSize: 11,
      fontWeight: "800",
      color: "rgba(255,255,255,0.7)",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    heroAmount: {
      fontSize: 38,
      fontWeight: "800",
      letterSpacing: -0.8,
      color: "#fff",
      marginTop: 8,
    },
    heroSub: {
      fontSize: 12,
      color: "rgba(255,255,255,0.75)",
      marginTop: 2,
    },
    heroDivider: {
      marginTop: 14,
      marginBottom: 14,
      borderTopWidth: 1,
      borderTopColor: "rgba(255,255,255,0.14)",
    },
    heroTileRow: {
      flexDirection: "row",
      gap: 12,
    },
    heroStatusPill: {
      alignSelf: "flex-start",
      backgroundColor: "rgba(255,255,255,0.18)",
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    heroStatusText: {
      fontSize: 11,
      fontWeight: "800",
      color: "#fff",
      letterSpacing: 0.3,
    },
    heroPayNote: {
      fontSize: 11.5,
      color: "rgba(255,255,255,0.75)",
      fontWeight: "600",
      marginTop: 12,
    },
    cardLabel: {
      ...theme.type.caption,
      color: theme.fgMuted,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginBottom: 4,
    },
    deliverPrimary: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
    },
    deliverSecondary: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    contactRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 10,
    },
    contactBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.primaryTint,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: theme.radius.pill,
    },
    contactBtnText: {
      ...theme.type.bodySm,
      color: theme.primary,
      fontWeight: "700",
    },
    contactBtnOutline: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.bgMuted,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: theme.radius.pill,
    },
    contactBtnOutlineText: {
      ...theme.type.bodySm,
      color: theme.fg,
      fontWeight: "700",
    },
    noteWrap: { marginTop: 12 },
    note: {
      ...theme.type.body,
      color: theme.fg,
    },
    riderHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    assignBtn: {
      backgroundColor: theme.primary,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: theme.radius.pill,
    },
    assignBtnText: {
      ...theme.type.bodySm,
      color: theme.fgOnPrimary,
      fontWeight: "800",
    },
    cancelBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.errorTint,
      borderWidth: 1,
      borderColor: theme.error + "33",
    },
    cancelBtnText: {
      ...theme.type.body,
      color: theme.error,
      fontWeight: "700",
    },
  });

