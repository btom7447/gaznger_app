import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { toast } from "sonner-native";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useWalletStore } from "@/store/useWalletStore";
import { newIdempotencyKey } from "@/lib/idempotency";
import NotificationButton from "@/components/ui/global/NotificationButton";
import ProfileButton from "@/components/ui/global/ProfileButton";
import Skeleton from "@/components/ui/global/Skeleton";

type EarningStatus = "pending" | "settled";
type FilterType = "all" | "pending" | "settled";

interface Earning {
  _id: string;
  amount: number;
  type: "fuel_sale" | "delivery_fee";
  status: EarningStatus;
  createdAt: string;
  order?: {
    _id: string;
    totalPrice: number;
    deliveryFee: number;
    createdAt: string;
    fuel?: { name: string; unit: string };
    quantity?: number;
  };
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

function fmtDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const FILTERS: { key: FilterType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "settled", label: "Settled" },
];

export default function RiderEarnings() {
  const theme = useTheme();
  const router = useRouter();
  const walletAvailable = useWalletStore((s) => s.available);
  const walletPending = useWalletStore((s) => s.pending);
  const refreshWallet = useWalletStore((s) => s.refresh);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [summary, setSummary] = useState({ pending: 0, settled: 0 });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [filter, setFilter] = useState<FilterType>("all");
  const [showPayout, setShowPayout] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [submittingPayout, setSubmittingPayout] = useState(false);

  const load = useCallback(async (pageNum = 1, append = false, activeFilter: FilterType = filter) => {
    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: "20" });
      if (activeFilter !== "all") params.set("status", activeFilter);
      const res = await api.get<EarningsResponse>(`/api/rider/earnings?${params}`);
      setEarnings((prev) => append ? [...prev, ...res.earnings] : res.earnings);
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
  }, [filter]);

  useFocusEffect(useCallback(() => {
    load(1, false, filter);
    refreshWallet();
  }, [load, filter, refreshWallet]));

  // Socket: real-time earning updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onNew = () => { load(1, false, filter); };
    const onSettled = () => { load(1, false, filter); };

    socket.on("earnings:new", onNew);
    socket.on("earnings:settled", onSettled);
    return () => {
      socket.off("earnings:new", onNew);
      socket.off("earnings:settled", onSettled);
    };
  }, [load, filter]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(1, false, filter);
  }, [load, filter]);

  const loadMore = useCallback(() => {
    if (loadingMore || page >= pages) return;
    setLoadingMore(true);
    load(page + 1, true, filter);
  }, [loadingMore, page, pages, load, filter]);

  const handleFilterChange = useCallback((f: FilterType) => {
    setFilter(f);
    setLoading(true);
    load(1, false, f);
  }, [load]);

  const handlePayoutSubmit = async () => {
    const amount = parseInt(payoutAmount, 10);
    if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return; }
    if (amount > walletAvailable) {
      toast.error("Amount exceeds available balance", {
        description: `You have ${fmtCurrency(walletAvailable)} available.`,
      });
      return;
    }
    setSubmittingPayout(true);
    try {
      await api.post(
        "/api/rider/withdraw",
        { amount },
        { headers: { "Idempotency-Key": newIdempotencyKey() } as any }
      );
      toast.success("Payout request submitted!", {
        description: "Funds typically arrive within minutes via Paystack.",
      });
      setShowPayout(false);
      setPayoutAmount("");
      refreshWallet();
    } catch (err: any) {
      toast.error("Request failed", { description: err.message });
    } finally {
      setSubmittingPayout(false);
    }
  };

  const renderEarning = ({ item }: { item: Earning }) => {
    const isPending = item.status === "pending";
    const statusColor = isPending ? "#F59E0B" : "#10B981";
    const statusBg = isPending ? "#FEF3C7" : "#D1FAE5";

    return (
      <View
        style={[
          s.card,
          { backgroundColor: theme.surface, borderColor: theme.ash },
        ]}
      >
        <View style={s.cardTop}>
          <View style={[s.iconWrap, { backgroundColor: theme.tertiary }]}>
            <Ionicons name="bicycle" size={18} color={theme.primary} />
          </View>
          <View style={s.cardMid}>
            <Text style={[s.typeText, { color: theme.text }]}>
              Delivery
            </Text>
            <Text style={[s.amount, { color: theme.text }]}>
              {fmtCurrency(item.amount)}
            </Text>
          </View>
          <View style={s.cardRight}>
            <View style={[s.statusBadge, { backgroundColor: statusBg }]}>
              <View style={[s.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[s.statusText, { color: statusColor }]}>
                {isPending ? "Pending" : "Settled"}
              </Text>
            </View>
          </View>
        </View>

        {item.order && (
          <View style={[s.orderCtx, { backgroundColor: theme.tertiary }]}>
            <Ionicons name="time-outline" size={13} color={theme.icon} />
            <Text style={[s.dateText, { color: theme.icon }]}>
              {fmtDateTime(item.createdAt)}
            </Text>
          </View>
        )}

        {isPending && (
          <View style={[s.pendingNote, { borderTopColor: theme.ash }]}>
            <Ionicons name="time-outline" size={13} color="#F59E0B" />
            <Text style={[s.pendingNoteText, { color: "#92400E" }]}>
              Settles when delivery is completed
            </Text>
          </View>
        )}
      </View>
    );
  };

  const totalAll = summary.pending + summary.settled;

  if (loading && earnings.length === 0) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
        <View style={{ padding: 20, gap: 12 }}>
          {/* Header skeleton */}
          <View style={s.pageHeader}>
            <Skeleton width={100} height={22} borderRadius={7} color={theme.ash} />
            <View style={s.headerRight}>
              <Skeleton width={40} height={40} borderRadius={12} color={theme.ash} />
              <Skeleton width={40} height={40} borderRadius={12} color={theme.ash} />
            </View>
          </View>
          <Skeleton width={80} height={13} borderRadius={5} color={theme.ash} />
          {/* Summary cards skeleton */}
          <View style={s.summaryRow}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[s.summaryCard, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
                <Skeleton width="60%" height={11} borderRadius={4} color={theme.ash} />
                <Skeleton width="80%" height={14} borderRadius={5} color={theme.ash} style={{ marginTop: 4 }} />
                <Skeleton width="50%" height={10} borderRadius={4} color={theme.ash} style={{ marginTop: 2 }} />
              </View>
            ))}
          </View>
          {/* Payout button skeleton */}
          <Skeleton height={50} borderRadius={14} color={theme.ash} />
          {/* Filter chips skeleton */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} width={60} height={32} borderRadius={20} color={theme.ash} />
            ))}
          </View>
          {/* Earning row skeletons */}
          {[...Array(4)].map((_, i) => (
            <View key={i} style={[s.card, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
              <View style={[s.cardTop, { padding: 14 }]}>
                <Skeleton width={40} height={40} borderRadius={12} color={theme.ash} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Skeleton width="55%" height={14} borderRadius={5} color={theme.ash} />
                  <Skeleton width="35%" height={12} borderRadius={4} color={theme.ash} />
                </View>
                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  <Skeleton width={60} height={15} borderRadius={5} color={theme.ash} />
                  <Skeleton width={55} height={20} borderRadius={8} color={theme.ash} />
                </View>
              </View>
            </View>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  // Wallet is the source of truth for what's withdrawable. Earnings.summary
  // is kept around for the historical "Total Earned" / "Pending" tiles
  // because it knows about the per-order ledger; the wallet only knows
  // the aggregate balance.
  const availableBalance = walletAvailable;

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
            <View style={s.pageHeader}>
              <Text style={[s.pageTitle, { color: theme.text }]}>Earnings</Text>
              <View style={s.headerRight}>
                <NotificationButton onPress={() => router.push("/(screens)/notification" as any)} />
                <ProfileButton onPress={() => router.push("/(rider)/(queue)/profile" as any)} size={36} />
              </View>
            </View>
            <Text style={[s.pageSubtitle, { color: theme.icon }]}>
              {total} record{total !== 1 ? "s" : ""}
            </Text>

            {/* Summary cards */}
            <View style={s.summaryRow}>
              <View style={[s.summaryCard, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
                <Text style={[s.summaryLabel, { color: theme.icon }]}>Total Earned</Text>
                <Text style={[s.summaryAmount, { color: theme.text }]}>{fmtCurrency(totalAll)}</Text>
                <Text style={[s.summaryNote, { color: theme.icon }]}>All time</Text>
              </View>
              <View style={[s.summaryCard, { backgroundColor: "#FEF3C7", borderColor: "#FCD34D" }]}>
                <Text style={[s.summaryLabel, { color: "#92400E" }]}>Pending</Text>
                <Text style={[s.summaryAmount, { color: "#D97706" }]}>{fmtCurrency(walletPending || summary.pending)}</Text>
                <Text style={[s.summaryNote, { color: "#B45309" }]}>Awaiting delivery</Text>
              </View>
              <View style={[s.summaryCard, { backgroundColor: "#D1FAE5", borderColor: "#6EE7B7" }]}>
                <Text style={[s.summaryLabel, { color: "#065F46" }]}>Available</Text>
                <Text style={[s.summaryAmount, { color: "#059669" }]}>{fmtCurrency(walletAvailable)}</Text>
                <Text style={[s.summaryNote, { color: "#065F46" }]}>Withdrawable now</Text>
              </View>
            </View>

            {/* Payout note + request button */}
            <View style={[s.payoutNote, { backgroundColor: theme.tertiary }]}>
              <Ionicons name="information-circle-outline" size={14} color={theme.primary} />
              <Text style={[s.payoutNoteText, { color: theme.text }]}>
                Earnings settle automatically once the order is marked as delivered.
              </Text>
            </View>

            {/* Filter chips */}
            <View style={s.filterRow}>
              {FILTERS.map((f) => (
                <TouchableOpacity
                  key={f.key}
                  style={[
                    s.filterChip,
                    {
                      backgroundColor: filter === f.key ? theme.primary : theme.surface,
                      borderColor: filter === f.key ? theme.primary : theme.ash,
                    },
                  ]}
                  onPress={() => handleFilterChange(f.key)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      s.filterChipText,
                      { color: filter === f.key ? "#fff" : theme.icon },
                    ]}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {earnings.length > 0 && (
              <Text style={[s.listHeading, { color: theme.text }]}>History</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={s.empty}>
              <Ionicons name="wallet-outline" size={48} color={theme.ash} />
              <Text style={[s.emptyTitle, { color: theme.icon }]}>No earnings yet</Text>
              <Text style={[s.emptySub, { color: theme.icon }]}>
                {filter !== "all"
                  ? `No ${filter} earnings found.`
                  : "Complete your first delivery to start earning."}
              </Text>
            </View>
          ) : null
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
  header: { gap: 10, marginBottom: 4 },
  pageHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerRight: { flexDirection: "row", gap: 8, alignItems: "center" },
  pageTitle: { fontSize: 22, fontWeight: "700" },
  pageSubtitle: { fontSize: 13, marginTop: 2 },

  summaryRow: { flexDirection: "row", gap: 8 },
  summaryCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, gap: 2 },
  summaryLabel: { fontSize: 11, fontWeight: "600" },
  summaryAmount: { fontSize: 14, fontWeight: "700", marginTop: 2 },
  summaryNote: { fontSize: 10, marginTop: 1 },

  payoutNote: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    padding: 10, borderRadius: 10,
  },
  payoutNoteText: { flex: 1, fontSize: 12, lineHeight: 17 },
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

  filterRow: { flexDirection: "row", gap: 8 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1,
  },
  filterChipText: { fontSize: 13, fontWeight: "600" },

  listHeading: { fontSize: 15, fontWeight: "700" },

  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardMid: { flex: 1 },
  typeText: { fontSize: 14, fontWeight: "600" },
  dateText: { fontSize: 12, marginTop: 1 },
  cardRight: { alignItems: "flex-end", gap: 4 },
  amount: { fontSize: 15, fontWeight: "700" },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "700" },

  orderCtx: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  orderCtxText: { fontSize: 12 },

  pendingNote: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1,
  },
  pendingNoteText: { fontSize: 12 },

  empty: { alignItems: "center", gap: 10, paddingTop: 40 },
  emptyTitle: { fontSize: 15, fontWeight: "600" },
  emptySub: { fontSize: 13, textAlign: "center", lineHeight: 20, paddingHorizontal: 20 },
});
