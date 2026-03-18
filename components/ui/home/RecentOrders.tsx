import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";

type OrderStatus = "pending" | "confirmed" | "in_transit" | "delivered" | "cancelled";

interface Order {
  _id: string;
  status: OrderStatus;
  totalPrice: number;
  createdAt: string;
  fuel?: { name: string; unit: string };
  quantity?: number;
}

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: "#F59E0B", confirmed: "#3B82F6",
  in_transit: "#F97316", delivered: "#22C55E", cancelled: "#EF4444",
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending", confirmed: "Confirmed",
  in_transit: "In Transit", delivered: "Delivered", cancelled: "Cancelled",
};

export default function RecentOrders() {
  const theme = useTheme();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    api.get<{ data: Order[] }>("/api/orders?page=1&limit=3")
      .then((data) => setOrders(data.data?.slice(0, 3) ?? []))
      .catch(() => {});
  }, []);

  if (!orders.length) return null;

  const s = styles(theme);

  return (
    <View style={s.container}>
      <View style={s.sectionHeader}>
        <Text style={[s.sectionTitle, { color: theme.text }]}>Recent Orders</Text>
        <TouchableOpacity onPress={() => router.push("/(screens)/order-history" as any)}>
          <Text style={[s.seeAll, { color: theme.primary }]}>See all</Text>
        </TouchableOpacity>
      </View>

      {orders.map((order) => {
        const statusColor = STATUS_COLOR[order.status] ?? "#999";
        return (
          <TouchableOpacity
            key={order._id}
            style={[s.row, { backgroundColor: theme.surface, borderColor: theme.ash }]}
            onPress={() => router.push("/(screens)/order-history" as any)}
            activeOpacity={0.8}
          >
            <View style={[s.iconWrap, { backgroundColor: theme.tertiary }]}>
              <Ionicons name="flame-outline" size={18} color={theme.primary} />
            </View>
            <View style={s.info}>
              <Text style={[s.fuelName, { color: theme.text }]}>
                {order.fuel?.name} · {order.quantity} {order.fuel?.unit}
              </Text>
              <Text style={[s.date, { color: theme.icon }]}>
                {new Date(order.createdAt).toLocaleDateString("en-NG", {
                  day: "numeric", month: "short", year: "numeric",
                })}
              </Text>
            </View>
            <View style={s.right}>
              <Text style={[s.price, { color: theme.primary }]}>
                ₦{order.totalPrice?.toLocaleString()}
              </Text>
              <View style={[s.badge, { backgroundColor: statusColor + "20" }]}>
                <Text style={[s.badgeText, { color: statusColor }]}>
                  {STATUS_LABEL[order.status]}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: { marginBottom: 24 },
    sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    sectionTitle: { fontSize: 15, fontWeight: "500" },
    seeAll: { fontSize: 13, fontWeight: "400" },
    row: {
      flexDirection: "row", alignItems: "center", gap: 12,
      padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 10,
    },
    iconWrap: { width: 38, height: 38, borderRadius: 10, justifyContent: "center", alignItems: "center" },
    info: { flex: 1 },
    fuelName: { fontSize: 14, fontWeight: "400", marginBottom: 3 },
    date: { fontSize: 12, fontWeight: "300" },
    right: { alignItems: "flex-end", gap: 4 },
    price: { fontSize: 14, fontWeight: "500" },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    badgeText: { fontSize: 10, fontWeight: "500" },
  });
