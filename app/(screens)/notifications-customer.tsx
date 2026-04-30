import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Theme, useTheme } from "@/constants/theme";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useNotificationStore } from "@/store/useNotificationStore";
import {
  EmptyState,
  ErrorStrip,
  OfflineStrip,
  ScreenContainer,
  Skeleton,
} from "@/components/ui/primitives";
import {
  mapServerTypeToKind,
  NotificationKind,
} from "@/lib/notificationCatalog";
import NotificationsHeader from "@/components/ui/customer/notifications/NotificationsHeader";
import FilterChips, {
  NotificationFilter,
} from "@/components/ui/customer/notifications/FilterChips";
import NotificationRow, {
  NotificationItem,
} from "@/components/ui/customer/notifications/NotificationRow";
import PinnedUrgent from "@/components/ui/customer/notifications/PinnedUrgent";

interface ServerNotification {
  _id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  createdAt: string;
  meta?: string;
  /** Some types embed an orderId for deep-linking. */
  orderId?: string;
}

interface PagedResponse {
  data: ServerNotification[];
  total: number;
  page: number;
  totalPages: number;
}

const URGENT_TYPES = new Set([
  "arrived",
  "rider_arrived",
  "payment_fail",
  "lpg_valve_alert",
]);

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function adapt(n: ServerNotification): NotificationItem {
  const kind = mapServerTypeToKind(n.type);
  const lowerType = (n.type ?? "").toLowerCase();
  const urgent = URGENT_TYPES.has(lowerType);
  const needsAction = lowerType.includes("payment_fail") || lowerType.includes("valve_alert");
  return {
    id: n._id,
    kind,
    title: n.title,
    body: n.body,
    meta: n.meta,
    createdAt: n.createdAt,
    read: n.read,
    urgent,
    needsAction,
  };
}

