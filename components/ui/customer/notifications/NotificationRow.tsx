import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";
import {
  NotificationKind,
} from "@/lib/notificationCatalog";

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  meta?: string;
  createdAt: string;
  read: boolean;
  /** Marks the row as urgent (paymentFail, arrived, lpgValveAlert). */
  urgent?: boolean;
  /** Render a small "ACTION" pill next to the title (e.g., paymentFail). */
  needsAction?: boolean;
}

interface NotificationRowProps {
  item: NotificationItem;
  onPress: (item: NotificationItem) => void;
  /** Last row in a section — drop the divider. */
  isLast?: boolean;
}

interface KindVisual {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  bg: string;
  fg: string;
}

function getVisual(kind: NotificationKind, theme: Theme): KindVisual {
  switch (kind) {
    case "order":
      return {
        icon: "bicycle-outline",
        bg: theme.primaryTint,
        fg: theme.primary,
      };
    case "payment":
      return {
        icon: "card-outline",
        bg: theme.infoTint,
        fg: theme.info,
      };
    case "reminder":
      return {
        icon: "notifications-outline",
        bg: theme.warningTint,
        fg: theme.warning,
      };
    case "lpg":
      return {
        icon: "flame",
        bg:
          theme.mode === "dark" ? "#2A1810" : "#FFF1E8",
        fg:
          theme.mode === "dark" ? "#F0A070" : "#A04510",
      };
    case "promo":
      return {
        icon: "pricetag-outline",
        bg: theme.accentTint,
        fg: theme.mode === "dark" ? theme.palette.gold300 : theme.palette.gold700,
      };
    case "system":
    default:
      return {
        icon: "star-outline",
        bg: theme.bgMuted,
        fg: theme.fgMuted,
      };
  }
}

function formatStamp(iso: string): string {
  return new Date(iso).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationRow({
  item,
  onPress,
  isLast = false,
}: NotificationRowProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const visual = useMemo(() => getVisual(item.kind, theme), [item.kind, theme]);

  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.body}. ${
        item.meta ?? ""
      }. ${item.read ? "Read" : "Unread"}.`}
      style={({ pressed }) => [
        styles.row,
        !item.read && styles.rowUnread,
        !isLast && styles.rowDivider,
        pressed && { opacity: 0.85 },
      ]}
    >
      {!item.read ? (
        <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />
      ) : null}

      <View style={[styles.tile, { backgroundColor: visual.bg }]}>
        <Ionicons name={visual.icon} size={20} color={visual.fg} />
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text
            style={[
              styles.title,
              { color: theme.fg, fontWeight: item.read ? "600" : "800" },
            ]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          {item.needsAction ? (
            <View style={styles.actionPill}>
              <Text style={styles.actionPillText}>ACTION</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.bodyText} numberOfLines={2}>
          {item.body}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {item.meta ?? formatStamp(item.createdAt)}
        </Text>
      </View>
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      paddingHorizontal: theme.space.s4,
      paddingVertical: theme.space.s3,
      gap: theme.space.s3,
      backgroundColor: theme.bg,
    },
    rowUnread: {
      backgroundColor:
        theme.mode === "dark"
          ? "rgba(46,166,100,0.06)"
          : "rgba(46,166,100,0.04)",
    },
    rowDivider: {
      borderBottomColor: theme.divider,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    unreadDot: {
      position: "absolute",
      left: 6,
      top: 22,
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    tile: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    body: { flex: 1, gap: 4 },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s2,
    },
    title: {
      ...theme.type.body,
      flex: 1,
    },
    actionPill: {
      backgroundColor: theme.errorTint,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: theme.radius.sm,
    },
    actionPillText: {
      ...theme.type.micro,
      color: theme.error,
      fontWeight: "800",
    },
    bodyText: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    meta: {
      ...theme.type.caption,
      color: theme.fgSubtle,
    },
  });
