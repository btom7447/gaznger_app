import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { toast } from "sonner-native";
import { Theme, useTheme, formatCurrency } from "@/constants/theme";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import {
  Chip,
  ScreenContainer,
  ScreenHeader,
  Skeleton,
  StatusBadge,
} from "@/components/ui/primitives";
import {
  OrderStatus,
  getStatusLabel,
} from "@/utils/orderStatusLabels";

/**
 * Order history — v3.
 *
 * Lives inside the (order) group at `(customer)/(order)/history` so the
 * detail screen `[id].tsx` can sit beside it as siblings (per locked
 * decision (10b): order history stays in the order folder since it's
 * part of the order flow). The Order tab itself routes to `index`, so
 * this screen is reachable only via Profile → Order history, the Home
 * Recent-orders rail, or the Notifications screen — NOT a tab.
 *
 * Layout:
 *   1. Filter chips: All / Active / Delivered / Cancelled with counts
 *      derived from the page response. Active uses the primary chip
 *      kind (green) since "in flight" deserves emphasis.
 *   2. v3 Order cards with primary-tinted fuel-icon tile, status
 *      badge with optional pulse, fuel summary, station, date, and
 *      a right-aligned total + chevron.
 *   3. Empty state per filter (different copy when "Active" is empty
 *      vs "All").
 *   4. Pagination via on-end-reached infinite scroll.
 */

interface ServerOrder {
  _id: string;
  status: OrderStatus;
  product?: "liquid" | "lpg";
  paymentStatus: "unpaid" | "paid" | "refunded";
  totalPrice: number;
  totalCharged?: number;
  createdAt: string;
  fuel?: { name: string; unit: string };
  station?: { name?: string; shortName?: string; address?: string };
  quantity?: number;
  cylinderType?: string;
  deliveryType?: "home_refill" | "cylinder_swap";
}

type FilterKey = "all" | "active" | "delivered" | "cancelled";

const FILTERS: {
  key: FilterKey;
  label: string;
  kind: "neutral" | "primary";
  statusFilter?: string;
}[] = [
  { key: "all", label: "All", kind: "neutral" },
  {
    key: "active",
    label: "Active",
    kind: "primary",
    statusFilter:
      "pending_payment,confirmed,assigning,assigned,picked_up,at_plant,refilling,returning,arrived,dispensing",
  },
  {
    key: "delivered",
    label: "Delivered",
    kind: "neutral",
    statusFilter: "delivered,rated,closed",
  },
  {
    key: "cancelled",
    label: "Cancelled",
    kind: "neutral",
    statusFilter:
      "cancelled_by_customer,cancelled_by_vendor,cancelled_by_rider,failed_payment",
  },
];

const PAGE_SIZE = 15;

const EMPTY_COPY: Record<FilterKey, { title: string; body: string }> = {
  all: {
    title: "No orders yet",
    body: "Your orders will live here once you start a delivery.",
  },
  active: {
    title: "Nothing in motion",
    body: "No orders are being delivered right now.",
  },
  delivered: {
    title: "Nothing delivered yet",
    body: "Once an order completes, it'll show up here.",
  },
  cancelled: {
    title: "No cancellations",
    body: "Clean record. Keep it that way.",
  },
};

function relativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const time = d.toLocaleTimeString("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  if (sameDay) return `Today · ${time}`;
  if (isYesterday) return `Yesterday · ${time}`;
  if (now.getTime() - d.getTime() < 7 * 24 * 60 * 60 * 1000) {
    const day = d.toLocaleDateString("en-NG", { weekday: "short" });
    return `${day} · ${time}`;
  }
  return d.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function fuelIconFor(o: ServerOrder): React.ComponentProps<typeof Ionicons>["name"] {
  if (o.product === "lpg") return "cube-outline";
  return "flame";
}

function summaryFor(o: ServerOrder): string {
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

export default function HistoryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [orders, setOrders] = useState<ServerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCounts, setTotalCounts] = useState<Record<FilterKey, number>>({
    all: 0,
    active: 0,
    delivered: 0,
    cancelled: 0,
  });

  /**
   * Fetch a page of orders for the current filter. The server returns
   * the bucket total as `total`, which we mirror into `totalCounts[filter]`
   * so the chip counts reflect server truth without needing a separate
   * counts endpoint.
   */
  const load = useCallback(
    async (
      activeFilter: FilterKey = filter,
      pageNum = 1,
      append = false
    ) => {
      if (!append && pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      try {
        const cfg = FILTERS.find((f) => f.key === activeFilter);
        const params = new URLSearchParams({
          page: String(pageNum),
          limit: String(PAGE_SIZE),
        });
        if (cfg?.statusFilter) params.set("status", cfg.statusFilter);
        const res = await api.get<{
          data: ServerOrder[];
          total: number;
          totalPages: number;
          page: number;
        }>(`/api/orders?${params.toString()}`);
        setOrders((prev) => {
          // Dedupe by _id when appending — onEndReached can double-fire
          // before the first response lands, and the socket order:update
          // patch can race with pagination. Keeping the dedupe here is
          // cheaper than gating onEndReached with a ref because it also
          // covers the socket-update race.
          if (!append) return res.data ?? [];
          const incoming = res.data ?? [];
          const seen = new Set(prev.map((o) => o._id));
          const fresh = incoming.filter((o) => !seen.has(o._id));
          return [...prev, ...fresh];
        });
        setTotalPages(res.totalPages ?? 1);
        setPage(res.page ?? pageNum);
        setTotalCounts((prev) => ({
          ...prev,
          [activeFilter]: res.total ?? prev[activeFilter] ?? 0,
        }));
      } catch (err: any) {
        toast.error("Couldn't load orders", {
          description: err?.message ?? "Pull to retry.",
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [filter]
  );

  useEffect(() => {
    load(filter, 1, false);
  }, [filter, load]);

  /**
   * Live status updates — when the server emits `order:update` for any
   * of the user's orders, patch that row in place without refetching
   * the whole page. Keeps the badge counts honest as orders move
   * between Active → Delivered → Cancelled in real time.
   */
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onOrderUpdate = (data: { orderId?: string; status?: string }) => {
      if (!data?.orderId || !data?.status) return;
      setOrders((prev) =>
        prev.map((o) =>
          o._id === data.orderId
            ? { ...o, status: data.status as OrderStatus }
            : o
        )
      );
    };
    socket.on("order:update", onOrderUpdate);
    return () => {
      socket.off("order:update", onOrderUpdate);
    };
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(filter, 1, false);
  }, [filter, load]);

  const onEndReached = useCallback(() => {
    if (loadingMore || page >= totalPages) return;
    load(filter, page + 1, true);
  }, [filter, loadingMore, page, totalPages, load]);

  const subtitle = orders.length
    ? `${totalCounts[filter] || orders.length} ${
        (totalCounts[filter] || orders.length) === 1 ? "order" : "orders"
      }`
    : undefined;

  return (
    <ScreenContainer
      edges={["top", "bottom"]}
      noScroll
      header={
        <ScreenHeader
          title="Your orders"
          subtitle={subtitle}
          onBack={() => router.back()}
        />
      }
    >
      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {FILTERS.map((f) => (
          <Chip
            key={f.key}
            selected={filter === f.key}
            kind={f.kind}
            count={totalCounts[f.key] || undefined}
            onPress={() => setFilter(f.key)}
            accessibilityLabel={`${f.label} filter`}
          >
            {f.label}
          </Chip>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.skeletonList}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton
              key={i}
              width="100%"
              height={92}
              borderRadius={14}
              style={{ marginBottom: 10 }}
            />
          ))}
        </View>
      ) : orders.length === 0 ? (
        <EmptyForFilter filter={filter} theme={theme} router={router} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o._id}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              theme={theme}
              onPress={() =>
                router.push({
                  pathname: "/(customer)/(order)/[id]",
                  params: { id: item._id },
                } as never)
              }
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: theme.space.s3 }}>
                <Skeleton
                  width="100%"
                  height={48}
                  borderRadius={theme.radius.lg}
                />
              </View>
            ) : (
              <Text style={styles.endNote}>
                Pull down to refresh · scroll for older
              </Text>
            )
          }
        />
      )}
    </ScreenContainer>
  );
}

/* ─────────────────────── Order card ─────────────────────────── */

