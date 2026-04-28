import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";
import NotificationButton from "@/components/ui/global/NotificationButton";

type OrderStatus =
  | "pending"
  | "confirmed"
  | "dispatched"
  | "delivered"
  | "cancelled"
  | "failed";

interface Order {
  _id: string;
  status: OrderStatus;
  quantity: number;
  totalPrice: number;
  createdAt: string;
  fuel?: { name: string; unit: string };
  station?: { name: string };
  deliveryAddress?: { street: string; city: string };
}

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  pending: { label: "Pending", color: "#F59E0B", bg: "#FEF3C7", icon: "time-outline" },
  confirmed: { label: "Confirmed", color: "#3B82F6", bg: "#DBEAFE", icon: "checkmark-circle-outline" },
  dispatched: { label: "On the way", color: "#8B5CF6", bg: "#EDE9FE", icon: "bicycle-outline" },
  delivered: { label: "Delivered", color: "#10B981", bg: "#D1FAE5", icon: "checkmark-done-outline" },
  cancelled: { label: "Cancelled", color: "#EF4444", bg: "#FEE2E2", icon: "close-circle-outline" },
  failed: { label: "Failed", color: "#6B7280", bg: "#F3F4F6", icon: "alert-circle-outline" },
};

const FILTERS: { label: string; value: string }[] = [
  { label: "All", value: "" },
  { label: "Active", value: "pending,confirmed,dispatched" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled,failed" },
];

function fmtCurrency(n: number) {
  return "₦" + n.toLocaleString("en-NG");
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function OrderCard({ order, onPress }: { order: Order; onPress: () => void }) {
  const theme = useTheme();
  const status = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
  const s = cardStyles(theme);

  return (
    <TouchableOpacity
      style={[s.card, { backgroundColor: theme.surface, borderColor: theme.ash }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={s.cardTop}>
        <View style={[s.statusBadge, { backgroundColor: status.bg }]}>
          <Ionicons name={status.icon} size={12} color={status.color} />
          <Text style={[s.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
        <Text style={[s.date, { color: theme.icon }]}>{fmtDate(order.createdAt)}</Text>
      </View>

      <View style={s.cardMid}>
        <View style={[s.fuelIcon, { backgroundColor: theme.tertiary }]}>
          <Ionicons name="water-outline" size={18} color={theme.primary} />
        </View>
        <View style={s.cardInfo}>
          <Text style={[s.fuelName, { color: theme.text }]} numberOfLines={1}>
            {order.quantity} {order.fuel?.unit ?? "L"} · {order.fuel?.name ?? "Fuel"}
          </Text>
          {order.station && (
            <Text style={[s.stationName, { color: theme.icon }]} numberOfLines={1}>
              {order.station.name}
            </Text>
          )}
        </View>
        <Text style={[s.price, { color: theme.text }]}>{fmtCurrency(order.totalPrice)}</Text>
      </View>

      {order.deliveryAddress && (
        <View style={[s.addressRow, { borderTopColor: theme.ash }]}>
          <Ionicons name="location-outline" size={12} color={theme.icon} />
          <Text style={[s.addressText, { color: theme.icon }]} numberOfLines={1}>
            {order.deliveryAddress.street}, {order.deliveryAddress.city}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const cardStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    card: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10 },
    cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
    statusText: { fontSize: 11, fontWeight: "700" },
    date: { fontSize: 12 },
    cardMid: { flexDirection: "row", alignItems: "center", gap: 12 },
    fuelIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    cardInfo: { flex: 1 },
    fuelName: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
    stationName: { fontSize: 12 },
    price: { fontSize: 15, fontWeight: "700" },
    addressRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 10, paddingTop: 10, borderTopWidth: 1 },
    addressText: { flex: 1, fontSize: 12 },
  });

export default function OrderHistoryScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (filterVal = activeFilter, pageNum = 1, append = false) => {
    if (pageNum === 1) append ? null : setLoading(true);
    else setLoadingMore(true);

    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: "15" });
      if (filterVal) params.set("status", filterVal);
      const res = await api.get<{ data: Order[]; totalPages: number; page: number }>(
        `/api/orders?${params.toString()}`
      );
      setOrders((prev) => (append ? [...prev, ...res.data] : res.data));
      setTotalPages(res.totalPages);
      setPage(res.page);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [activeFilter]);

  useFocusEffect(useCallback(() => { load(activeFilter, 1, false); }, [activeFilter]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(activeFilter, 1, false);
  }, [activeFilter, load]);

  const onFilterPress = (val: string) => {
    setActiveFilter(val);
    setPage(1);
    load(val, 1, false);
  };

  const loadMore = () => {
    if (page < totalPages && !loadingMore) {
      load(activeFilter, page + 1, true);
    }
  };

  const s = styles(theme);

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={[s.greeting, { color: theme.icon }]}>Your</Text>
          <Text style={[s.title, { color: theme.text }]}>Order History</Text>
        </View>
        <NotificationButton onPress={() => router.push("/(screens)/notification" as any)} />
      </View>

      {/* Filter chips */}
      <View style={s.filterWrap}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[
              s.filterChip,
              {
                backgroundColor: activeFilter === f.value ? theme.primary : theme.surface,
                borderColor: activeFilter === f.value ? theme.primary : theme.ash,
              },
            ]}
            onPress={() => onFilterPress(f.value)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                s.filterText,
                { color: activeFilter === f.value ? "#fff" : theme.icon },
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item._id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              onPress={() => router.push(`/(screens)/order-detail?orderId=${item._id}` as any)}
            />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={[s.emptyIcon, { backgroundColor: theme.tertiary }]}>
                <Ionicons name="receipt-outline" size={32} color={theme.icon} />
              </View>
              <Text style={[s.emptyTitle, { color: theme.text }]}>No orders yet</Text>
              <Text style={[s.emptySub, { color: theme.icon }]}>
                Your completed and past orders will appear here.
              </Text>
            </View>
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 12 }} />
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
      paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
    },
    greeting: { fontSize: 13 },
    title: { fontSize: 22, fontWeight: "700", marginTop: 2 },

    filterWrap: {
      flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingBottom: 12, flexWrap: "wrap",
    },
    filterChip: {
      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1,
    },
    filterText: { fontSize: 13, fontWeight: "600" },

    list: { paddingHorizontal: 20, paddingBottom: 120 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },

    empty: { alignItems: "center", paddingTop: 60, gap: 12 },
    emptyIcon: { width: 72, height: 72, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    emptyTitle: { fontSize: 17, fontWeight: "700" },
    emptySub: { fontSize: 13, lineHeight: 20, textAlign: "center", paddingHorizontal: 32 },
  });
