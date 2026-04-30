import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { toast } from "sonner-native";
import { Theme, useTheme, formatCurrency } from "@/constants/theme";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useOrderStore } from "@/store/useOrderStore";
import {
  FloatingCTA,
  ScreenContainer,
  ScreenHeader,
} from "@/components/ui/primitives";
import {
  OrderStatus,
  getStatusLabel,
  isActiveStatus,
  isTerminalStatus,
} from "@/utils/orderStatusLabels";

/**
 * Order detail — v3.
 *
 * Shows a single order with:
 *   1. Status hero (primary-tinted card with status icon, fuel summary,
 *      delivered/cancelled/active sub-line with door-to-door time).
 *   2. Timeline — server status mapped to a canonical 5-step ladder.
 *      Steps that have happened render with a primary check; steps
 *      ahead render muted. Connector line goes between dots.
 *   3. Rider card (when assigned) — initials avatar, name, plate,
 *      rating. Customer-safe fields only — no phone unless the order
 *      is at-gate.
 *   4. Receipt — line items, total paid, payment method + timestamp.
 *      Pulls from server's totalCharged when set, otherwise totalPrice.
 *   5. "Get help with this order" link → support route.
 *   6. Floating "Reorder" CTA (only for terminal orders) that hydrates
 *      the OrderStore from this order and routes to Stations to lock a
 *      fresh price (server prices change daily; we never replay an old
 *      `totalKobo`).
 *
 * Live orders surface a "Track order" CTA instead of Reorder, since
 * tapping Reorder on an in-flight order would just be confusing.
 */

interface ServerRider {
  _id: string;
  displayName?: string;
  phone?: string;
  profileImage?: string;
}

interface ServerOrderDetail {
  _id: string;
  status: OrderStatus;
  product?: "liquid" | "lpg";
  paymentStatus: "unpaid" | "paid" | "refunded";
  paymentMethod?: string; // "wallet" | "card" | "transfer" | etc
  totalPrice: number;
  totalCharged?: number;
  serviceFee?: number;
  deliveryFee?: number;
  pointsEarned?: number;
  pointsRedeemed?: number;
  createdAt: string;
  updatedAt?: string;
  deliveredAt?: string | null;
  fuel?: { _id?: string; name: string; unit: string };
  fuelTypeId?: string;
  station?: {
    _id?: string;
    name?: string;
    shortName?: string;
    address?: string;
  };
  deliveryAddress?: {
    _id?: string;
    label?: string;
    address?: string;
    location?: { lat: number; lng: number };
  };
  quantity?: number;
  cylinderType?: string;
  deliveryType?: "home_refill" | "cylinder_swap";
  riderId?: string | ServerRider | null;
  riderProfile?: { plate?: string; rating?: number } | null;
  timeline?: Array<{ status: string; at: string; note?: string }>;
}

const TIMELINE_STEPS: Array<{
  key: string;
  label: string;
  matches: OrderStatus[];
}> = [
  {
    key: "placed",
    label: "Order placed",
    matches: ["draft", "pending_payment", "confirmed"],
  },
  {
    key: "confirmed",
    label: "Station confirmed",
    matches: ["confirmed", "assigning"],
  },
  {
    key: "rider",
    label: "Rider assigned",
    matches: ["assigned", "picked_up", "at_plant", "refilling"],
  },
  {
    key: "out",
    label: "Out for delivery",
    matches: ["picked_up", "returning", "arrived", "dispensing"],
  },
  {
    key: "delivered",
    label: "Delivered",
    matches: ["delivered", "rated", "closed"],
  },
];

function formatTime(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatRelativeDay(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (sameDay) return `Today at ${formatTime(iso)}`;
  if (isYesterday) return `Yesterday at ${formatTime(iso)}`;
  return d.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  }) + ` at ${formatTime(iso)}`;
}

function summaryFor(o: ServerOrderDetail): string {
  const stationName = o.station?.shortName ?? o.station?.name ?? "—";
  if (o.product === "lpg") {
    const unit = o.cylinderType ? `${o.cylinderType} LPG` : "LPG";
    const kind = o.deliveryType === "cylinder_swap" ? "swap" : "refill";
    return `${unit} ${kind} · ${stationName}`;
  }
  const unit = o.fuel?.unit ?? "L";
  const name = o.fuel?.name ?? "Petrol";
  const qty = o.quantity ?? 0;
  return `${qty} ${unit} ${name} · ${stationName}`;
}

