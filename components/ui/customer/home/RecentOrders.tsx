import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme, formatCurrency } from "@/constants/theme";
import { Skeleton } from "@/components/ui/primitives";
import * as Haptics from "expo-haptics";

export interface RecentOrderItem {
  id: string;
  /** Display label e.g., "15 L Petrol" */
  title: string;
  /** Subtitle e.g., "NNPC, Ikoyi · 3 days ago" */
  subtitle: string;
  /** Total in Naira (whole). */
  amount: number;
  /** When true, the row offers a Reorder action (past orders only). */
  reorderable?: boolean;
}

interface RecentOrdersProps {
  items?: RecentOrderItem[];
  loading?: boolean;
  onRowPress?: (item: RecentOrderItem) => void;
  onReorder?: (item: RecentOrderItem) => void;
}

const SKELETON_COUNT = 2;

export default function RecentOrders({
  items,
  loading = false,
  onRowPress,
  onReorder,
}: RecentOrdersProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  if (loading) {
    return (
      <View style={styles.col}>
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <Skeleton
            key={i}
            height={64}
            width="100%"
            borderRadius={theme.radius.lg}
          />
        ))}
      </View>
    );
  }

  if (!items || items.length === 0) {
    return null;
  }

  return (
    <View style={styles.col}>
      {items.map((item) => (
        <RecentOrderRow
          key={item.id}
          item={item}
          onPress={onRowPress}
          onReorder={onReorder}
        />
      ))}
    </View>
  );
}

function RecentOrderRow({
  item,
  onPress,
  onReorder,
}: {
  item: RecentOrderItem;
  onPress?: (item: RecentOrderItem) => void;
  onReorder?: (item: RecentOrderItem) => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <Pressable
      onPress={() => onPress?.(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.title} · ${item.subtitle} · ${formatCurrency(item.amount)}`}
      style={({ pressed }) => [
        styles.row,
        pressed && { opacity: 0.9 },
      ]}
    >
      <View style={styles.iconTile}>
        <Ionicons name="time-outline" size={20} color={theme.primary} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {item.subtitle}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
        {item.reorderable ? (
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onReorder?.(item);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Reorder ${item.title}`}
            hitSlop={6}
            style={({ pressed }) => [
              styles.reorderPill,
              pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
            ]}
          >
            <Ionicons
              name="refresh"
              size={12}
              color={theme.primary}
            />
            <Text style={styles.reorderPillText}>Reorder</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    col: { gap: theme.space.s2 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: theme.radius.lg,
      padding: theme.space.s3 + 2, // 14
      gap: theme.space.s3,
    },
    iconTile: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.md,
      backgroundColor: theme.primaryTint,
      alignItems: "center",
      justifyContent: "center",
    },
    body: { flex: 1, gap: 2 },
    title: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
    },
    subtitle: {
      ...theme.type.caption,
      color: theme.fgMuted,
    },
    right: {
      alignItems: "flex-end",
      gap: 6,
    },
    amount: {
      ...theme.type.bodyLg,
      ...theme.type.money,
      color: theme.fg,
      fontWeight: "800",
    },
    reorderPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.primaryTint,
      borderColor: theme.primary,
      borderWidth: 1,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.space.s2 + 2, // 10
      paddingVertical: 4,
    },
    reorderPillText: {
      ...theme.type.micro,
      color: theme.primary,
      fontWeight: "800",
      textTransform: "none",
      letterSpacing: 0.2,
    },
  });
