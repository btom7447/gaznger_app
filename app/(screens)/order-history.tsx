import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator, // kept for cancel-in-progress button
  RefreshControl,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { toast } from "sonner-native";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";
import BackButton from "@/components/ui/global/BackButton";
import SkeletonBox from "@/components/ui/skeletons/SkeletonBox";

/* Skeleton card that matches the real order card layout */
function OrderCardSkeleton() {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
      {/* Top row: order ID + date | badge */}
      <View style={[s.cardTop, { marginBottom: 14 }]}>
        <View style={{ gap: 6 }}>
          <SkeletonBox width={80} height={12} borderRadius={6} />
          <SkeletonBox width={60} height={10} borderRadius={5} />
        </View>
        <SkeletonBox width={72} height={26} borderRadius={13} />
      </View>
      {/* Mid row: fuel name | price */}
      <View style={s.cardMid}>
        <SkeletonBox width={110} height={13} borderRadius={6} />
        <SkeletonBox width={64} height={14} borderRadius={6} />
      </View>
    </View>
  );
}

type OrderStatus = "pending" | "confirmed" | "in_transit" | "delivered" | "cancelled";

interface Order {
  _id: string;
  status: OrderStatus;
  paymentStatus: "unpaid" | "paid" | "refunded";
  totalPrice: number;
  createdAt: string;
  fuel?: { name: string; unit: string };
  quantity?: number;
  deliveryAddress?: { label: string };
  station?: { name: string };
}

