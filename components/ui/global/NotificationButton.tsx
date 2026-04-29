import React, { useEffect } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useSessionStore } from "@/store/useSessionStore";
import { useNotificationStore } from "@/store/useNotificationStore";
import { getSocket } from "@/lib/socket";

interface NotificationButtonProps {
  onPress: () => void;
}

export default function NotificationButton({ onPress }: NotificationButtonProps) {
  const theme = useTheme();
  const isLoggedIn = useSessionStore((s) => s.isLoggedIn);
  const unread = useNotificationStore((s) => s.unreadCount);
  const { setUnreadCount, increment } = useNotificationStore.getState();

  // Fetch initial unread count once on mount
  useEffect(() => {
    if (!isLoggedIn) return;
    api
      .get<{ data: { read: boolean }[] }>("/api/notifications?page=1&limit=50")
      .then((data) => setUnreadCount((data.data ?? []).filter((n) => !n.read).length))
      .catch(() => {});
  }, [isLoggedIn]);

  // Real-time: increment badge when a new notification arrives
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.on("notification:new", increment);
    return () => { socket.off("notification:new", increment); };
  }, []);

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.ash }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons name="notifications-outline" size={20} color={theme.icon} />
      {unread > 0 && <View style={[styles.badge, { backgroundColor: theme.error }]} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    borderWidth: 1,
  },
  badge: {
    position: "absolute",
    top: 9,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