function OrderCard({
  order,
  theme,
  onPress,
}: {
  order: ServerOrder;
  theme: Theme;
  onPress: () => void;
}) {
  const status = getStatusLabel({
    status: order.status,
    product: order.product,
  });
  const total =
    typeof order.totalCharged === "number"
      ? order.totalCharged
      : order.totalPrice;
  const isCancelled = status.kind === "error" && total === 0;
  const shortRef = order._id.slice(-6).toUpperCase();
  const styles = cardStyles(theme);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Order ${shortRef}, ${status.label}`}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
    >
      <View style={styles.iconTile}>
        <Ionicons
          name={fuelIconFor(order)}
          size={18}
          color={theme.mode === "dark" ? "#fff" : theme.palette.green700}
        />
      </View>
      <View style={styles.body}>
        <View style={styles.headRow}>
          <Text style={styles.refTag}>#G-{shortRef}</Text>
          <StatusBadge kind={status.kind} pulse={status.pulse} compact>
            {status.label}
          </StatusBadge>
        </View>
        <Text style={styles.summary} numberOfLines={1}>
          {summaryFor(order)}
        </Text>
        <Text style={styles.dateText}>{relativeDate(order.createdAt)}</Text>
      </View>
      <View style={styles.right}>
        {!isCancelled && total > 0 ? (
          <Text style={styles.amount}>{formatCurrency(total)}</Text>
        ) : (
          <Text style={styles.dash}>—</Text>
        )}
        <Ionicons
          name="chevron-forward"
          size={14}
          color={theme.fgMuted}
          style={{ marginTop: 4 }}
        />
      </View>
    </Pressable>
  );
}

/* ─────────────────────── Empty state ─────────────────────────── */

function EmptyForFilter({
  filter,
  theme,
  router,
}: {
  filter: FilterKey;
  theme: Theme;
  router: ReturnType<typeof useRouter>;
}) {
  const copy = EMPTY_COPY[filter];
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconTile}>
        <Ionicons name="receipt-outline" size={32} color={theme.fgMuted} />
      </View>
      <Text style={styles.emptyTitle}>{copy.title}</Text>
      <Text style={styles.emptyBody}>{copy.body}</Text>
      {filter === "all" ? (
        <Pressable
          onPress={() => router.push("/(customer)/(home)" as never)}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.emptyCta,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.emptyCtaText}>Place an order</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ─────────────────────── Styles ─────────────────────────── */

const cardStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      padding: 14,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.divider,
      borderRadius: 14,
      marginBottom: 10,
    },
    iconTile: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: theme.primaryTint,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    body: { flex: 1, minWidth: 0, gap: 4 },
    headRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    refTag: {
      fontSize: 11.5,
      fontWeight: "800",
      color: theme.fgMuted,
      ...theme.type.money,
    },
    summary: {
      fontSize: 13.5,
      fontWeight: "700",
      color: theme.fg,
    },
    dateText: {
      fontSize: 11.5,
      color: theme.fgMuted,
    },
    right: {
      alignItems: "flex-end",
    },
    amount: {
      fontSize: 14,
      fontWeight: "800",
      color: theme.fg,
      ...theme.type.money,
    },
    dash: {
      fontSize: 11.5,
      color: theme.fgMuted,
      fontStyle: "italic",
    },
  });

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    chipRow: {
      paddingHorizontal: theme.space.s4,
      paddingTop: 4,
      paddingBottom: 12,
      gap: 8,
    },
    skeletonList: {
      paddingHorizontal: theme.space.s4,
    },
    listContent: {
      paddingHorizontal: theme.space.s4,
      paddingBottom: theme.space.s5 + 80, // breathing room above tab bar
    },
    endNote: {
      textAlign: "center",
      fontSize: 11.5,
      color: theme.fgMuted,
      paddingVertical: 12,
    },

    /* Empty */
    emptyWrap: {
      paddingHorizontal: 24,
      paddingVertical: 60,
      alignItems: "center",
    },
    emptyIconTile: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: theme.bgMuted,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: theme.fg,
      marginBottom: 6,
    },
    emptyBody: {
      fontSize: 13,
      color: theme.fgMuted,
      textAlign: "center",
      lineHeight: 19,
      maxWidth: 260,
    },
    emptyCta: {
      marginTop: 18,
      height: 44,
      paddingHorizontal: 22,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyCtaText: {
      fontSize: 13.5,
      fontWeight: "800",
      color: "#fff",
    },
  });
