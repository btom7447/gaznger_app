import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";

/**
 * Vendor Today hero card — the revenue-anchored entry point.
 *
 * Layout: gradient surface (primary → primary-darker) holding the day's
 * fuel revenue as the headline figure, a "Today" eyebrow above, and a
 * 3-cell breakdown strip beneath: Done · In-flight · Bulk in transit.
 *
 * Terse copy: numbers do the talking. Eyebrow + label tokens only.
 */
export interface TodayHeroCardProps {
  /** Whole NGN, not kobo. */
  revenueToday: number;
  ordersDone: number;
  ordersInFlight: number;
  bulkInTransit: number;
  /** Active station name (omitted on the all-stations view). */
  stationName?: string | null;
}

function fmtNaira(value: number): string {
  return `₦${value.toLocaleString("en-NG")}`;
}

export default function TodayHeroCard({
  revenueToday,
  ordersDone,
  ordersInFlight,
  bulkInTransit,
  stationName,
}: TodayHeroCardProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // Gradient palette derived from primary. Slightly darker stop at the
  // bottom so the card reads as elevated against the screen bg.
  const gradient =
    theme.mode === "dark"
      ? [theme.palette.green700, theme.palette.green900]
      : [theme.palette.green500, theme.palette.green700];

  const a11y =
    `Today's revenue ${fmtNaira(revenueToday)}.` +
    ` ${ordersDone} delivered, ${ordersInFlight} in flight,` +
    ` ${bulkInTransit} bulk in transit.`;

  return (
    <LinearGradient
      colors={gradient as [string, string, ...string[]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.headerRow} accessible accessibilityLabel={a11y}>
        <View style={styles.eyebrowWrap}>
          <Ionicons name="trending-up" size={12} color="rgba(255,255,255,0.85)" />
          <Text style={styles.eyebrow}>
            {stationName ? `Today · ${stationName}` : "Today"}
          </Text>
        </View>
      </View>

      <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
        {fmtNaira(revenueToday)}
      </Text>

      <View style={styles.divider} />

      <View style={styles.breakdownRow}>
        <BreakdownCell label="Done" value={ordersDone} />
        <View style={styles.cellDivider} />
        <BreakdownCell label="In-flight" value={ordersInFlight} />
        <View style={styles.cellDivider} />
        <BreakdownCell label="Bulk" value={bulkInTransit} />
      </View>
    </LinearGradient>
  );
}

function BreakdownCell({ label, value }: { label: string; value: number }) {
  return (
    <View style={cellStyles.cell}>
      <Text style={cellStyles.value} numberOfLines={1}>
        {value}
      </Text>
      <Text style={cellStyles.label} numberOfLines={1}>
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
      paddingVertical: 18,
      gap: 4,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    eyebrowWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    eyebrow: {
      fontSize: 12,
      fontWeight: "700",
      color: "rgba(255,255,255,0.85)",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    amount: {
      fontSize: 36,
      fontWeight: "800",
      letterSpacing: -0.8,
      color: "#fff",
      marginTop: 4,
    },
    divider: {
      height: 1,
      backgroundColor: "rgba(255,255,255,0.15)",
      marginVertical: 14,
    },
    breakdownRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    cellDivider: {
      width: 1,
      alignSelf: "stretch",
      backgroundColor: "rgba(255,255,255,0.15)",
    },
  });

const cellStyles = StyleSheet.create({
  cell: {
    flex: 1,
    alignItems: "center",
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
    letterSpacing: 0.4,
    color: "rgba(255,255,255,0.75)",
    textTransform: "uppercase",
  },
});
