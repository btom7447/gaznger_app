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

type EarningStatus = "pending" | "settled";

interface Earning {
  _id: string;
  amount: number;
  type: "fuel_sale" | "delivery_fee";
  status: EarningStatus;
  createdAt: string;
  order?: { totalPrice: number; deliveryFee: number; createdAt: string };
}

interface EarningsResponse {
  earnings: Earning[];
  total: number;
  page: number;
  pages: number;
  summary: { pending: number; settled: number };
}

function fmtCurrency(n: number) {
  return "₦" + n.toLocaleString("en-NG", { minimumFractionDigits: 0 });
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function RiderEarnings() {
  const theme = useTheme();
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [summary, setSummary] = useState({ pending: 0, settled: 0 });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const load = useCallback(async (pageNum = 1, append = false) => {
    try {
      const res = await api.get<EarningsResponse>(
        `/api/rider/earnings?page=${pageNum}&limit=20`
      );
      setEarnings((prev) => (append ? [...prev, ...res.earnings] : res.earnings));
      setSummary(res.summary);
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

  const renderEarning = ({ item }: { item: Earning }) => {
    const isPending = item.status === "pending";
    return (
      <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
        <View style={s.cardLeft}>
          <View style={[s.iconWrap, { backgroundColor: theme.tertiary }]}>
            <Ionicons name="bicycle-outline" size={20} color={theme.primary} />
          </View>
          <View>
            <Text style={[s.typeText, { color: theme.text }]}>Delivery Fee</Text>
            <Text style={[s.dateText, { color: theme.icon }]}>{fmtDate(item.createdAt)}</Text>
          </View>
        </View>
        <View style={s.cardRight}>
          <Text style={[s.amount, { color: theme.primary }]}>{fmtCurrency(item.amount)}</Text>
          <View style={[s.statusBadge, { backgroundColor: isPending ? "#F5C51822" : "#4CAF5022" }]}>
            <Text style={[s.statusText, { color: isPending ? "#F5C518" : "#4CAF50" }]}>
              {item.status}
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

  const totalAll = summary.pending + summary.settled;

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
      <FlatList
        data={earnings}
        keyExtractor={(e) => e._id}
        renderItem={renderEarning}
        contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <View style={s.header}>
            <Text style={[s.pageTitle, { color: theme.text }]}>Earnings</Text>
            <Text style={[s.pageSubtitle, { color: theme.icon }]}>
              {total} earning{total !== 1 ? "s" : ""} recorded
            </Text>

            <View style={s.summaryRow}>
              <View style={[s.summaryCard, { backgroundColor: theme.accentLight, borderColor: theme.accent + "44" }]}>
                <Text style={[s.summaryLabel, { color: theme.icon }]}>Total</Text>
                <Text style={[s.summaryAmount, { color: theme.text }]}>{fmtCurrency(totalAll)}</Text>
              </View>
              <View style={[s.summaryCard, { backgroundColor: "#F5C51811", borderColor: "#F5C51844" }]}>
                <Text style={[s.summaryLabel, { color: theme.icon }]}>Pending</Text>
                <Text style={[s.summaryAmount, { color: "#F5C518" }]}>
                  {fmtCurrency(summary.pending)}
                </Text>
              </View>
              <View style={[s.summaryCard, { backgroundColor: "#4CAF5011", borderColor: "#4CAF5044" }]}>
                <Text style={[s.summaryLabel, { color: theme.icon }]}>Settled</Text>
                <Text style={[s.summaryAmount, { color: "#4CAF50" }]}>
                  {fmtCurrency(summary.settled)}
                </Text>
              </View>
            </View>

            {earnings.length > 0 && (
              <Text style={[s.listHeading, { color: theme.text }]}>History</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="wallet-outline" size={48} color={theme.ash} />
            <Text style={[s.emptyTitle, { color: theme.icon }]}>No earnings yet</Text>
            <Text style={[s.emptySub, { color: theme.icon }]}>
              Complete your first delivery to start earning.
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
  header: { gap: 8, marginBottom: 8 },
  pageTitle: { fontSize: 22, fontWeight: "700" },
  pageSubtitle: { fontSize: 13, marginTop: 2 },
  summaryRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  summaryCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, gap: 4 },
  summaryLabel: { fontSize: 11 },
  summaryAmount: { fontSize: 15, fontWeight: "700" },
  listHeading: { fontSize: 15, fontWeight: "700", marginTop: 8 },
  card: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: 14, borderWidth: 1, padding: 14 },
  cardLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  typeText: { fontSize: 14, fontWeight: "600" },
  dateText: { fontSize: 12, marginTop: 2 },
  cardRight: { alignItems: "flex-end", gap: 4 },
  amount: { fontSize: 15, fontWeight: "700" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  empty: { alignItems: "center", gap: 10, paddingTop: 60 },
  emptyTitle: { fontSize: 15, fontWeight: "600" },
  emptySub: { fontSize: 13, textAlign: "center", lineHeight: 20, paddingHorizontal: 20 },
});