export default function NotificationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);

  const fetchPage = useCallback(
    async (pageNum: number, replace: boolean) => {
      try {
        const data = await api.get<PagedResponse>(
          `/api/notifications?page=${pageNum}&limit=20`,
          { timeoutMs: 10000 }
        );
        const adapted = (data.data ?? []).map(adapt);
        setItems((prev) => (replace ? adapted : [...prev, ...adapted]));
        setPage(pageNum);
        setTotalPages(data.totalPages);
        setError(null);
      } catch (err: unknown) {
        const msg =
          err && typeof err === "object" && "message" in err
            ? String((err as Error).message)
            : "Couldn't load notifications";
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Initial load only — don't reset loading on subsequent focuses (no flicker).
  const isFirstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        fetchPage(1, true);
      } else {
        // silent refresh; existing list stays visible
        api
          .get<PagedResponse>(`/api/notifications?page=1&limit=20`, {
            timeoutMs: 10000,
          })
          .then((data) => setItems((data.data ?? []).map(adapt)))
          .catch(() => {});
      }
    }, [fetchPage])
  );

  // Real-time prepend on socket event.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = (n: ServerNotification) => {
      setItems((prev) => {
        if (prev.some((p) => p.id === n._id)) return prev;
        return [adapt(n), ...prev];
      });
    };
    socket.on("notification:new", handler);
    return () => {
      socket.off("notification:new", handler);
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPage(1, true);
    setRefreshing(false);
  }, [fetchPage]);

  const onEndReached = useCallback(() => {
    if (page < totalPages && !loading) fetchPage(page + 1, false);
  }, [page, totalPages, loading, fetchPage]);

  const markRead = useCallback(async (id: string) => {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    try {
      await api.patch(`/api/notifications/${id}/read`);
      const store = useNotificationStore.getState();
      store.setUnreadCount(Math.max(0, store.unreadCount - 1));
    } catch {
      // best-effort; row stays optimistically read
    }
  }, []);

  const handlePress = useCallback(
    async (item: NotificationItem) => {
      if (!item.read) markRead(item.id);

      const lowerType = item.kind;
      switch (lowerType) {
        case "order":
          router.push("/(customer)/(track)" as never);
          break;
        case "payment":
          // paymentFail variants → re-enter Payment.
          if (item.needsAction) {
            router.push("/(customer)/(order)/payment" as never);
          } else {
            router.push("/(customer)/(order)/history" as never);
          }
          break;
        case "lpg":
          if (item.needsAction) {
            router.push("/(customer)/(order)/photo" as never);
          } else {
            router.push("/(customer)/(home)" as never);
          }
          break;
        case "promo":
          router.push("/(customer)/(home)" as never);
          break;
        case "reminder":
          router.push("/(customer)/(track)" as never);
          break;
        case "system":
        default:
          // No navigation — just mark read.
          break;
      }
    },
    [markRead, router]
  );

  const markAllRead = useCallback(async () => {
    setMarking(true);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    useNotificationStore.getState().markAllRead();
    try {
      await api.patch("/api/notifications/read-all");
    } catch {
      // optimistic — no rollback
    } finally {
      setMarking(false);
    }
  }, []);

  const onClose = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/(customer)/(home)" as never);
  }, [router]);

  // ── derive filtered + sectioned data ──
  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((n) => n.kind === filter);
  }, [items, filter]);

  // Filter chip counts mirror the design: total items per category (not just
  // unread). The header's "Mark all read" still uses the unread tally.
  const counts = useMemo(() => {
    const c: Partial<Record<NotificationFilter, number>> = {
      all: items.length,
    };
    (
      ["order", "payment", "lpg", "reminder", "promo"] as NotificationKind[]
    ).forEach((k) => {
      c[k as NotificationFilter] = items.filter((n) => n.kind === k).length;
    });
    return c;
  }, [items]);

  const unreadTotal = useMemo(
    () => items.filter((n) => !n.read).length,
    [items]
  );

  const pinned = useMemo(
    () => filtered.find((n) => n.urgent && !n.read) ?? null,
    [filtered]
  );

  type Section =
    | { type: "header"; key: string; label: string }
    | { type: "row"; key: string; item: NotificationItem; isLast: boolean };

  const flatRows = useMemo<Section[]>(() => {
    const rest = pinned
      ? filtered.filter((n) => n.id !== pinned.id)
      : filtered;
    const today = rest.filter((n) => isToday(n.createdAt));
    const earlier = rest.filter((n) => !isToday(n.createdAt));

    const out: Section[] = [];
    if (today.length > 0) {
      out.push({ type: "header", key: "h-today", label: "Today" });
      today.forEach((n, i) =>
        out.push({
          type: "row",
          key: `t-${n.id}`,
          item: n,
          isLast: i === today.length - 1,
        })
      );
    }
    if (earlier.length > 0) {
      out.push({ type: "header", key: "h-earlier", label: "Earlier" });
      earlier.forEach((n, i) =>
        out.push({
          type: "row",
          key: `e-${n.id}`,
          item: n,
          isLast: i === earlier.length - 1,
        })
      );
    }
    return out;
  }, [filtered, pinned]);

  // ── render ──
  return (
    <ScreenContainer edges={["top", "bottom"]} noScroll>
      <NotificationsHeader
        unreadCount={unreadTotal}
        onClose={onClose}
        onMarkAllRead={markAllRead}
        marking={marking}
      />
      <FilterChips
        selected={filter}
        onChange={setFilter}
        counts={counts}
      />
      <OfflineStrip
        message="Showing your last visit. We'll catch you up when you're back online."
      />
      {error ? (
        <View style={styles.errorWrap}>
          <ErrorStrip
            variant="error"
            message="Couldn't load notifications. Tap to try again."
            action={{ label: "Retry", onPress: () => fetchPage(1, true) }}
          />
        </View>
      ) : null}

      <View style={styles.listArea}>
        {loading && items.length === 0 ? (
          <View style={styles.skeletonList}>
            {Array.from({ length: 5 }).map((_, i) => (
              <View key={i} style={styles.skeletonRow}>
                <Skeleton width={40} height={40} borderRadius={theme.radius.md} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Skeleton width="60%" height={14} />
                  <Skeleton width="100%" height={12} />
                  <Skeleton width="30%" height={10} />
                </View>
              </View>
            ))}
          </View>
        ) : items.length === 0 ? (
          // Truly empty inbox — center the empty card in the list area.
          <View style={styles.emptyCenter}>
            <EmptyState
              icon="notifications-outline"
              title="You're all caught up."
              body="We'll let you know when there's something new."
              tileBg={theme.bgMuted}
              tileFg={theme.fgMuted}
            />
          </View>
        ) : filtered.length === 0 ? (
          // Filtered-empty — same centered card; chips remain pinned at top.
          <View style={styles.emptyCenter}>
            <EmptyState
              icon="notifications-outline"
              title={`No ${filterEmptyLabel(filter)} right now.`}
              tileBg={theme.bgMuted}
              tileFg={theme.fgMuted}
              compact
            />
          </View>
        ) : (
          <FlatList
            style={{ flex: 1 }}
            data={flatRows}
            keyExtractor={(s) => s.key}
            renderItem={({ item }) => {
              if (item.type === "header") {
                return <Text style={styles.sectionLabel}>{item.label}</Text>;
              }
              return (
                <NotificationRow
                  item={item.item}
                  onPress={handlePress}
                  isLast={item.isLast}
                />
              );
            }}
            ListHeaderComponent={
              pinned ? (
                <PinnedUrgent notif={pinned} onOpen={handlePress} />
              ) : null
            }
            ListFooterComponent={
              items.length > 0 ? (
                <Text style={styles.footer}>You're all caught up</Text>
              ) : null
            }
            onEndReached={onEndReached}
            onEndReachedThreshold={0.3}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.primary}
                colors={[theme.primary]}
              />
            }
          />
        )}
      </View>
    </ScreenContainer>
  );
}

function filterEmptyLabel(f: NotificationFilter): string {
  switch (f) {
    case "order":
      return "orders";
    case "payment":
      return "payments";
    case "lpg":
      return "LPG updates";
    case "reminder":
      return "reminders";
    case "promo":
      return "promos";
    default:
      return "notifications";
  }
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    errorWrap: {
      paddingHorizontal: theme.space.s4,
      paddingVertical: theme.space.s2,
    },
    listArea: {
      flex: 1,
    },
    skeletonList: {
      paddingTop: theme.space.s2,
    },
    emptyCenter: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.space.s4,
    },
    skeletonRow: {
      flexDirection: "row",
      gap: theme.space.s3,
      paddingHorizontal: theme.space.s4,
      paddingVertical: theme.space.s3,
    },
    sectionLabel: {
      ...theme.type.micro,
      color: theme.fgMuted,
      paddingHorizontal: theme.space.s4,
      paddingTop: theme.space.s4,
      paddingBottom: theme.space.s1,
    },
    footer: {
      ...theme.type.caption,
      color: theme.fgSubtle,
      textAlign: "center",
      paddingVertical: theme.space.s4,
    },
  });
