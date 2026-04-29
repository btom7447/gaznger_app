import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";
import { Skeleton } from "@/components/ui/primitives";

interface HomeHeaderProps {
  greeting: string | null;
  /** Pass `null` to render a small inline skeleton in the chip. */
  pointsBalance?: number | null;
  unreadNotifs?: number;
  onPointsPress?: () => void;
  onNotifsPress?: () => void;
}

/**
 * Greeting + points chip + notifications bell.
 * "Hi," then on next line "{name}." (period — see direction.md).
 */
export default function HomeHeader({
  greeting,
  pointsBalance,
  unreadNotifs = 0,
  onPointsPress,
  onNotifsPress,
}: HomeHeaderProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const pointsLoading = pointsBalance == null;
  const pointsLabel = pointsLoading
    ? ""
    : pointsBalance.toLocaleString("en-NG");

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={
        greeting
          ? `Hi ${greeting}.${
              pointsBalance != null
                ? ` You have ${pointsLabel} Gaznger Points.`
                : ""
            }`
          : "Home header"
      }
    >
      <View style={styles.greetingCol}>
        <Text style={styles.hi}>Hi,</Text>
        <Text style={styles.name} numberOfLines={1}>
          {greeting ? `${greeting}.` : "there."}
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={onPointsPress}
          accessibilityRole="button"
          accessibilityLabel={
            pointsLoading
              ? "Loading Gaznger Points balance."
              : `Gaznger Points balance: ${pointsLabel}. Open points screen.`
          }
          style={({ pressed }) => [
            styles.pointsChip,
            pressed && { opacity: 0.85 },
          ]}
          hitSlop={6}
        >
          <View style={styles.pointsCoin}>
            <Ionicons name="star" size={13} color={theme.palette.neutral900} />
          </View>
          {pointsLoading ? (
            <Skeleton width={32} height={12} borderRadius={4} />
          ) : (
            <Text style={styles.pointsText} numberOfLines={1}>
              {pointsLabel}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={onNotifsPress}
          accessibilityRole="button"
          accessibilityLabel={
            unreadNotifs > 0
              ? `Notifications. ${unreadNotifs} unread.`
              : "Notifications. None unread."
          }
          style={({ pressed }) => [
            styles.bell,
            pressed && { opacity: 0.85 },
          ]}
          hitSlop={6}
        >
          <Ionicons
            name="notifications-outline"
            size={20}
            color={theme.fg}
          />
          {unreadNotifs > 0 ? <View style={styles.bellDot} /> : null}
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: theme.space.s3,
    },
    greetingCol: {
      flex: 1,
    },
    hi: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    name: {
      ...theme.type.h1,
      color: theme.fg,
      marginTop: 2,
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s2,
    },
    pointsChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s2,
      backgroundColor: theme.accentTint,
      borderColor: theme.palette.gold100,
      borderWidth: 1,
      borderRadius: theme.radius.pill,
      paddingLeft: 4,
      paddingRight: theme.space.s4,
      paddingVertical: 4,
    },
    pointsCoin: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    pointsText: {
      ...theme.type.body,
      ...theme.type.money,
      color: theme.fg,
      fontWeight: "800",
    },
    bell: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.bgMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    bellDot: {
      position: "absolute",
      top: 9,
      right: 10,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.error,
      borderWidth: 1,
      borderColor: theme.bgMuted,
    },
  });
