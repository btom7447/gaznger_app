import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";

/**
 * Vendor Today hero card (v6 design).
 *
 * Layout: dark-green gradient surface holding the day's fuel revenue as
 * the headline figure, "REVENUE · TODAY" eyebrow above, a sub-line of
 * "Across N orders · ₦Xk vs <prev day>", and a 3-tile breakdown strip
 * across the bottom: Queue · In-flight · Done. A small bolt badge sits
 * in the top-right.
 */
export interface TodayHeroCardProps {
  /** Whole NGN, not kobo. */
  revenueToday: number;
  /** Whole NGN, not kobo — sum of fuelCost for orders delivered the prev Lagos day. */
  revenueYesterday: number;
  /** 3-letter weekday for the prev Lagos day, e.g. "Mon". */
  prevDayLabel: string;
  /** Total orders touching today across queue + in-flight + done. */
  ordersTotal: number;
  ordersQueue: number;
  ordersInFlight: number;
  ordersDone: number;
  /**
   * Eyebrow override. Aggregate cards show "Revenue · Today" (the
   * default). Per-station cards in the carousel show the station name
   * so the operator knows which one they're looking at.
   */
  eyebrow?: string;
}

function fmtNaira(value: number): string {
  return `₦${value.toLocaleString("en-NG")}`;
}

/**
 * Compact naira: 14k for 14_000, 1.2m for 1_200_000, 8.3k for 8300.
 * Used in the sub-line where a full ₦ figure would crowd the row.
 */
function fmtCompactNaira(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `₦${(value / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `₦${(value / 1_000).toFixed(0)}k`;
  return `₦${value.toLocaleString("en-NG")}`;
}

export default function TodayHeroCard({
  revenueToday,
  revenueYesterday,
  prevDayLabel,
  ordersTotal,
  ordersQueue,
  ordersInFlight,
  ordersDone,
  eyebrow = "Revenue · Today",
}: TodayHeroCardProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // Dark forest-green outer per design. The bolt badge + 3 tiles use a
  // lighter overlay so they pop off the darker card surface.
  const gradient =
    theme.mode === "dark"
      ? [theme.palette.green900, "#000"]
      : [theme.palette.green700, theme.palette.green900];
  // Inner accents (bolt badge + tile bg) — lighter green tinted with
  // transparency so the gradient still bleeds through.
  const innerBg = "rgba(255,255,255,0.16)";

  const subLine =
    ordersTotal > 0
      ? prevDayLabel
        ? `Across ${ordersTotal} order${ordersTotal === 1 ? "" : "s"} · ${fmtCompactNaira(revenueYesterday)} vs ${prevDayLabel}`
        : `Across ${ordersTotal} order${ordersTotal === 1 ? "" : "s"}`
      : "No orders yet today";

  const a11y =
    `Today's revenue ${fmtNaira(revenueToday)}.` +
    ` ${ordersQueue} in queue, ${ordersInFlight} in flight,` +
    ` ${ordersDone} done.`;

  return (
    <LinearGradient
      colors={gradient as [string, string, ...string[]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.headerRow} accessible accessibilityLabel={a11y}>
        <Text style={styles.eyebrow} numberOfLines={1}>{eyebrow}</Text>
        <View style={[styles.boltBadge, { backgroundColor: innerBg }]}>
          <Ionicons name="flash" size={16} color="#fff" />
        </View>
      </View>

      <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
        {fmtNaira(revenueToday)}
      </Text>

      <Text style={styles.subLine} numberOfLines={1}>
        {subLine}
      </Text>

      <View style={styles.tileRow}>
        <Tile value={ordersQueue} label="Queue" bg={innerBg} />
        <Tile value={ordersInFlight} label="In-flight" bg={innerBg} />
        <Tile value={ordersDone} label="Done" bg={innerBg} />
      </View>
    </LinearGradient>
  );
}

function Tile({
  value,
  label,
  bg,
}: {
  value: number;
  label: string;
  bg: string;
}) {
  return (
    <View style={[tileStyles.tile, { backgroundColor: bg }]}>
      <Text style={tileStyles.value} numberOfLines={1}>
        {value}
      </Text>
      <Text style={tileStyles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      borderRadius: theme.radius.xl,
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 16,
      gap: 4,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    eyebrow: {
      fontSize: 12,
      fontWeight: "700",
      color: "rgba(255,255,255,0.85)",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    boltBadge: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    amount: {
      fontSize: 36,
      fontWeight: "800",
      letterSpacing: -0.8,
      color: "#fff",
      marginTop: 8,
    },
    subLine: {
      ...theme.type.bodySm,
      color: "rgba(255,255,255,0.75)",
      marginTop: 2,
    },
    tileRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 16,
    },
  });

const tileStyles = StyleSheet.create({
  tile: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 2,
  },
  value: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
    color: "rgba(255,255,255,0.75)",
  },
});
