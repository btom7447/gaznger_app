import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";

type OrderStatus = "pending" | "confirmed" | "assigned" | "in-transit" | "delivered" | "cancelled";

interface VendorOrder {
  _id: string;
  user: { displayName: string; phone?: string };
  fuel: { name: string; unit: string };
  quantity: number;
  fuelCost: number;
  deliveryFee: number;
  totalPrice: number;
  status: OrderStatus;
  createdAt: string;
}

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: "All", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "In Transit", value: "in-transit" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
];

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: "#F5C518",
  confirmed: "#2196F3",
  assigned: "#9C27B0",
  "in-transit": "#FF9800",
  delivered: "#4CAF50",
  cancelled: "#F44336",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function VendorOrders() {
  const theme = useTheme();
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [activeFilter, setActiveFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);

  const load = useCallback(async (filter: string) => {
    try {
      const qs = filter ? `?status=${filter}&limit=50` : "?limit=50";
      const res = await api.get<{ orders: VendorOrder[] }>(`/api/vendor/orders${qs}`);
      setOrders(res.orders);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(activeFilter); }, [activeFilter, load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(activeFilter);
  }, [activeFilter, load]);

  const confirm = useCallback(async (orderId: string) => {
    setActioning(orderId);
    try {
      await api.patch(`/api/vendor/orders/${orderId}/confirm`);
      setOrders((prev) =>
        prev.map((o) => (o._id === orderId ? { ...o, status: "confirmed" } : o))
      );
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Could not confirm order");
    } finally {
      setActioning(null);
    }
  }, []);

  const reject = useCallback((orderId: string) => {
    Alert.alert("Reject Order", "Are you sure you want to reject this order?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: async () => {
          setActioning(orderId);
          try {
            await api.patch(`/api/vendor/orders/${orderId}/reject`);
            setOrders((prev) =>
              prev.map((o) => (o._id === orderId ? { ...o, status: "cancelled" } : o))
            );
          } catch (err: any) {
            Alert.alert("Error", err.message ?? "Could not reject order");
          } finally {
            setActioning(null);
          }
        },
      },
    ]);
  }, []);

  const fmtCurrency = (n: number) => "₦" + n.toLocaleString("en-NG");

  const renderOrder = ({ item }: { item: VendorOrder }) => {
    const color = STATUS_COLOR[item.status];
    const isPending = item.status === "pending";
    const isActioning = actioning === item._id;

    return (
      <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
        <View style={s.cardTop}>
          <View style={s.cardLeft}>
            <Text style={[s.customerName, { color: theme.text }]}>
              {item.user?.displayName ?? "Customer"}
            </Text>
            <Text style={[s.fuelInfo, { color: theme.icon }]}>
              {item.quantity} {item.fuel?.unit} · {item.fuel?.name}
            </Text>
          </View>
          <View style={s.cardRight}>
            <View style={[s.statusBadge, { backgroundColor: color + "22" }]}>
              <Text style={[s.statusText, { color }]}>{item.status}</Text>
            </View>
            <Text style={[s.timeAgo, { color: theme.icon }]}>{timeAgo(item.createdAt)}</Text>
          </View>
        </View>

        <View style={[s.divider, { backgroundColor: theme.ash }]} />

        <View style={s.cardBottom}>
          <View style={s.priceRow}>
            <Text style={[s.priceLabel, { color: theme.icon }]}>Fuel</Text>
            <Text style={[s.priceValue, { color: theme.text }]}>{fmtCurrency(item.fuelCost)}</Text>
          </View>
          <View style={s.priceRow}>
            <Text style={[s.priceLabel, { color: theme.icon }]}>Delivery</Text>
            <Text style={[s.priceValue, { color: theme.text }]}>{fmtCurrency(item.deliveryFee)}</Text>
          </View>
          <View style={s.priceRow}>
            <Text style={[s.totalLabel, { color: theme.text }]}>Total</Text>
            <Text style={[s.totalValue, { color: theme.primary }]}>{fmtCurrency(item.totalPrice)}</Text>
          </View>
        </View>

        {isPending && (
          <View style={s.actions}>
            <TouchableOpacity
              style={[s.rejectBtn, { borderColor: theme.error }]}
              onPress={() => reject(item._id)}
              disabled={isActioning}
            >
              {isActioning ? (
                <ActivityIndicator size="small" color={theme.error} />
              ) : (
                <Text style={[s.rejectText, { color: theme.error }]}>Reject</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.confirmBtn, { backgroundColor: theme.primary }]}
              onPress={() => confirm(item._id)}
              disabled={isActioning}
            >
              {isActioning ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.confirmText}>Confirm</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
      {/* Filter chips */}
      <View style={s.filterWrap}>
        <FlatList
          data={STATUS_FILTERS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(f) => f.value}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          renderItem={({ item }) => {
            const active = activeFilter === item.value;
            return (
              <TouchableOpacity
                style={[
                  s.chip,
                  {
                    backgroundColor: active ? theme.primary : theme.surface,
                    borderColor: active ? theme.primary : theme.ash,
                  },
                ]}
                onPress={() => { setLoading(true); setActiveFilter(item.value); }}
              >
                <Text style={[s.chipText, { color: active ? "#fff" : theme.text }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : orders.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="receipt-outline" size={48} color={theme.ash} />
          <Text style={[s.emptyText, { color: theme.icon }]}>No orders found</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o._id}
          renderItem={renderOrder}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  filterWrap: { paddingVertical: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: "500" },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  cardTop: { flexDirection: "row", justifyContent: "space-between" },
  cardLeft: { flex: 1 },
  cardRight: { alignItems: "flex-end", gap: 4 },
  customerName: { fontSize: 15, fontWeight: "700" },
  fuelInfo: { fontSize: 13, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  timeAgo: { fontSize: 11 },
  divider: { height: 1 },
  cardBottom: { gap: 4 },
  priceRow: { flexDirection: "row", justifyContent: "space-between" },
  priceLabel: { fontSize: 13 },
  priceValue: { fontSize: 13 },
  totalLabel: { fontSize: 14, fontWeight: "700" },
  totalValue: { fontSize: 15, fontWeight: "700" },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
  rejectBtn: { flex: 1, height: 40, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  rejectText: { fontSize: 14, fontWeight: "600" },
  confirmBtn: { flex: 2, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  confirmText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  emptyText: { fontSize: 14, marginTop: 8 },
});
