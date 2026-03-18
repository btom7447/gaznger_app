import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { toast } from "sonner-native";
import { useTheme } from "@/constants/theme";
import { useSessionStore } from "@/store/useSessionStore";
import { api } from "@/lib/api";
import BackButton from "@/components/ui/global/BackButton";
import NotificationListSkeleton from "@/components/ui/skeletons/NotificationListSkeleton";

interface Notification {
  _id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  createdAt: string;
}

interface PagedResponse {
  data: Notification[];
  total: number;
  page: number;
  totalPages: number;
}

type IconConfig = {
  name: keyof typeof Ionicons.glyphMap;
  bg: string;
  color: string;
};

function getIconConfig(type: string, theme: ReturnType<typeof useTheme>): IconConfig {
  switch (type?.toLowerCase()) {
    case "order":
      return { name: "receipt-outline", bg: theme.tertiary, color: theme.primary };
    case "payment":
      return { name: "card-outline", bg: theme.accentLight, color: theme.accent };
    case "delivery":
    case "in_transit":
      return { name: "bicycle-outline", bg: "#E8F4FD", color: "#2196F3" };
    case "delivered":
      return { name: "checkmark-circle-outline", bg: "#E8F5E9", color: theme.success };
    case "cancelled":
      return { name: "close-circle-outline", bg: "#FDECEA", color: theme.error };
    case "promotion":
    case "promo":
      return { name: "gift-outline", bg: "#FFF3E0", color: "#FF9800" };
    case "system":
    case "info":
      return { name: "information-circle-outline", bg: theme.surface, color: theme.icon };
    case "alert":
    case "warning":
      return { name: "warning-outline", bg: "#FFF8E1", color: theme.warning };
    case "points":
      return { name: "star-outline", bg: theme.accentLight, color: theme.accent };
    default:
      return { name: "notifications-outline", bg: theme.tertiary, color: theme.primary };
  }
}

export default function NotificationScreen() {
  const theme = useTheme();
  const role = useSessionStore((s) => s.user?.role ?? "customer");
  const [items, setItems] = useState<Notification[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async (pageNum: number, replace: boolean) => {
    if (loading && !replace) return;
    setLoading(true);
    try {
      const data = await api.get<PagedResponse>(`/api/notifications?page=${pageNum}&limit=20`);
      setItems((prev) => (replace ? data.data : [...prev, ...data.data]));
      setPage(pageNum);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      toast.error("Failed to load notifications", { description: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(1, true); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications(1, true);
    setRefreshing(false);
  };

  const onEndReached = () => {
    if (page < totalPages && !loading) fetchNotifications(page + 1, false);
  };

  const markRead = async (id: string) => {
    try {
      await api.patch(`/api/notifications/${id}/read`);
      setItems((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
    } catch {}
  };

  const handlePress = async (item: Notification) => {
    if (!item.read) await markRead(item._id);

    // Customer notifications
    if (role === "customer") {
      switch (item.type) {
        case "order":
        case "payment":
        case "delivery":
        case "delivered":
        case "cancelled":
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          router.push("/(customer)/(track)" as any);
          break;
        case "points":
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          router.push("/(customer)/(home)" as any);
          break;
        default:
          break;
      }
      return;
    }

    // Vendor notifications
    if (role === "vendor") {
      switch (item.type) {
        case "new_order":
        case "order":
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          router.push("/(vendor)/(dashboard)/orders" as any);
          break;
        default:
          break;
      }
      return;
    }

    // Rider notifications
    if (role === "rider") {
      switch (item.type) {
        case "dispatch":
        case "delivery":
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          router.push("/(rider)/(queue)" as any);
          break;
        case "earnings":
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          router.push("/(rider)/(queue)/earnings" as any);
          break;
        default:
          break;
      }
    }
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await api.patch("/api/notifications/read-all");
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err: any) {
      toast.error("Failed", { description: err.message });
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = items.filter((n) => !n.read).length;
  const s = styles(theme);

  const renderItem = ({ item }: { item: Notification }) => {
    const iconCfg = getIconConfig(item.type, theme);
    return (
      <TouchableOpacity
        style={[
          s.card,
          {
            backgroundColor: item.read ? theme.background : theme.surface,
            borderColor: item.read ? theme.ash : theme.borderMid,
          },
        ]}
        onPress={() => handlePress(item)}
        activeOpacity={0.8}
      >
        {/* Type icon */}
        <View style={[s.iconWrap, { backgroundColor: iconCfg.bg }]}>
          <Ionicons name={iconCfg.name} size={20} color={iconCfg.color} />
        </View>

        {/* Body */}
        <View style={s.cardBody}>
          <View style={s.titleRow}>
            <Text style={[s.cardTitle, { color: theme.text }]} numberOfLines={1}>
              {item.title}
            </Text>
            {!item.read && (
              <View style={[s.unreadDot, { backgroundColor: theme.primary }]} />
            )}
          </View>
          <Text style={[s.cardDesc, { color: theme.icon }]} numberOfLines={2}>
            {item.body}
          </Text>
          <Text style={[s.cardTime, { color: theme.icon }]}>
            {new Date(item.createdAt).toLocaleDateString("en-NG", {
              day: "numeric", month: "short",
              hour: "2-digit", minute: "2-digit",
            })}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle={theme.mode === "dark" ? "light-content" : "dark-content"} />
      <View style={s.header}>
        <BackButton />
        <Text style={s.headerTitle}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllRead} disabled={markingAll}>
            {markingAll ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Text style={[s.markAll, { color: theme.primary }]}>Mark all read</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={s.list}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary]} />
        }
        ListHeaderComponent={
          loading && !items.length ? (
            <View style={{ paddingTop: 8 }}>
              <NotificationListSkeleton count={7} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading ? null : (
            <View style={s.empty}>
              <View style={[s.emptyIconWrap, { backgroundColor: theme.tertiary }]}>
                <Ionicons name="notifications-off-outline" size={36} color={theme.icon} />
              </View>
              <Text style={[s.emptyTitle, { color: theme.text }]}>No notifications</Text>
              <Text style={[s.emptySubtitle, { color: theme.icon }]}>
                You're all caught up!
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          loading && items.length > 0 ? (
            <ActivityIndicator style={{ marginVertical: 16 }} color={theme.primary} />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 16, paddingVertical: 12,
    },
    headerTitle: { fontSize: 17, fontWeight: "500", color: theme.text },
    markAll: { fontSize: 13, fontWeight: "400" },
    list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 },
    card: {
      flexDirection: "row", alignItems: "flex-start",
      gap: 12, borderWidth: 1, borderRadius: 16,
      padding: 14, marginBottom: 10,
    },
    iconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center", flexShrink: 0 },
    cardBody: { flex: 1 },
    titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
    cardTitle: { fontSize: 14, fontWeight: "400", flex: 1 },
    unreadDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 8, flexShrink: 0 },
    cardDesc: { fontSize: 13, fontWeight: "300", lineHeight: 18, marginBottom: 6 },
    cardTime: { fontSize: 11, fontWeight: "300" },
    empty: { alignItems: "center", marginTop: 80, gap: 12 },
    emptyIconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
    emptyTitle: { fontSize: 17, fontWeight: "500" },
    emptySubtitle: { fontSize: 13, fontWeight: "300", textAlign: "center" },
  });
