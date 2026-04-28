import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";
import BackButton from "@/components/ui/global/BackButton";
import Skeleton from "@/components/ui/global/Skeleton";

interface RatingRecord {
  _id: string;
  score: number;
  comment?: string;
  createdAt: string;
  user?: { displayName: string };
  order?: { _id: string };
}

interface RatingsResponse {
  ratings: RatingRecord[];
  total: number;
  averageScore: number;
  page: number;
  pages: number;
}

function StarRow({ score }: { score: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= score ? "star" : "star-outline"}
          size={13}
          color={i <= score ? "#FBBF24" : "#D1D5DB"}
        />
      ))}
    </View>
  );
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-NG", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export default function RiderRatingsScreen() {
  const theme = useTheme();
  const [ratings, setRatings] = useState<RatingRecord[]>([]);
  const [average, setAverage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const load = useCallback(async (pageNum = 1, append = false) => {
    try {
      const res = await api.get<RatingsResponse>(
        `/api/rider/ratings?page=${pageNum}&limit=20`
      );
      setRatings((prev) => append ? [...prev, ...res.ratings] : res.ratings);
      setAverage(res.averageScore ?? 0);
      setTotal(res.total ?? 0);
      setPage(res.page ?? 1);
      setPages(res.pages ?? 1);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(1); }, [load]));

  const onRefresh = useCallback(() => { setRefreshing(true); load(1); }, [load]);
  const loadMore = useCallback(() => {
    if (loadingMore || page >= pages) return;
    setLoadingMore(true);
    load(page + 1, true);
  }, [loadingMore, page, pages, load]);

  const s = styles(theme);

  if (loading) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
        <View style={[s.header, { borderBottomColor: theme.ash }]}>
          <BackButton />
          <Text style={[s.headerTitle, { color: theme.text }]}>My Ratings</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ padding: 20, gap: 12 }}>
          {/* Summary card skeleton */}
          <View style={[s.summaryCard, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
            <View style={[s.summaryLeft, { gap: 8 }]}>
              <Skeleton width={48} height={36} borderRadius={8} color={theme.ash} />
              <Skeleton width={80} height={13} borderRadius={5} color={theme.ash} />
              <Skeleton width={60} height={12} borderRadius={5} color={theme.ash} />
            </View>
            <View style={[s.summaryDivider, { backgroundColor: theme.ash }]} />
            <View style={[s.summaryRight, { gap: 8 }]}>
              {[1, 2, 3, 4, 5].map((i) => (
                <View key={i} style={[s.barRow, { gap: 6 }]}>
                  <Skeleton width={10} height={6} borderRadius={3} color={theme.ash} />
                  <Skeleton height={6} borderRadius={3} color={theme.ash} style={{ flex: 1 }} />
                </View>
              ))}
            </View>
          </View>
          {/* Rating card skeletons */}
          {[...Array(4)].map((_, i) => (
            <View key={i} style={[s.card, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
              <View style={s.cardTop}>
                <Skeleton width={36} height={36} borderRadius={10} color={theme.ash} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Skeleton width="55%" height={13} borderRadius={5} color={theme.ash} />
                  <Skeleton width="35%" height={11} borderRadius={4} color={theme.ash} />
                </View>
                <Skeleton width={70} height={13} borderRadius={5} color={theme.ash} />
              </View>
              <Skeleton height={13} borderRadius={5} color={theme.ash} style={{ width: "80%", marginTop: 4 }} />
            </View>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  const renderItem = ({ item }: { item: RatingRecord }) => (
    <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
      <View style={s.cardTop}>
        <View style={[s.avatarWrap, { backgroundColor: theme.tertiary }]}>
          <Ionicons name="person" size={18} color={theme.primary} />
        </View>
        <View style={s.cardInfo}>
          <Text style={[s.customerName, { color: theme.text }]}>
            {item.user?.displayName ?? "Customer"}
          </Text>
          <Text style={[s.dateText, { color: theme.icon }]}>{fmtDate(item.createdAt)}</Text>
        </View>
        <StarRow score={item.score} />
      </View>
      {item.comment ? (
        <Text style={[s.comment, { color: theme.icon }]}>{item.comment}</Text>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
      <View style={[s.header, { borderBottomColor: theme.ash }]}>
        <BackButton />
        <Text style={[s.headerTitle, { color: theme.text }]}>My Ratings</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={ratings}
        keyExtractor={(r) => r._id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          total > 0 ? (
            <View style={[s.summaryCard, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
              <View style={s.summaryLeft}>
                <Text style={[s.avgScore, { color: theme.text }]}>{average.toFixed(1)}</Text>
                <StarRow score={Math.round(average)} />
                <Text style={[s.totalText, { color: theme.icon }]}>{total} rating{total !== 1 ? "s" : ""}</Text>
              </View>
              <View style={[s.summaryDivider, { backgroundColor: theme.ash }]} />
              <View style={s.summaryRight}>
                {[5, 4, 3, 2, 1].map((score) => {
                  const count = ratings.filter((r) => r.score === score).length;
                  const pct = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <View key={score} style={s.barRow}>
                      <Text style={[s.barLabel, { color: theme.icon }]}>{score}</Text>
                      <Ionicons name="star" size={10} color="#FBBF24" />
                      <View style={[s.barTrack, { backgroundColor: theme.ash }]}>
                        <View style={[s.barFill, { width: `${pct}%` as any, backgroundColor: "#FBBF24" }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="star-outline" size={48} color={theme.ash} />
            <Text style={[s.emptyTitle, { color: theme.icon }]}>No ratings yet</Text>
            <Text style={[s.emptySub, { color: theme.icon }]}>
              Ratings from customers will appear here after deliveries.
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

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1 },
    header: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 12,
    },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: "700", textAlign: "center" },

    summaryCard: {
      flexDirection: "row", borderRadius: 16, borderWidth: 1,
      padding: 16, marginBottom: 16, gap: 16,
    },
    summaryLeft: { alignItems: "center", gap: 4, flex: 1 },
    avgScore: { fontSize: 36, fontWeight: "700" },
    totalText: { fontSize: 12, marginTop: 4 },
    summaryDivider: { width: 1 },
    summaryRight: { flex: 2, gap: 4, justifyContent: "center" },
    barRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    barLabel: { fontSize: 11, width: 10, textAlign: "right" },
    barTrack: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
    barFill: { height: 6, borderRadius: 3 },

    card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
    cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
    avatarWrap: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    cardInfo: { flex: 1 },
    customerName: { fontSize: 13, fontWeight: "600" },
    dateText: { fontSize: 11, marginTop: 1 },
    comment: { fontSize: 13, lineHeight: 18, paddingTop: 4 },

    empty: { alignItems: "center", gap: 10, paddingTop: 60 },
    emptyTitle: { fontSize: 15, fontWeight: "600" },
    emptySub: { fontSize: 13, textAlign: "center", lineHeight: 20, paddingHorizontal: 20 },
  });
