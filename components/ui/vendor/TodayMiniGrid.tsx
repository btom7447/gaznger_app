import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";

/**
 * Two side-by-side cards on Today, beneath the alerts row:
 *
 *   ┌──────────────────┬──────────────────┐
 *   │  Next up         │  Team            │
 *   │  Olivia          │  ● 4 active      │
 *   │  20L Petrol      │  ● 2 idle        │
 *   │  ₦16,000         │  ● 1 offline     │
 *   └──────────────────┴──────────────────┘
 *
 * Both cards tap into deeper surfaces — next-up routes to the order
 * detail (or assign-rider sheet), team routes to the Team screen
 * inside Profile.
 */

export interface TodayNextOrder {
  id: string;
  customer: string;
  qty: string;
  fuel: string;
  price: string;
}

export interface TodayTeamStatus {
  active: number;
  idle: number;
  offline: number;
}

interface Props {
  nextOrder: TodayNextOrder | null;
  team: TodayTeamStatus;
  onNextOrderPress?: (orderId: string) => void;
  onTeamPress?: () => void;
}

export default function TodayMiniGrid({
  nextOrder,
  team,
  onNextOrderPress,
  onTeamPress,
}: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.row}>
      <NextOrderCard
        order={nextOrder}
        onPress={
          nextOrder && onNextOrderPress
            ? () => onNextOrderPress(nextOrder.id)
            : undefined
        }
        styles={styles}
        theme={theme}
      />
      <TeamCard
        team={team}
        onPress={onTeamPress}
        styles={styles}
        theme={theme}
      />
    </View>
  );
}

function NextOrderCard({
  order,
  onPress,
  styles,
  theme,
}: {
  order: TodayNextOrder | null;
  onPress?: () => void;
  styles: ReturnType<typeof makeStyles>;
  theme: Theme;
}) {
  const body = (
    <>
      <View style={styles.eyebrowRow}>
        <Ionicons name="flash" size={12} color={theme.fgMuted} />
        <Text style={styles.eyebrow}>Next up</Text>
      </View>
      {order ? (
        <>
          <Text style={styles.primary} numberOfLines={1}>
            {order.customer}
          </Text>
          <Text style={styles.secondary} numberOfLines={1}>
            {order.qty} {order.fuel}
          </Text>
          <Text style={styles.money} numberOfLines={1}>
            {order.price}
          </Text>
        </>
      ) : (
        <View style={styles.emptyWrap}>
          <View
            style={[
              styles.emptyIconCircle,
              { backgroundColor: theme.bgMuted },
            ]}
          >
            <Ionicons
              name="checkmark-done-outline"
              size={20}
              color={theme.fgMuted}
            />
          </View>
          <Text style={styles.emptyHeadline} numberOfLines={1}>
            All caught up
          </Text>
          <Text style={styles.emptyBody} numberOfLines={2}>
            Nothing waiting.
          </Text>
        </View>
      )}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={
          order
            ? `Next order: ${order.customer}, ${order.qty} ${order.fuel}, ${order.price}. Tap to open.`
            : "No queue"
        }
        style={({ pressed }) => [
          styles.card,
          pressed && { opacity: 0.92 },
        ]}
      >
        {body}
      </Pressable>
    );
  }
  return <View style={styles.card}>{body}</View>;
}

function TeamCard({
  team,
  onPress,
  styles,
  theme,
}: {
  team: TodayTeamStatus;
  onPress?: () => void;
  styles: ReturnType<typeof makeStyles>;
  theme: Theme;
}) {
  const isEmpty = team.active + team.idle + team.offline === 0;
  const body = (
    <>
      <View style={styles.eyebrowRow}>
        <Ionicons name="people" size={12} color={theme.fgMuted} />
        <Text style={styles.eyebrow}>Team</Text>
      </View>
      {isEmpty ? (
        <View style={styles.emptyWrap}>
          <View
            style={[
              styles.emptyIconCircle,
              { backgroundColor: theme.bgMuted },
            ]}
          >
            <Ionicons
              name="person-add-outline"
              size={20}
              color={theme.fgMuted}
            />
          </View>
          <Text style={styles.emptyHeadline} numberOfLines={1}>
            No riders yet
          </Text>
          <Text style={styles.emptyBody} numberOfLines={2}>
            Invite riders to get going.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.teamRow}>
            <View style={[styles.teamDot, { backgroundColor: theme.primary }]} />
            <Text style={styles.teamLabel} numberOfLines={1}>
              {team.active} active
            </Text>
          </View>
          <View style={styles.teamRow}>
            <View
              style={[styles.teamDot, { backgroundColor: theme.success }]}
            />
            <Text style={styles.teamLabel} numberOfLines={1}>
              {team.idle} idle
            </Text>
          </View>
          <View style={styles.teamRow}>
            <View
              style={[styles.teamDot, { backgroundColor: theme.fgSubtle }]}
            />
            <Text style={styles.teamLabel} numberOfLines={1}>
              {team.offline} offline
            </Text>
          </View>
        </>
      )}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Team: ${team.active} active, ${team.idle} idle, ${team.offline} offline.`}
        style={({ pressed }) => [
          styles.card,
          pressed && { opacity: 0.92 },
        ]}
      >
        {body}
      </Pressable>
    );
  }
  return <View style={styles.card}>{body}</View>;
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      gap: 12,
    },
    card: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: theme.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      paddingHorizontal: 14,
      paddingVertical: 14,
      gap: 6,
      minHeight: 130,
    },
    eyebrowRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 4,
    },
    eyebrow: {
      ...theme.type.caption,
      color: theme.fgMuted,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    primary: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
    },
    secondary: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    money: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "800",
      marginTop: 2,
    },
    teamRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    teamDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    teamLabel: {
      ...theme.type.bodySm,
      color: theme.fg,
      fontWeight: "600",
    },
    emptyWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingTop: 4,
    },
    emptyIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    emptyHeadline: {
      ...theme.type.bodySm,
      color: theme.fg,
      fontWeight: "700",
    },
    emptyBody: {
      ...theme.type.caption,
      color: theme.fgMuted,
      textAlign: "center",
    },
  });
