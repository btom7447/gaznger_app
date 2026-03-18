import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";

type OrderStatus = "pending" | "confirmed" | "in-transit" | "delivered" | "cancelled";

interface ActiveOrder {
  _id: string;
  status: OrderStatus;
  fuel?: { name: string; unit: string };
  quantity?: number;
}

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: "#F59E0B",
  confirmed: "#3B82F6",
  "in-transit": "#F97316",
  delivered: "#22C55E",
  cancelled: "#EF4444",
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  "in-transit": "On the Way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default function ActiveOrderBanner() {
  const theme = useTheme();
  const [order, setOrder] = useState<ActiveOrder | null>(null);

  useEffect(() => {
    api.get<{ data: ActiveOrder[] }>("/api/orders?page=1&limit=3")
      .then((data) => {
        const active = data.data?.find((o) =>
          ["pending", "confirmed", "in-transit"].includes(o.status)
        );
        setOrder(active ?? null);
      })
      .catch(() => {});
  }, []);

  if (!order) return null;

  const statusColor = STATUS_COLOR[order.status] ?? "#999";
  const s = styles(theme);

  return (
    <TouchableOpacity
      style={[s.banner, { backgroundColor: theme.surface, borderColor: theme.borderMid }]}
      onPress={() => router.push("/(customer)/(track)" as any)} // eslint-disable-line @typescript-eslint/no-explicit-any
      activeOpacity={0.85}
    >
      <View style={[s.iconWrap, { backgroundColor: statusColor + "20" }]}>
        <Ionicons
          name={order.status === "in-transit" ? "bicycle" : "receipt-outline"}
          size={20}
          color={statusColor}
        />
      </View>
      <View style={s.body}>
        <Text style={[s.label, { color: theme.text }]}>
          {order.fuel?.name} · {order.quantity} {order.fuel?.unit}
        </Text>
        <View style={s.statusRow}>
          <View style={[s.dot, { backgroundColor: statusColor }]} />
          <Text style={[s.status, { color: statusColor }]}>{STATUS_LABEL[order.status]}</Text>
        </View>
      </View>
      <View style={s.cta}>
        <Text style={[s.ctaText, { color: theme.primary }]}>Track</Text>
        <Ionicons name="chevron-forward" size={14} color={theme.primary} />
      </View>
    </TouchableOpacity>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    banner: {
      flexDirection: "row", alignItems: "center", gap: 12,
      padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 20,
    },
    iconWrap: { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center" },
    body: { flex: 1 },
    label: { fontSize: 14, fontWeight: "400", marginBottom: 4 },
    statusRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    status: { fontSize: 12, fontWeight: "400" },
    cta: { flexDirection: "row", alignItems: "center", gap: 2 },
    ctaText: { fontSize: 13, fontWeight: "400" },
  });