function paymentLine(o: ServerOrderDetail): string {
  const method =
    o.paymentMethod === "wallet"
      ? "Gaznger wallet"
      : o.paymentMethod === "card"
      ? "Card"
      : o.paymentMethod === "transfer"
      ? "Bank transfer"
      : "Payment";
  const stamp = formatRelativeDay(o.deliveredAt ?? o.updatedAt ?? o.createdAt);
  return `${method} · ${stamp}`;
}

function initialsFrom(name?: string): string {
  if (!name) return "•";
  return name
    .split(/\s+/)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

export default function OrderDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { id } = useLocalSearchParams<{ id: string }>();

  const startOrder = useOrderStore((s) => s.startOrder);
  const setQty = useOrderStore((s) => s.setQty);
  const setSelectedAddress = useOrderStore((s) => s.setSelectedAddress);
  const setServiceType = useOrderStore((s) => s.setServiceType);

  const [order, setOrder] = useState<ServerOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await api.get<ServerOrderDetail>(`/api/orders/${id}`);
      setOrder(data);
    } catch (err: any) {
      toast.error("Couldn't load order", {
        description: err?.message ?? "Try again later.",
      });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Live status updates — when this order's status flips on the server
   * (rider transitions, delivery confirm, etc.), patch the local copy
   * in place. We only refetch the full document if the status moves
   * to `delivered` or any cancelled state — those flips can carry
   * extra fields (deliveredAt, totalCharged, pointsEarned) that the
   * socket payload doesn't always include.
   */
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !id) return;
    const onUpdate = (data: { orderId?: string; status?: string }) => {
      if (!data?.orderId || data.orderId !== id || !data.status) return;
      setOrder((prev) =>
        prev ? { ...prev, status: data.status as OrderStatus } : prev
      );
      if (
        data.status === "delivered" ||
        String(data.status).startsWith("cancelled")
      ) {
        load();
      }
    };
    socket.on("order:update", onUpdate);
    return () => {
      socket.off("order:update", onUpdate);
    };
  }, [id, load]);

  /**
   * Reorder = repopulate the draft from this order's product/fuel/qty/
   * address and route to Stations so the user picks a fresh station +
   * locks today's price. We don't replay the old `totalKobo` — fuel
   * prices move daily, and the server is the source of truth.
   */
  const reorder = useCallback(() => {
    if (!order) return;
    if (!order.fuelTypeId && !order.fuel?._id) {
      Alert.alert(
        "Can't reorder",
        "We're missing fuel info on this order. Place a new one from Home."
      );
      return;
    }
    startOrder({
      product: order.product ?? "liquid",
      fuelTypeId:
        order.fuelTypeId ?? (order.fuel?._id as string) ?? "petrol",
      label: order.fuel?.name,
      unit: (order.fuel?.unit as "L" | "kg") ?? "L",
    });
    if (order.quantity) setQty(order.quantity);
    if (order.deliveryType === "cylinder_swap") setServiceType("swap");
    else if (order.deliveryType === "home_refill") setServiceType("refill");
    if (order.deliveryAddress?._id) {
      setSelectedAddress({
        id: order.deliveryAddress._id,
        label: order.deliveryAddress.label,
        coords: order.deliveryAddress.location,
      });
    }
    router.push("/(customer)/(order)/stations" as never);
  }, [order, router, startOrder, setQty, setSelectedAddress, setServiceType]);

  const trackOrder = useCallback(() => {
    router.push("/(customer)/(track)" as never);
  }, [router]);

  if (loading) {
    return (
      <ScreenContainer
        edges={["top", "bottom"]}
        header={<ScreenHeader title="Order" onBack={() => router.back()} />}
      >
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={theme.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (!order) {
    return (
      <ScreenContainer
        edges={["top", "bottom"]}
        header={<ScreenHeader title="Order" onBack={() => router.back()} />}
      >
        <View style={styles.loadingWrap}>
          <Text style={{ color: theme.fgMuted }}>Order not available.</Text>
        </View>
      </ScreenContainer>
    );
  }

  const status = getStatusLabel({
    status: order.status,
    product: order.product,
  });
  const isLive = isActiveStatus(order.status);
  const isTerminal = isTerminalStatus(order.status);
  const isCancelled = status.kind === "error";
  const shortRef = order._id.slice(-6).toUpperCase();
  const total =
    typeof order.totalCharged === "number"
      ? order.totalCharged
      : order.totalPrice;

  // Rider name + plate when assigned.
  const rider =
    order.riderId && typeof order.riderId === "object"
      ? (order.riderId as ServerRider)
      : null;
  const riderName = rider?.displayName ?? null;
  const riderPlate = order.riderProfile?.plate;
  const riderRating = order.riderProfile?.rating;

  // Receipt line items.
  const subtotal = Math.max(
    0,
    total -
      (order.serviceFee ?? 0) -
      (order.deliveryFee ?? 0) +
      (order.pointsRedeemed ?? 0)
  );
  const lineItems: Array<{ label: string; amount: number; kind?: "points" | "credit" }> = [
    { label: summaryFor(order), amount: subtotal },
  ];
  if (order.serviceFee) {
    lineItems.push({ label: "Service fee", amount: order.serviceFee });
  }
  if (order.deliveryFee) {
    lineItems.push({ label: "Delivery fee", amount: order.deliveryFee });
  }
  if (order.pointsEarned) {
    lineItems.push({
      label: "Points earned",
      amount: order.pointsEarned,
      kind: "points",
    });
  }
  if (order.pointsRedeemed) {
    lineItems.push({
      label: `Points redeemed (${order.pointsRedeemed})`,
      amount: -order.pointsRedeemed,
      kind: "credit",
    });
  }

  const heroAccent = isCancelled
    ? theme.errorTint
    : status.kind === "success"
    ? theme.successTint
    : theme.primaryTint;
  const heroIconBg = isCancelled
    ? theme.error
    : status.kind === "success"
    ? theme.success
    : theme.primary;
  const heroIcon = isCancelled
    ? "close"
    : status.kind === "success"
    ? "checkmark"
    : "time";

  return (
    <ScreenContainer
      edges={["top", "bottom"]}
      header={
        <ScreenHeader title={`Order #G-${shortRef}`} onBack={() => router.back()} />
      }
      footer={
        isTerminal && !isCancelled ? (
          <FloatingCTA
            label="Reorder"
            subtitle="Same fuel, same address"
            onPress={reorder}
            floating={false}
          />
        ) : isLive ? (
          <FloatingCTA
            label="Track order"
            subtitle="See live progress"
            onPress={trackOrder}
            floating={false}
          />
        ) : undefined
      }
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Status hero */}
        <View style={[styles.hero, { backgroundColor: heroAccent }]}>
          <View style={styles.heroHead}>
            <View style={[styles.heroIcon, { backgroundColor: heroIconBg }]}>
              <Ionicons name={heroIcon} size={14} color="#fff" />
            </View>
            <Text
              style={[
                styles.heroStatus,
                {
                  color: isCancelled
                    ? theme.error
                    : status.kind === "success"
                    ? theme.success
                    : theme.mode === "dark"
                    ? "#fff"
                    : theme.palette.green700,
                },
              ]}
            >
              {status.label}
            </Text>
          </View>
          <Text style={styles.heroTitle}>{summaryFor(order)}</Text>
          <Text style={styles.heroSub}>
            {order.deliveredAt
              ? `Delivered ${formatRelativeDay(order.deliveredAt)}`
              : `Placed ${formatRelativeDay(order.createdAt)}`}
          </Text>
        </View>

        {/* Timeline */}
        {!isCancelled ? (
          <>
            <Text style={styles.sectionLabel}>TIMELINE</Text>
            <Timeline order={order} theme={theme} />
          </>
        ) : null}

        {/* Rider card */}
        {riderName ? (
          <>
            <Text style={styles.sectionLabel}>YOUR RIDER</Text>
            <View style={styles.riderCard}>
              <View style={styles.riderAvatar}>
                <Text style={styles.riderInitials}>
                  {initialsFrom(riderName)}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.riderName}>{riderName}</Text>
                <View style={styles.riderMetaRow}>
                  {riderPlate ? (
                    <Text style={styles.riderMeta}>{riderPlate}</Text>
                  ) : null}
                  {riderRating ? (
                    <>
                      <Text style={styles.riderMetaDot}>·</Text>
                      <View style={styles.riderRating}>
                        <Ionicons
                          name="star"
                          size={10}
                          color={
                            theme.mode === "dark"
                              ? theme.palette.gold300
                              : theme.palette.gold700
                          }
                        />
                        <Text style={styles.riderMeta}>
                          {riderRating.toFixed(1)}
                        </Text>
                      </View>
                    </>
                  ) : null}
                </View>
              </View>
            </View>
          </>
        ) : null}

        {/* Receipt */}
        <Text style={styles.sectionLabel}>RECEIPT</Text>
        <View style={styles.receiptCard}>
          {lineItems.map((row, i) => (
            <View key={`${row.label}-${i}`} style={styles.receiptRow}>
              <Text style={styles.receiptLabel} numberOfLines={1}>
                {row.label}
              </Text>
              <Text
                style={[
                  styles.receiptAmount,
                  row.kind === "points" && {
                    color:
                      theme.mode === "dark"
                        ? theme.palette.gold300
                        : theme.palette.gold700,
                  },
                  row.kind === "credit" && { color: theme.success },
                ]}
              >
                {row.kind === "points"
                  ? `+${row.amount} pts`
                  : `${row.amount < 0 ? "−" : ""}${formatCurrency(
                      Math.abs(row.amount)
                    )}`}
              </Text>
            </View>
          ))}

          <View style={styles.receiptDivider} />

          <View style={styles.receiptRow}>
            <Text style={styles.receiptTotalLabel}>
              {isCancelled ? "Refunded" : "Paid"}
            </Text>
            <Text style={styles.receiptTotalAmount}>
              {formatCurrency(total)}
            </Text>
          </View>

          <View style={styles.receiptMeta}>
            <Ionicons
              name={
                order.paymentMethod === "wallet" ? "wallet" : "card"
              }
              size={12}
              color={theme.fgMuted}
            />
            <Text style={styles.receiptMetaText}>{paymentLine(order)}</Text>
          </View>
        </View>

        {/* Help */}
        <Pressable
          onPress={() => router.push("/(screens)/help-support" as never)}
          accessibilityRole="button"
          accessibilityLabel="Get help with this order"
          style={({ pressed }) => [
            styles.helpRow,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.helpText}>Get help with this order</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

/* ─────────────────────── Timeline ─────────────────────────── */

function Timeline({
  order,
  theme,
}: {
  order: ServerOrderDetail;
  theme: Theme;
}) {
  const styles = timelineStyles(theme);

  // For each canonical step, find when (if ever) it became active by
  // scanning the server timeline. Falls back to inferring from current
  // status: every step at-or-below the current one is "done".
  const computed = TIMELINE_STEPS.map((step, idx) => {
    const reachedFromTimeline = order.timeline?.find((t) =>
      step.matches.includes(t.status as OrderStatus)
    );
    const reachedFromStatus = TIMELINE_STEPS.findIndex((s) =>
      s.matches.includes(order.status)
    );
    const done = reachedFromTimeline
      ? true
      : reachedFromStatus >= 0 && idx <= reachedFromStatus;
    const time = reachedFromTimeline
      ? formatTime(reachedFromTimeline.at)
      : idx === 0
      ? formatTime(order.createdAt)
      : done && idx === TIMELINE_STEPS.length - 1 && order.deliveredAt
      ? formatTime(order.deliveredAt)
      : "";
    const note = reachedFromTimeline?.note;
    return { step, done, time, note };
  });

  return (
    <View style={styles.card}>
      {computed.map((c, i) => (
        <View key={c.step.key} style={styles.row}>
          {i < computed.length - 1 ? (
            <View
              style={[
                styles.connector,
                {
                  backgroundColor: c.done ? theme.success : theme.bgMuted,
                  opacity: c.done ? 0.4 : 1,
                },
              ]}
            />
          ) : null}
          <View
            style={[
              styles.dot,
              {
                backgroundColor: c.done ? theme.success : theme.bgMuted,
                borderColor: theme.surface,
              },
            ]}
          >
            {c.done ? (
              <Ionicons name="checkmark" size={11} color="#fff" />
            ) : null}
          </View>
          <View style={styles.body}>
            <View style={styles.headRow}>
              <Text
                style={[
                  styles.label,
                  !c.done && { color: theme.fgMuted },
                ]}
              >
                {c.step.label}
              </Text>
              {c.time ? <Text style={styles.time}>{c.time}</Text> : null}
            </View>
            {c.note ? <Text style={styles.note}>{c.note}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const timelineStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      marginHorizontal: theme.space.s4,
      backgroundColor: theme.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.divider,
      paddingVertical: 4,
    },
    row: {
      flexDirection: "row",
      gap: 14,
      paddingHorizontal: 16,
      paddingVertical: 12,
      position: "relative",
    },
    connector: {
      position: "absolute",
      left: 27,
      top: 30,
      bottom: -8,
      width: 2,
    },
    dot: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      zIndex: 1,
      flexShrink: 0,
    },
    body: { flex: 1, minWidth: 0 },
    headRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
      gap: 8,
    },
    label: {
      fontSize: 13.5,
      fontWeight: "700",
      color: theme.fg,
    },
    time: {
      fontSize: 11.5,
      color: theme.fgMuted,
      ...theme.type.money,
    },
    note: {
      fontSize: 11.5,
      color: theme.fgMuted,
      marginTop: 2,
      lineHeight: 16,
    },
  });

/* ─────────────────────── Styles ─────────────────────────── */

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    scroll: {
      paddingBottom: theme.space.s5 + 16,
    },
    loadingWrap: {
      paddingVertical: 40,
      alignItems: "center",
    },

    /* Hero */
    hero: {
      marginHorizontal: theme.space.s4,
      marginTop: theme.space.s1,
      marginBottom: theme.space.s2,
      padding: 18,
      borderRadius: 16,
      borderWidth: 1,
      borderColor:
        theme.mode === "dark" ? theme.border : theme.palette.green100,
    },
    heroHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 6,
    },
    heroIcon: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    heroStatus: {
      fontSize: 14,
      fontWeight: "800",
    },
    heroTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: theme.fg,
      letterSpacing: -0.2,
      marginBottom: 2,
    },
    heroSub: {
      fontSize: 12,
      color: theme.fgMuted,
    },

    /* Section labels */
    sectionLabel: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.fgMuted,
      letterSpacing: 0.5,
      paddingHorizontal: theme.space.s4,
      paddingTop: theme.space.s4,
      paddingBottom: theme.space.s2,
    },

    /* Rider card */
    riderCard: {
      marginHorizontal: theme.space.s4,
      backgroundColor: theme.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.divider,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    riderAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.primaryTint,
      alignItems: "center",
      justifyContent: "center",
    },
    riderInitials: {
      fontSize: 14,
      fontWeight: "800",
      color: theme.mode === "dark" ? "#fff" : theme.palette.green700,
    },
    riderName: {
      fontSize: 14,
      fontWeight: "800",
      color: theme.fg,
    },
    riderMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 2,
    },
    riderMeta: {
      fontSize: 11.5,
      color: theme.fgMuted,
      ...theme.type.money,
    },
    riderMetaDot: {
      fontSize: 11.5,
      color: theme.fgMuted,
    },
    riderRating: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
    },

    /* Receipt */
    receiptCard: {
      marginHorizontal: theme.space.s4,
      backgroundColor: theme.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.divider,
      padding: 14,
    },
    receiptRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
      paddingVertical: 5,
    },
    receiptLabel: {
      fontSize: 12.5,
      color: theme.fgMuted,
      flex: 1,
      paddingRight: 8,
    },
    receiptAmount: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.fg,
      ...theme.type.money,
    },
    receiptDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.divider,
      marginVertical: 8,
    },
    receiptTotalLabel: {
      fontSize: 14,
      fontWeight: "800",
      color: theme.fg,
    },
    receiptTotalAmount: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.fg,
      letterSpacing: -0.3,
      ...theme.type.money,
    },
    receiptMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 8,
    },
    receiptMetaText: {
      fontSize: 11.5,
      color: theme.fgMuted,
    },

    /* Help link */
    helpRow: {
      paddingHorizontal: 16,
      paddingTop: 20,
      paddingBottom: 8,
      alignItems: "center",
    },
    helpText: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.mode === "dark" ? "#fff" : theme.palette.green700,
    },
  });
