import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";
import { Theme, useTheme } from "@/constants/theme";
import CountUpNumber from "@/components/ui/global/CountUpNumber";

/**
 * Vendor Today hero card.
 *
 * Matches the Wallet hero language exactly: dark forest gradient,
 * concentric SVG circles top-right, eyebrow + amount + sub-line, then
 * a 3-tile breakdown strip across the bottom (Queue · In-flight · Done).
 *
 * No bolt badge — design consistency rule across all vendor hero
 * cards (Today, Wallet, Order detail) is "circles only".
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

  const gradient =
    theme.mode === "dark"
      ? [theme.palette.green900, "#000"]
      : [theme.palette.green700, theme.palette.green900];
  // Inner tile bg — lighter overlay so tiles pop off the darker card.
  const innerBg = "rgba(255,255,255,0.16)";

  const subLine =
    ordersTotal > 0
      ? prevDayLabel
        ? `Across ${ordersTotal} order${ordersTotal === 1 ? "" : "s"} · ${fmtNaira(revenueYesterday)} vs ${prevDayLabel}`
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
      <View pointerEvents="none" style={styles.circles}>
        <Svg width={120} height={120} viewBox="0 0 120 120">
          <Circle
            cx={60}
            cy={60}
            r={50}
            stroke="#fff"
            strokeWidth={2}
            fill="none"
            opacity={0.08}
          />
          <Circle
            cx={60}
            cy={60}
            r={30}
            stroke="#fff"
            strokeWidth={2}
            fill="none"
            opacity={0.08}
          />
        </Svg>
      </View>

      <Text
        style={styles.eyebrow}
        numberOfLines={1}
        accessible
        accessibilityLabel={a11y}
      >
        {eyebrow}
      </Text>

      <CountUpNumber
        value={revenueToday}
        format={(n) => fmtNaira(Math.round(n))}
        style={styles.amount}
        numberOfLines={1}
        accessibilityLabel={`Revenue today ${fmtNaira(revenueToday)}`}
      />

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
      <CountUpNumber
        value={value}
        format={(n) => `${Math.round(n)}`}
        style={tileStyles.value}
        numberOfLines={1}
      />
      <Text style={tileStyles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const makeStyles = (_theme: Theme) =>
  StyleSheet.create({
    card: {
      borderRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 16,
      overflow: "hidden",
      position: "relative",
    },
    circles: {
      position: "absolute",
      right: -20,
      top: -20,
    },
    eyebrow: {
      fontSize: 11,
      fontWeight: "800",
      color: "rgba(255,255,255,0.7)",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    amount: {
      fontSize: 38,
      fontWeight: "800",
      letterSpacing: -0.8,
      color: "#fff",
      marginTop: 4,
    },
    subLine: {
      fontSize: 12,
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
