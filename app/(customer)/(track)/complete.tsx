import React, { useCallback, useMemo } from "react";
import {
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Theme, useTheme, formatCurrency } from "@/constants/theme";
import { useOrderStore } from "@/store/useOrderStore";
import { useSessionStore } from "@/store/useSessionStore";
import {
  Button,
  ScreenContainer,
  StatusBadge,
} from "@/components/ui/primitives";

export default function CompleteScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const draft = useOrderStore((s) => s.order);
  const resetOrder = useOrderStore((s) => s.resetOrder);
  const user = useSessionStore((s) => s.user);

  const firstName = user?.displayName?.split(/\s+/)[0] ?? "there";
  const fuelCost = (draft.station?.totalKobo ?? 0) / 100;
  // Real charged total from the delivery-confirm payload — falls back
  // to the station total when the screen is reached without a fresh
  // socket event (rare but possible on resume).
  const orderTotal = draft.totalCharged ?? fuelCost;
  const reorderTotal = orderTotal;
  const isLpg = draft.product === "lpg";
  const riderFirstName = draft.rider?.firstName ?? "your rider";
  const rating = draft.rating;
  const pointsEarned = draft.pointsEarned ?? 0;

  // Real delivered-at timestamp formatted in Lagos time.
  const deliveredTimeStr = useMemo(() => {
    const iso = draft.deliveredAt;
    if (!iso) return "today";
    return `today, ${new Date(iso).toLocaleTimeString("en-NG", {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }, [draft.deliveredAt]);

  const summarySub = isLpg
    ? `${draft.cylinderType ?? ""} · ${deliveredTimeStr}`
    : `${draft.qty ?? 0} L ${draft.fuelTypeId ?? ""} · ${deliveredTimeStr}`;

  // Body line — composed from real submitted rating + tip + points.
  // Skips clauses that don't apply (e.g. user didn't rate, tip was 0,
  // points didn't accrue) instead of hard-coding "5 stars / ₦500 / 125
  // points" as the previous implementation did.
  const bodyLine = useMemo(() => {
    const parts: string[] = [];
    if (rating?.stars) {
      parts.push(`You rated ${riderFirstName} ${rating.stars} star${rating.stars === 1 ? "" : "s"}`);
      if (rating.tip > 0) parts.push(`tipped ${formatCurrency(rating.tip)}`);
    }
    if (pointsEarned > 0) {
      parts.push(
        `we've added ${pointsEarned} points to your account`
      );
    }
    if (parts.length === 0) return "Your order is closed.";
    // Join "A and B and C" → "A, B and C".
    if (parts.length === 1) return `${parts[0]}.`;
    if (parts.length === 2) return `${parts[0]} and ${parts[1]}.`;
    return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}.`;
  }, [rating, riderFirstName, pointsEarned]);

  const handleReorder = useCallback(() => {
    resetOrder();
    router.replace("/(customer)/(order)" as never);
  }, [resetOrder, router]);

  const handleSchedule = useCallback(() => {
    router.replace("/(customer)/(order)" as never);
  }, [router]);

  const handleRefer = useCallback(async () => {
    try {
      await Share.share({
        message:
          "Hey, try Gaznger for fuel delivery. Use my code for ₦500 off your first order.",
      });
    } catch {
      // user cancelled
    }
  }, []);

  const handleHome = useCallback(() => {
    resetOrder();
    router.replace("/(customer)/(home)" as never);
  }, [resetOrder, router]);

  return (
    <ScreenContainer
      edges={["top", "bottom"]}
      contentStyle={styles.scroll}
    >
      <StatusBadge kind="neutral">Order closed</StatusBadge>

      <Text style={styles.h1} accessibilityRole="header">
        All done, {firstName}.
      </Text>
      <Text style={styles.body1}>{bodyLine}</Text>

      <Pressable
        onPress={() => {}}
        accessibilityRole="button"
        accessibilityLabel={`Order ${draft.orderId ?? ""}`}
        style={({ pressed }) => [
          styles.summaryCard,
          pressed && { opacity: 0.92 },
        ]}
      >
        <View style={styles.summaryIcon}>
          <Ionicons name="checkmark" size={20} color={theme.success} />
        </View>
        <View style={styles.summaryBody}>
          <Text style={styles.summaryTitle}>Order #{draft.orderId ?? "—"}</Text>
          <Text style={styles.summarySub}>{summarySub}</Text>
        </View>
        <Text style={styles.summaryAmount}>{formatCurrency(orderTotal)}</Text>
      </Pressable>

      <View style={styles.reorderCard}>
        <View style={styles.reorderHeader}>
          <Ionicons name="refresh" size={18} color={theme.primary} />
          <Text style={styles.reorderTitle}>Reorder in one tap</Text>
        </View>
        <Text style={styles.reorderBody}>
          Same fuel, same address, same station — next order takes 30 seconds.
        </Text>
        <Button variant="primary" size="md" full onPress={handleReorder}>
          Reorder · {formatCurrency(reorderTotal)}
        </Button>
      </View>

      <NavCard
        icon="time-outline"
        title="Schedule the next one"
        sub="Pick a day, we'll handle it"
        onPress={handleSchedule}
        styles={styles}
        theme={theme}
      />

      <NavCard
        icon="people-outline"
        title="Invite a friend · earn ₦1,000"
        sub="They get ₦500 off first order"
        onPress={handleRefer}
        styles={styles}
        theme={theme}
        accent
      />

      <View style={{ marginTop: theme.space.s2 }}>
        <Button variant="ghost" size="md" full onPress={handleHome}>
          Back to home
        </Button>
      </View>
    </ScreenContainer>
  );
}

function NavCard({
  icon,
  title,
  sub,
  onPress,
  styles,
  theme,
  accent = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  sub: string;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  theme: Theme;
  accent?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.navCard,
        pressed && { opacity: 0.92 },
      ]}
    >
      <View
        style={[
          styles.navIcon,
          accent && {
            backgroundColor: theme.accentTint,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={18}
          color={accent ? theme.accent : theme.fgMuted}
        />
      </View>
      <View style={styles.navBody}>
        <Text style={styles.navTitle}>{title}</Text>
        <Text style={styles.navSub}>{sub}</Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={18}
        color={theme.fgMuted}
      />
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    scroll: {
      paddingHorizontal: theme.space.s4,
      paddingTop: theme.space.s4,
      paddingBottom: theme.space.s5 + 80,
      gap: theme.space.s3,
    },
    h1: {
      ...theme.type.h1,
      color: theme.fg,
    },
    body1: {
      ...theme.type.body,
      color: theme.fgMuted,
    },
    summaryCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s3,
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: theme.radius.lg,
      paddingHorizontal: theme.space.s4,
      paddingVertical: theme.space.s3 + 2,
    },
    summaryIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.successTint,
      alignItems: "center",
      justifyContent: "center",
    },
    summaryBody: { flex: 1, gap: 2 },
    summaryTitle: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "800",
    },
    summarySub: {
      ...theme.type.caption,
      color: theme.fgMuted,
    },
    summaryAmount: {
      ...theme.type.body,
      ...theme.type.money,
      color: theme.fg,
      fontWeight: "800",
    },
    reorderCard: {
      backgroundColor: theme.primaryTint,
      borderRadius: theme.radius.lg,
      padding: theme.space.s4,
      gap: theme.space.s2,
    },
    reorderHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    reorderTitle: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "800",
    },
    reorderBody: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    navCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s3,
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: theme.radius.lg,
      paddingHorizontal: theme.space.s3 + 2,
      paddingVertical: theme.space.s3,
    },
    navIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: theme.bgMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    navBody: { flex: 1, gap: 2 },
    navTitle: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "800",
    },
    navSub: {
      ...theme.type.caption,
      color: theme.fgMuted,
    },
  });
