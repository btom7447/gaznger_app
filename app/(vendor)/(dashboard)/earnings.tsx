import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { toast } from "sonner-native";
import { getSocket } from "@/lib/socket";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";
import NotificationButton from "@/components/ui/global/NotificationButton";
import ProfileButton from "@/components/ui/global/ProfileButton";

type EarningStatus = "pending" | "settled";

interface Earning {
  _id: string;
  amount: number;
  type: "fuel_sale" | "delivery_fee";
  status: EarningStatus;
  createdAt: string;
  order?: {
    totalPrice: number;
    fuelCost: number;
    deliveryFee: number;
    createdAt: string;
  };
}

interface EarningsResponse {
  earnings: Earning[];
  total: number;
  page: number;
  pages: number;
  summary: { pending: number; settled: number };
}

type Period = "week" | "month" | "all";

const PERIODS: { label: string; value: Period }[] = [
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
  { label: "All Time", value: "all" },
];

function fmtCurrency(n: number) {
  return "₦" + n.toLocaleString("en-NG", { minimumFractionDigits: 0 });
}

function useCountUp(target: number, duration = 1100) {
  const animated = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (target <= 0) { setDisplay(0); return; }
    animated.setValue(0);
    const listener = animated.addListener(({ value }) => setDisplay(Math.round(value)));
    Animated.timing(animated, { toValue: target, duration, useNativeDriver: false }).start();
    return () => animated.removeListener(listener);
  }, [target]);
  return display;
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function startOfPeriod(period: Period): Date | null {
  const now = new Date();
  if (period === "week") {
    const d = new Date(now);
    d.setDate(now.getDate() - now.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return null;
}

// Days Mon–Sun labels
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function VendorEarnings() {
  const theme = useTheme();
  const router = useRouter();
  const [allEarnings, setAllEarnings] = useState<Earning[]>([]);
  const [summary, setSummary] = useState({ pending: 0, settled: 0 });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [period, setPeriod] = useState<Period>("week");
  const [showPayout, setShowPayout] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [submittingPayout, setSubmittingPayout] = useState(false);

  const load = useCallback(async (pageNum = 1, append = false) => {
    try {
      const res = await api.get<EarningsResponse>(
        `/api/vendor/earnings?page=${pageNum}&limit=50`
      );
      setAllEarnings((prev) => (append ? [...prev, ...res.earnings] : res.earnings));
      setSummary(res.summary ?? { pending: 0, settled: 0 });
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
  useFocusEffect(useCallback(() => { load(1); }, [load]));

  // Real-time: reload when vendor gets new earnings
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = () => load(1);
    socket.on("earnings:new", handler);
    return () => { socket.off("earnings:new", handler); };
  }, [load]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(1); }, [load]);

  const handlePayoutSubmit = async () => {
    const amount = parseInt(payoutAmount, 10);
    if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return; }
    setSubmittingPayout(true);
    try {
      await api.post("/api/vendor/withdraw", { amount });
      toast.success("Payout request submitted!", { description: "We'll process it within 1–2 business days." });
      setShowPayout(false);
      setPayoutAmount("");
    } catch (err: any) {
      toast.error("Request failed", { description: err.message });
    } finally {
      setSubmittingPayout(false);
    }
  };

  const loadMore = useCallback(() => {
    if (loadingMore || page >= pages) return;
    setLoadingMore(true);
    load(page + 1, true);
  }, [loadingMore, page, pages, load]);

  // Filter earnings by selected period
  const earnings = useMemo(() => {
    const start = startOfPeriod(period);
    if (!start) return allEarnings;
    return allEarnings.filter((e) => new Date(e.createdAt) >= start);
  }, [allEarnings, period]);

  // Weekly bar chart data (Mon = 0 … Sun = 6)
  const weeklyTotals = useMemo(() => {
    const buckets = Array(7).fill(0);
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Sunday
    weekStart.setHours(0, 0, 0, 0);

    allEarnings.forEach((e) => {
      const d = new Date(e.createdAt);
      if (d >= weekStart) {
        // getDay(): 0=Sun, 1=Mon … 6=Sat; we display Mon-Sun so shift
        const idx = (d.getDay() + 6) % 7; // Mon=0, Sun=6
        buckets[idx] += e.amount;
      }
    });
    return buckets;
  }, [allEarnings]);

  const maxBar = Math.max(...weeklyTotals, 1);

  const periodTotal = useMemo(
    () => earnings.reduce((sum, e) => sum + e.amount, 0),
    [earnings]
  );

  const totalAll = summary.settled;
  const countTotal = useCountUp(totalAll);
  const countPending = useCountUp(summary.pending);
  const countSettled = useCountUp(summary.settled);

  const renderEarning = ({ item }: { item: Earning }) => {
    const isPending = item.status === "pending";
    const isFuelSale = item.type === "fuel_sale";

    // Compute platform commission estimate (10%)
    const orderTotal = item.order?.fuelCost ?? 0;
    const platformComm = orderTotal > 0 ? Math.round(orderTotal * 0.1) : null;

    return (
      <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
        <View style={s.cardHeader}>
          <View style={[s.iconWrap, { backgroundColor: isFuelSale ? theme.primary + "18" : theme.tertiary }]}>
            <Ionicons
              name={isFuelSale ? "water" : "bicycle-outline"}
              size={18}
              color={isFuelSale ? theme.primary : theme.icon}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.typeText, { color: theme.text }]}>
              {isFuelSale ? "Fuel Sale" : "Delivery Fee"}
            </Text>
            <Text style={[s.dateText, { color: theme.icon }]}>{fmtDate(item.createdAt)}</Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 4 }}>
            <Text style={[s.amount, { color: theme.primary }]}>{fmtCurrency(item.amount)}</Text>
            <View style={[s.statusBadge, { backgroundColor: isPending ? "#F5C51822" : "#4CAF5022" }]}>
              <Text style={[s.statusText, { color: isPending ? "#F5C518" : "#4CAF50" }]}>
                {isPending ? "Pending" : "Settled"}
              </Text>
            </View>
          </View>
        </View>

        {/* Breakdown */}
        {item.order && (
          <View style={[s.breakdown, { borderTopColor: theme.ash }]}>
            {isFuelSale && item.order.fuelCost > 0 && (
              <>
                <View style={s.bRow}>
                  <Text style={[s.bLabel, { color: theme.icon }]}>Order value</Text>
                  <Text style={[s.bVal, { color: theme.text }]}>{fmtCurrency(item.order.fuelCost)}</Text>
                </View>
                {platformComm !== null && (
                  <View style={s.bRow}>
                    <Text style={[s.bLabel, { color: theme.icon }]}>Platform fee (10%)</Text>
                    <Text style={[s.bVal, { color: "#EF4444" }]}>−{fmtCurrency(platformComm)}</Text>
                  </View>
                )}
              </>
            )}
            <View style={s.bRow}>
              <Text style={[s.bLabel, { color: theme.icon }]}>Your earnings</Text>
              <Text style={[s.bVal, { color: theme.primary, fontWeight: "700" }]}>{fmtCurrency(item.amount)}</Text>
            </View>
          </View>
        )}
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
        data={earnings}
        keyExtractor={(e) => e._id}
        renderItem={renderEarning}
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          <View style={{ gap: 16, marginBottom: 8 }}>
            {/* Header row */}
            <View style={s.pageHeader}>
              <Text style={[s.pageTitle, { color: theme.text }]}>Earnings</Text>
              <View style={s.headerRight}>
                <NotificationButton onPress={() => router.push("/(screens)/notification" as any)} />
                <ProfileButton
                  onPress={() => router.push("/(vendor)/(dashboard)/profile" as any)}
                  size={36}
                />
              </View>
            </View>

            {/* All-time summary */}
            <View style={[s.totalCard, { backgroundColor: theme.primary }]}>
              <Ionicons name="wallet-outline" size={18} color="rgba(255,255,255,0.8)" />
              <Text style={s.totalLabel}>Total Earnings</Text>
              <Text style={s.totalAmount}>{fmtCurrency(countTotal)}</Text>
            </View>
            <View style={s.summaryRow}>
              <View style={[s.summaryCard, { backgroundColor: "#F5C51811", borderColor: "#F5C51844" }]}>
                <Ionicons name="time-outline" size={16} color="#F5C518" />
                <Text style={[s.summaryLabel, { color: theme.icon }]}>Pending</Text>
                <Text style={[s.summaryAmount, { color: "#F5C518" }]}>{fmtCurrency(countPending)}</Text>
              </View>
              <View style={[s.summaryCard, { backgroundColor: "#4CAF5011", borderColor: "#4CAF5044" }]}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#4CAF50" />
                <Text style={[s.summaryLabel, { color: theme.icon }]}>Settled</Text>
                <Text style={[s.summaryAmount, { color: "#4CAF50" }]}>{fmtCurrency(countSettled)}</Text>
              </View>
            </View>

            {/* Line-style weekly chart */}
            <View style={[s.chartCard, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
              <Text style={[s.chartTitle, { color: theme.text }]}>This Week</Text>
              <View style={s.chartArea}>
                {weeklyTotals.map((val, idx) => {
                  const heightPct = maxBar > 0 ? (val / maxBar) : 0;
                  const barH = Math.max(4, Math.round(heightPct * 60));
                  const hasVal = val > 0;
                  return (
                    <View key={idx} style={s.chartCol}>
                      <View style={s.chartBarWrap}>
                        <View
                          style={[
                            s.chartBar,
                            {
                              height: barH,
                              backgroundColor: hasVal ? theme.primary : theme.ash,
                              borderRadius: 4,
                            },
                          ]}
                        />
                        {hasVal && <View style={[s.chartDot, { backgroundColor: theme.primary }]} />}
                      </View>
                      <Text style={[s.chartDayLabel, { color: theme.icon }]}>{DAY_LABELS[idx]}</Text>
                    </View>
                  );
                })}
              </View>
              {/* Connecting line overlay */}
              <View style={s.chartLineRow} pointerEvents="none">
                {weeklyTotals.map((val, idx) => {
                  if (idx === weeklyTotals.length - 1) return null;
                  const next = weeklyTotals[idx + 1];
                  const hasEither = val > 0 || next > 0;
                  return (
                    <View key={idx} style={[s.chartSegment, { opacity: hasEither ? 0.4 : 0 }]}>
                      <View style={[s.chartConnector, { backgroundColor: theme.primary }]} />
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Period filter pills */}
            <View style={s.periodRow}>
              {PERIODS.map((p) => {
                const active = period === p.value;
                return (
                  <TouchableOpacity
                    key={p.value}
                    style={[
                      s.periodChip,
                      {
                        backgroundColor: active ? theme.primary : theme.surface,
                        borderColor: active ? theme.primary : theme.ash,
                      },
                    ]}
                    onPress={() => setPeriod(p.value)}
                  >
                    <Text style={[s.periodChipText, { color: active ? "#fff" : theme.text }]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <Text style={[s.periodTotal, { color: theme.primary }]}>{fmtCurrency(periodTotal)}</Text>
              </View>
            </View>

            {earnings.length > 0 && (
              <Text style={[s.listHeading, { color: theme.text }]}>
                {total} earning{total !== 1 ? "s" : ""} recorded
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="wallet-outline" size={48} color={theme.ash} />
            <Text style={[s.emptyTitle, { color: theme.icon }]}>No earnings yet</Text>
            <Text style={[s.emptySub, { color: theme.icon }]}>
              Earnings appear here once orders are confirmed and delivered.
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
  pageHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pageTitle: { fontSize: 22, fontWeight: "700" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatarWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 2, overflow: "hidden" },

  totalCard: { borderRadius: 16, padding: 18, gap: 4, alignItems: "flex-start" },
  totalLabel: { fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 2 },
  totalAmount: { fontSize: 26, fontWeight: "700", color: "#fff" },

  summaryRow: { flexDirection: "row", gap: 8 },
  summaryCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, gap: 4, alignItems: "flex-start" },
  summaryLabel: { fontSize: 11 },
  summaryAmount: { fontSize: 15, fontWeight: "700" },

  chartCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  chartTitle: { fontSize: 13, fontWeight: "600" },
  chartArea: { flexDirection: "row", alignItems: "flex-end", height: 80, gap: 0 },
  chartCol: { flex: 1, alignItems: "center", gap: 6 },
  chartBarWrap: { height: 60, justifyContent: "flex-end", alignItems: "center", width: "80%" },
  chartBar: { width: "100%" },
  chartDot: { width: 6, height: 6, borderRadius: 3, position: "absolute", top: -3 },
  chartDayLabel: { fontSize: 9 },
  chartLineRow: { position: "absolute", bottom: 22, left: 14, right: 14, flexDirection: "row", height: 1 },
  chartSegment: { flex: 1, justifyContent: "center" },
  chartConnector: { height: 1, width: "100%" },

  periodRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  periodChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  periodChipText: { fontSize: 12, fontWeight: "500" },
  periodTotal: { fontSize: 16, fontWeight: "700" },

  listHeading: { fontSize: 14, fontWeight: "700" },

  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  typeText: { fontSize: 14, fontWeight: "600" },
  dateText: { fontSize: 12, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: "700" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: "700" },

  breakdown: { borderTopWidth: 1, paddingHorizontal: 14, paddingVertical: 10, gap: 6 },
  bRow: { flexDirection: "row", justifyContent: "space-between" },
  bLabel: { fontSize: 12 },
  bVal: { fontSize: 12 },

  empty: { alignItems: "center", gap: 10, paddingTop: 60 },
  emptyTitle: { fontSize: 15, fontWeight: "600" },
  emptySub: { fontSize: 13, textAlign: "center", lineHeight: 20, paddingHorizontal: 20 },

  payoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 14, borderRadius: 14,
  },
  payoutBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40, alignItems: "center", gap: 8,
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, marginBottom: 8 },
  modalClose: { position: "absolute", top: 20, right: 20, padding: 4 },
  modalTitle: { fontSize: 20, fontWeight: "700" },
  modalSub: { fontSize: 13, marginBottom: 8 },
  amountWrap: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 12,
    width: "100%", gap: 6,
  },
  amountPrefix: { fontSize: 18, fontWeight: "700" },
  amountInput: { flex: 1, fontSize: 22, fontWeight: "700" },
  modalSubmit: {
    width: "100%", paddingVertical: 16,
    borderRadius: 16, alignItems: "center", marginTop: 8,
  },
  modalSubmitText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  modalNote: { fontSize: 12, textAlign: "center", lineHeight: 18, marginTop: 4 },
});