interface PagedResponse {
  data: Order[];
  total: number;
  page: number;
  totalPages: number;
}

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: "#F59E0B",
  confirmed: "#3B82F6",
  in_transit: "#F97316",
  delivered: "#22C55E",
  cancelled: "#EF4444",
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  in_transit: "In Transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default function OrderHistoryScreen() {
  const theme = useTheme();
  const [orders, setOrders] = useState<Order[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchOrders = useCallback(async (pageNum: number, replace: boolean) => {
    if (loading && !replace) return;
    setLoading(true);
    try {
      const data = await api.get<PagedResponse>(`/api/orders?page=${pageNum}&limit=15`);
      setOrders((prev) => (replace ? data.data : [...prev, ...data.data]));
      setPage(pageNum);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      toast.error("Failed to load orders", { description: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(1, true); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders(1, true);
    setRefreshing(false);
  };

  const cancelOrder = async (id: string) => {
    setCancelling(id);
    try {
      await api.patch(`/api/orders/${id}/cancel`);
      setOrders((prev) => prev.map((o) => (o._id === id ? { ...o, status: "cancelled" } : o)));
      toast.success("Order cancelled");
    } catch (err: any) {
      toast.error("Could not cancel", { description: err.message });
    } finally {
      setCancelling(null);
    }
  };

  const s = styles(theme);

  const renderItem = ({ item }: { item: Order }) => {
    const isExpanded = expanded === item._id;
    const statusColor = STATUS_COLOR[item.status] ?? "#999";

    return (
      <TouchableOpacity
        style={[s.card, { backgroundColor: theme.surface, borderColor: theme.ash }]}
        onPress={() => setExpanded(isExpanded ? null : item._id)}
        activeOpacity={0.8}
      >
        <View style={s.cardTop}>
          <View>
            <Text style={[s.orderId, { color: theme.text }]}>
              #{item._id.slice(-6).toUpperCase()}
            </Text>
            <Text style={[s.orderDate, { color: theme.icon }]}>
              {new Date(item.createdAt).toLocaleDateString("en-NG", {
                day: "numeric", month: "short", year: "numeric",
              })}
            </Text>
          </View>
          <View style={[s.badge, { backgroundColor: statusColor + "20" }]}>
            <View style={[s.badgeDot, { backgroundColor: statusColor }]} />
            <Text style={[s.badgeText, { color: statusColor }]}>
              {STATUS_LABEL[item.status]}
            </Text>
          </View>
        </View>

        <View style={s.cardMid}>
          <Text style={[s.fuelName, { color: theme.text }]}>
            {item.fuel?.name ?? "Fuel"}{" "}
            <Text style={{ color: theme.icon, fontWeight: "300" }}>
              × {item.quantity} {item.fuel?.unit}
            </Text>
          </Text>
          <Text style={[s.price, { color: theme.primary }]}>
            ₦{item.totalPrice?.toLocaleString()}
          </Text>
        </View>

        {isExpanded && (
          <View style={[s.details, { borderTopColor: theme.ash }]}>
            {item.station && (
              <View style={s.detailRow}>
                <Ionicons name="business-outline" size={14} color={theme.icon} />
                <Text style={[s.detailText, { color: theme.icon }]}>{item.station.name}</Text>
              </View>
            )}
            {item.deliveryAddress && (
              <View style={s.detailRow}>
                <Ionicons name="location-outline" size={14} color={theme.icon} />
                <Text style={[s.detailText, { color: theme.icon }]}>{item.deliveryAddress.label}</Text>
              </View>
            )}
            <View style={s.detailRow}>
              <Ionicons name="card-outline" size={14} color={theme.icon} />
              <Text style={[s.detailText, { color: theme.icon }]}>
                Payment:{" "}
                <Text style={{ color: item.paymentStatus === "paid" ? theme.success : theme.warning, fontWeight: "500" }}>
                  {item.paymentStatus.charAt(0).toUpperCase() + item.paymentStatus.slice(1)}
                </Text>
              </Text>
            </View>
            {item.status === "pending" && (
              <TouchableOpacity
                style={[s.cancelBtn, { borderColor: theme.error }]}
                onPress={() => cancelOrder(item._id)}
                disabled={cancelling === item._id}
              >
                {cancelling === item._id
                  ? <ActivityIndicator size="small" color={theme.error} />
                  : <Text style={[s.cancelText, { color: theme.error }]}>Cancel Order</Text>
                }
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* <Ionicons
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={16} color={theme.icon}
          style={s.chevron}
        /> */}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle={theme.mode === "dark" ? "light-content" : "dark-content"} />
      <View style={s.header}>
        <BackButton />
        <Text style={s.headerTitle}>Order History</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={s.list}
        onEndReached={() => { if (page < totalPages && !loading) fetchOrders(page + 1, false); }}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary]} />
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ paddingTop: 4 }}>
              {Array.from({ length: 5 }).map((_, i) => <OrderCardSkeleton key={i} />)}
            </View>
          ) : (
            <View style={s.empty}>
              <View style={[s.emptyIconWrap, { backgroundColor: theme.tertiary }]}>
                <Ionicons name="receipt-outline" size={36} color={theme.icon} />
              </View>
              <Text style={[s.emptyTitle, { color: theme.text }]}>No orders yet</Text>
              <Text style={[s.emptySub, { color: theme.icon }]}>Place your first fuel order</Text>
            </View>
          )
        }
        ListFooterComponent={loading && orders.length > 0 ? <OrderCardSkeleton /> : null}
      />
    </SafeAreaView>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
    headerTitle: { fontSize: 17, fontWeight: "500", color: theme.text },
    list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 28 },
    card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 12, position: "relative" },
    cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
    orderId: { fontSize: 13, fontWeight: "500", letterSpacing: 0.5 },
    orderDate: { fontSize: 12, fontWeight: "300", marginTop: 2 },
    badge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    badgeDot: { width: 6, height: 6, borderRadius: 3 },
    badgeText: { fontSize: 11, fontWeight: "500" },
    cardMid: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 4 },
    fuelName: { fontSize: 15, fontWeight: "400" },
    price: { fontSize: 16, fontWeight: "500" },
    details: { marginTop: 14, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, gap: 10 },
    detailRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    detailText: { fontSize: 13, fontWeight: "300", flex: 1 },
    cancelBtn: { marginTop: 8, borderWidth: 1.5, borderRadius: 12, paddingVertical: 11, alignItems: "center" },
    cancelText: { fontWeight: "500", fontSize: 14 },
    chevron: { position: "absolute", bottom: 14, right: 16 },
    empty: { alignItems: "center", marginTop: 80, gap: 12 },
    emptyIconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
    emptyTitle: { fontSize: 17, fontWeight: "500" },
    emptySub: { fontSize: 13, fontWeight: "300" },
  });
