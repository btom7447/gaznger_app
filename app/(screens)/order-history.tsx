import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from "react-native";
import { toast } from "sonner-native";
import { useRouter } from "expo-router";
import { Theme, useTheme, formatCurrency } from "@/constants/theme";
import { api } from "@/lib/api";
import {
  EmptyState,
  ScreenContainer,
  ScreenHeader,
  Skeleton,
  StatusBadge,
  StatusKind,
} from "@/components/ui/primitives";
import {
  OrderStatus,
  getStatusLabel,
} from "@/utils/orderStatusLabels";

interface ServerOrder {
  _id: string;
  status: OrderStatus;
  paymentStatus: "unpaid" | "paid" | "refunded";
  totalPrice: number;
  totalCharged?: number;
  createdAt: string;
  fuel?: { name: string; unit: string };
  station?: { name?: string; address?: string };
  quantity?: number;
}

type FilterKey = "all" | "active" | "delivered" | "cancelled";

const FILTERS: { key: FilterKey; label: string; statusFilter?: string }[] = [
  { key: "all", label: "All" },
  {
    key: "active",
    label: "Active",
    statusFilter: "pending,confirmed,assigned,in-transit,awaiting_confirmation",
  },
  { key: "delivered", label: "Delivered", statusFilter: "delivered" },
  {
    key: "cancelled",
    label: "Cancelled",
    statusFilter:
      "cancelled,cancelled_by_customer,cancelled_by_vendor,cancelled_by_rider,failed_payment",
  },
];

const PAGE_SIZE = 15;

function relativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString("en-NG", {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export default function OrderHistoryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = makeStyles(theme);

  const [orders, setOrders] = useState<ServerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

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
          totalPages: number;
          page: number;
        }>(`/api/orders?${params.toString()}`);
        setOrders((prev) =>
          append ? [...prev, ...(res.data ?? [])] : res.data ?? []
        );
        setTotalPages(res.totalPages ?? 1);
        setPage(res.page ?? pageNum);
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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(filter, 1, false);
  }, [filter, load]);

  const onEndReached = useCallback(() => {
    if (loadingMore || page >= totalPages) return;
    load(filter, page + 1, true);
  }, [filter, loadingMore, page, totalPages, load]);

  return (
    <ScreenContainer
      edges={["top", "bottom"]}
      contentStyle={styles.scroll}
      header={<ScreenHeader title="Your orders" onBack={() => router.back()} />}
    >
      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const isSel = f.key === filter;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSel }}
              style={({ pressed }) => [
                styles.chip,
                isSel && styles.chipSelected,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: isSel ? theme.bg : theme.fg },
                ]}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.list}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton
              key={i}
              width="100%"
              height={92}
              borderRadius={theme.radius.lg}
            />
          ))}
        </View>
      ) : orders.length === 0 ? (
        <EmptyState
          icon="receipt-outline"
          title="Nothing here yet"
          body="Your past orders will show up here once you've ordered fuel."
          action={{
            label: "Place an order",
            onPress: () => router.push("/(customer)/(home)" as never),
          }}
          tileBg={theme.bgMuted}
          tileFg={theme.fgMuted}
        />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o._id}
          renderItem={({ item }) => (
            <OrderRow
              order={item}
              styles={styles}
              onPress={() =>
                router.push({
                  pathname: "/(screens)/order-detail" as never,
                  params: { orderId: item._id } as never,
                })
              }
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: theme.space.s2 }} />}
          contentContainerStyle={{ paddingBottom: theme.space.s5 }}
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
            ) : null
          }
        />
      )}
    </ScreenContainer>
  );
}

function OrderRow({
  order,
  styles,
  onPress,
}: {
  order: ServerOrder;
  styles: ReturnType<typeof makeStyles>;
  onPress: () => void;
}) {
  const status = getStatusLabel({ status: order.status });
  const total =
    typeof order.totalCharged === "number" ? order.totalCharged : order.totalPrice;
  const fuelLine =
    order.quantity != null && order.fuel
      ? `${order.quantity} ${order.fuel.unit ?? "L"} ${order.fuel.name}`
      : "Order";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Order ${fuelLine}, ${status.label}`}
      style={({ pressed }) => [
        styles.card,
        pressed && { opacity: 0.92 },
      ]}
    >
      <View style={styles.cardHead}>
        <Text style={styles.fuelLine} numberOfLines={1}>
          {fuelLine}
        </Text>
        <StatusBadge kind={status.kind as StatusKind} compact>
          {status.label}
        </StatusBadge>
      </View>
      <Text style={styles.stationLine} numberOfLines={1}>
        {order.station?.name ?? "—"}
      </Text>
      <View style={styles.cardFoot}>
        <Text style={styles.dateText}>{relativeDate(order.createdAt)}</Text>
        <Text style={styles.amount}>{formatCurrency(total)}</Text>
      </View>
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    scroll: {
      paddingHorizontal: theme.space.s4,
      paddingTop: theme.space.s2,
      gap: theme.space.s3,
    },
    filterRow: {
      flexDirection: "row",
      gap: theme.space.s2,
      flexWrap: "wrap",
    },
    chip: {
      paddingHorizontal: theme.space.s3 + 2,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: theme.radius.pill,
    },
    chipSelected: {
      backgroundColor: theme.fg,
      borderColor: theme.fg,
    },
    chipText: {
      ...theme.type.caption,
      fontWeight: "700",
    },
    list: {
      gap: theme.space.s2,
    },
    card: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: theme.radius.lg,
      paddingHorizontal: theme.space.s3 + 2,
      paddingVertical: theme.space.s3,
      gap: 4,
    },
    cardHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.space.s2,
    },
    fuelLine: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "800",
      flex: 1,
    },
    stationLine: {
      ...theme.type.caption,
      color: theme.fgMuted,
    },
    cardFoot: {
      marginTop: 4,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    dateText: {
      ...theme.type.caption,
      color: theme.fgMuted,
    },
    amount: {
      ...theme.type.body,
      ...theme.type.money,
      color: theme.fg,
      fontWeight: "800",
    },
  });
