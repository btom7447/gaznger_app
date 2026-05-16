import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Theme, useTheme } from "@/constants/theme";
import { api } from "@/lib/api";
import { useChatStore } from "@/store/useChatStore";
import BackButton from "@/components/ui/global/BackButton";

/**
 * Chat threads list — vendor + customer + rider all share this screen.
 * Each row opens the corresponding [id] chat thread.
 */

interface ThreadRow {
  id: string;
  peer: {
    id: string;
    displayName: string;
    profileImage: string | null;
    role: "customer" | "vendor" | "rider" | "support" | "admin";
  } | null;
  unread: number;
  orderRef: string | null;
  bulkRef: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string;
}

interface ThreadsResp {
  threads: ThreadRow[];
}

const ROLE_LABEL: Record<NonNullable<ThreadRow["peer"]>["role"], string> = {
  customer: "Customer",
  vendor: "Vendor",
  rider: "Rider",
  support: "Gaznger support",
  admin: "Gaznger",
};

const ROLE_TONE: Record<
  NonNullable<ThreadRow["peer"]>["role"],
  "primary" | "info" | "warning" | "success" | "neutral"
> = {
  customer: "warning",
  vendor: "primary",
  rider: "info",
  support: "success",
  admin: "neutral",
};

function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
  });
}

export default function ChatsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const setUnread = useChatStore((s) => s.setUnread);
  const [threads, setThreads] = useState<ThreadRow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const styles = useMemo(() => makeStyles(theme), [theme]);

  const fetch = useCallback(async () => {
    try {
      const res = await api.get<ThreadsResp>("/api/chats", {
        timeoutMs: 10_000,
      });
      setThreads(res.threads ?? []);
      const totalUnread = (res.threads ?? []).reduce(
        (acc, t) => acc + (t.unread ?? 0),
        0,
      );
      setUnread(totalUnread);
    } catch {
      setThreads([]);
    } finally {
      setRefreshing(false);
    }
  }, [setUnread]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useFocusEffect(
    useCallback(() => {
      fetch();
    }, [fetch]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetch();
  }, [fetch]);

  const handlePress = useCallback(
    (id: string) => {
      router.push({
        pathname: "/(screens)/chat/[id]" as never,
        params: { id } as never,
      });
    },
    [router],
  );

  const renderRow = ({ item }: { item: ThreadRow }) => {
    const peer = item.peer;
    const name = peer?.displayName ?? "User";
    const role = peer?.role ?? "support";
    return (
      <Pressable
        onPress={() => handlePress(item.id)}
        accessibilityRole="button"
        accessibilityLabel={`Chat with ${name}, ${item.unread} unread`}
        style={({ pressed }) => [
          styles.row,
          pressed && { opacity: 0.92 },
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: avatarBgFor(theme, role) }]}>
          <Text style={[styles.avatarText, { color: avatarFgFor(theme, role) }]}>
            {initialsFor(name)}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.rowHeader}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.time}>{relativeTime(item.lastMessageAt)}</Text>
          </View>
          <View style={styles.rowFooter}>
            <Text style={styles.preview} numberOfLines={1}>
              {item.lastMessagePreview || ROLE_LABEL[role]}
            </Text>
            {item.unread > 0 ? (
              <View style={styles.unreadDot}>
                <Text style={styles.unreadText}>
                  {item.unread > 9 ? "9+" : item.unread}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <Text style={styles.title}>Messages</Text>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={threads ?? []}
        keyExtractor={(t) => t.id}
        renderItem={renderRow}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          threads !== null ? (
            <View style={styles.empty}>
              <View
                style={[
                  styles.emptyIcon,
                  { backgroundColor: theme.primaryTint },
                ]}
              >
                <Ionicons
                  name="chatbubbles-outline"
                  size={28}
                  color={theme.primary}
                />
              </View>
              <Text style={styles.emptyHeadline}>No messages yet</Text>
              <Text style={styles.emptyBody}>
                Chats from orders, riders, and Gaznger support land here.
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

type PeerRole = NonNullable<ThreadRow["peer"]>["role"];

function avatarBgFor(theme: Theme, role: PeerRole) {
  switch (role) {
    case "customer":
      return theme.warningTint;
    case "vendor":
      return theme.primaryTint;
    case "rider":
      return theme.infoTint;
    case "support":
      return theme.successTint;
    case "admin":
    default:
      return theme.bgMuted;
  }
}

function avatarFgFor(theme: Theme, role: PeerRole) {
  switch (role) {
    case "customer":
      return theme.warning;
    case "vendor":
      return theme.primary;
    case "rider":
      return theme.info;
    case "support":
      return theme.success;
    case "admin":
    default:
      return theme.fgMuted;
  }
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 12,
    },
    title: {
      ...theme.type.h2,
      color: theme.fg,
    },
    list: {
      paddingBottom: 80,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      fontSize: 14,
      fontWeight: "800",
    },
    rowHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    name: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
      flexShrink: 1,
    },
    time: {
      ...theme.type.caption,
      color: theme.fgMuted,
    },
    rowFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      marginTop: 2,
    },
    preview: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      flex: 1,
    },
    unreadDot: {
      minWidth: 20,
      height: 20,
      paddingHorizontal: 6,
      borderRadius: 10,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    unreadText: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.fgOnPrimary,
    },
    sep: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.divider,
      marginLeft: 72,
    },
    empty: {
      alignItems: "center",
      paddingTop: 80,
      paddingHorizontal: 32,
      gap: 8,
    },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    emptyHeadline: {
      ...theme.type.h2,
      color: theme.fg,
    },
    emptyBody: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      textAlign: "center",
    },
  });
