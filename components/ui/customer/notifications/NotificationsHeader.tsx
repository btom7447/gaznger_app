import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";

interface NotificationsHeaderProps {
  unreadCount: number;
  onClose: () => void;
  onMarkAllRead: () => void;
  marking?: boolean;
}

/**
 * Sticky header — close chip + centered title + Mark all read action.
 */
export default function NotificationsHeader({
  unreadCount,
  onClose,
  onMarkAllRead,
  marking = false,
}: NotificationsHeaderProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const canMark = unreadCount > 0 && !marking;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close notifications"
        style={({ pressed }) => [
          styles.iconChip,
          pressed && { opacity: 0.7 },
        ]}
        hitSlop={8}
      >
        <Ionicons name="chevron-back" size={20} color={theme.fg} />
      </Pressable>

      <Text style={styles.title} accessibilityRole="header">
        Notifications
      </Text>

      <Pressable
        onPress={canMark ? onMarkAllRead : undefined}
        disabled={!canMark}
        accessibilityRole="button"
        accessibilityLabel={
          canMark
            ? `Mark all ${unreadCount} as read`
            : "No unread notifications"
        }
        accessibilityState={{ disabled: !canMark }}
        style={({ pressed }) => [
          styles.action,
          pressed && canMark && { opacity: 0.7 },
        ]}
        hitSlop={8}
      >
        <Text
          style={[
            styles.actionText,
            { color: canMark ? theme.primary : theme.fgSubtle },
          ]}
        >
          {marking ? "Marking…" : "Mark all read"}
        </Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.space.s4,
      paddingVertical: theme.space.s2,
      backgroundColor: theme.bg,
      borderBottomColor: theme.divider,
      borderBottomWidth: StyleSheet.hairlineWidth,
      minHeight: 52,
    },
    iconChip: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.bgMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      ...theme.type.bodyLg,
      color: theme.fg,
      fontWeight: "800",
      flex: 1,
      textAlign: "center",
    },
    action: {
      minWidth: 80,
      alignItems: "flex-end",
    },
    actionText: {
      ...theme.type.caption,
      fontWeight: "700",
    },
  });
