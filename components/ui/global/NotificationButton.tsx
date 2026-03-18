import React, { useEffect, useRef, useState } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useSessionStore } from "@/store/useSessionStore";

interface NotificationButtonProps {
  onPress: () => void;
}

export default function NotificationButton({ onPress }: NotificationButtonProps) {
  const theme = useTheme();
  const isLoggedIn = useSessionStore((s) => s.isLoggedIn);
  const [unread, setUnread] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchUnread = async () => {
    if (!isLoggedIn) return;
    try {
      const data = await api.get<{ data: { read: boolean }[] }>("/api/notifications?page=1&limit=50");
      const count = (data.data ?? []).filter((n) => !n.read).length;
      setUnread(count);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    if (!isLoggedIn) return;
    fetchUnread();
    intervalRef.current = setInterval(fetchUnread, 60_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isLoggedIn]);

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
