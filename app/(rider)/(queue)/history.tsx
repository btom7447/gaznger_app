import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";

type DeliveryStatus = "pending" | "accepted" | "picked_up" | "delivered" | "failed";

interface DeliveryRecord {
  _id: string;
  status: DeliveryStatus;
  riderEarnings: number;
  pickupTime?: string;
  deliveryTime?: string;
  createdAt: string;
  station: { name: string; address: string; state: string };
  order: {
    totalPrice: number;
    deliveryFee: number;
    createdAt: string;
    fuel: { name: string; unit: string };
    quantity: number;
  };
}

interface DeliveriesResponse {
  deliveries: DeliveryRecord[];
  total: number;
  page: number;
  pages: number;
}

const STATUS_COLOR: Record<DeliveryStatus, string> = {
  pending: "#9E9E9E",
  accepted: "#2196F3",
  picked_up: "#FF9800",
  delivered: "#4CAF50",
  failed: "#F44336",
};

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  picked_up: "In Transit",
  delivered: "Delivered",
  failed: "Failed",
};

function fmtCurrency(n: number) {
  return "₦" + n.toLocaleString("en-NG");
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function RiderHistory() {
  const theme = useTheme();
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const load = useCallback(async (pageNum = 1, append = false) => {
    try {
      const res = await api.get<DeliveriesResponse>(
        `/api/rider/deliveries?page=${pageNum}&limit=20`
      );
      setDeliveries((prev) => (append ? [...prev, ...res.deliveries] : res.deliveries));
      setTotal(res.total);
      setPage(res.page);
      setPages(res.pages);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { load(1); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(1);
  }, [load]);

  const loadMore = useCallback(() => {
    if (loadingMore || page >= pages) return;
    setLoadingMore(true);
    load(page + 1, true);
  }, [loadingMore, page, pages, load]);

  const renderItem = ({ item }: { item: DeliveryRecord }) => {
    const color = STATUS_COLOR[item.status];
    const isCompleted = item.status === "delivered";

    return (
      <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
        <View style={s.cardTop}>
          <View style={s.cardLeft}>
            <View style={[s.iconWrap, { backgroundColor: theme.tertiary }]}>
              <Ionicons name="bicycle-outline" size={20} color={theme.primary} />
            </View>
            <View>
              <Text style={[s.stationName, { color: theme.text }]} numberOfLines={1}>
                {item.station?.name ?? "—"}
              </Text>
              <Text style={[s.stationAddr, { color: theme.icon }]} numberOfLines={1}>
                {item.station?.state}
              </Text>
            </View>
          </View>
          <View style={s.cardRight}>
            <View style={[s.statusBadge, { backgroundColor: color + "22" }]}>
              <Text style={[s.statusText, { color }]}>{STATUS_LABEL[item.status]}</Text>
            </View>
          </View>
        </View>

        <View style={[s.divider, { backgroundColor: theme.ash }]} />

        <View style={s.cardBottom}>
          <View style={s.detailRow}>
            <Ionicons name="water-outline" size={14} color={theme.icon} />
            <Text style={[s.detailText, { color: theme.icon }]}>
              {item.order?.quantity} {item.order?.fuel?.unit} · {item.order?.fuel?.name}
            </Text>
          </View>
          <View style={s.detailRow}>
            <Ionicons name="calendar-outline" size={14} color={theme.icon} />
            <Text style={[s.detailText, { color: theme.icon }]}>{fmtDate(item.createdAt)}</Text>
          </View>
          <View style={s.earningRow}>
            <Text style={[s.earningLabel, { color: theme.icon }]}>Your earnings</Text>
            <Text style={[s.earningAmount, { color: isCompleted ? theme.primary : theme.icon }]}>
              {isCompleted ? fmtCurrency(item.riderEarnings) : "—"}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
      <FlatList
        data={deliveries}
        keyExtractor={(d) => d._id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <View style={s.listHeader}>
            <Text style={[s.pageTitle, { color: theme.text }]}>Delivery History</Text>
            <Text style={[s.pageSubtitle, { color: theme.icon }]}>
              {total} trip{total !== 1 ? "s" : ""} total
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="time-outline" size={48} color={theme.ash} />
            <Text style={[s.emptyTitle, { color: theme.icon }]}>No deliveries yet</Text>
            <Text style={[s.emptySub, { color: theme.icon }]}>
              Your completed deliveries will appear here.
            </Text>
          </View>
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 16 }} />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  listHeader: { marginBottom: 8 },
  pageTitle: { fontSize: 22, fontWeight: "700" },
  pageSubtitle: { fontSize: 13, marginTop: 2 },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  cardRight: { alignItems: "flex-end" },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  stationName: { fontSize: 14, fontWeight: "600" },
  stationAddr: { fontSize: 12, marginTop: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: "700" },
  divider: { height: 1 },
  cardBottom: { gap: 6 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  detailText: { fontSize: 13 },
  earningRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 2 },
  earningLabel: { fontSize: 13 },
  earningAmount: { fontSize: 15, fontWeight: "700" },
  empty: { alignItems: "center", gap: 10, paddingTop: 60 },
  emptyTitle: { fontSize: 15, fontWeight: "600" },
  emptySub: { fontSize: 13, textAlign: "center", lineHeight: 20, paddingHorizontal: 20 },
});
