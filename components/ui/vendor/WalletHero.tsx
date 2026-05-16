import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";
import CountUpNumber from "@/components/ui/global/CountUpNumber";

/**
 * Wallet hero — v6 design.
 *
 *   AVAILABLE BALANCE                              ◯◎  ←  circle decoration
 *   ₦612,840                                       (top-right)
 *   after fees · ₦18,400 today
 *
 *   [ Withdraw ]   [ ⟲ Schedule ]
 *
 *   IN ESCROW       PENDING SETTLE     NEXT PAYOUT
 *   ₦34.3M          ₦128,400           Tomorrow
 *
 * Outer card: dark forest green gradient (green-700 → green-900).
 * Inner accents (Schedule button bg, divider) use white-on-overlay so
 * the structure reads off the dark surface.
 */

export interface WalletHeroProps {
  /** Whole NGN. */
  available: number;
  /** Whole NGN — sum of fees deducted today. Surfaced in the sub-line. */
  afterFeesToday?: number;
  /** Whole NGN held in escrow across in-flight orders. */
  escrow: number;
  /** Whole NGN settled but not yet paid out. */
  pendingSettle: number;
  /** Human label, e.g. "Tomorrow", "Mon 06:00". */
  nextPayoutLabel?: string;
  onWithdrawPress?: () => void;
  onSchedulePress?: () => void;
}

function fmtNaira(value: number): string {
  return `₦${Math.round(value).toLocaleString("en-NG")}`;
}

/** Full thousand-separated naira. */
function fmtNairaFull(value: number): string {
  return `₦${Math.round(value).toLocaleString("en-NG")}`;
}

export default function WalletHero({
  available,
  afterFeesToday,
  escrow,
  pendingSettle,
  nextPayoutLabel,
  onWithdrawPress,
  onSchedulePress,
}: WalletHeroProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const gradient = [theme.palette.green700, theme.palette.green900];

  const subLine =
    typeof afterFeesToday === "number" && afterFeesToday > 0
      ? `after fees · ${fmtNaira(afterFeesToday)} today`
      : "after fees";

  return (
    <LinearGradient
      colors={gradient as [string, string, ...string[]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
      accessible
      accessibilityLabel={
        `Available balance ${fmtNaira(available)}.` +
        ` In escrow ${fmtNaira(escrow)}.` +
        ` Pending settle ${fmtNaira(pendingSettle)}.` +
        (nextPayoutLabel ? ` Next payout ${nextPayoutLabel}.` : "")
      }
    >
      {/* Top-right concentric circles — pure decoration */}
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

      <Text style={styles.eyebrow}>Available balance</Text>

      <CountUpNumber
        value={available}
        format={(n) => fmtNaira(Math.round(n))}
        style={styles.amount}
        numberOfLines={1}
        accessibilityLabel={`Available balance ${fmtNaira(available)}`}
      />

      <Text style={styles.subLine} numberOfLines={1}>
        {subLine}
      </Text>

      <View style={styles.actionRow}>
        <Pressable
          onPress={onWithdrawPress}
          accessibilityRole="button"
          accessibilityLabel="Withdraw"
          hitSlop={4}
          style={({ pressed }) => [
            styles.withdrawBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons
            name="paper-plane"
            size={14}
            color={theme.palette.green700}
          />
          <Text style={styles.withdrawText}>Withdraw</Text>
        </Pressable>
        <Pressable
          onPress={onSchedulePress}
          accessibilityRole="button"
          accessibilityLabel="Schedule payouts"
          hitSlop={4}
          style={({ pressed }) => [
            styles.scheduleBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons name="refresh" size={14} color="#fff" />
          <Text style={styles.scheduleText}>Schedule</Text>
        </Pressable>
      </View>

      <View style={styles.divider} />

      <View style={styles.tileRow}>
        <Tile label="In escrow" value={fmtNairaFull(escrow)} />
        <Tile label="Pending settle" value={fmtNairaFull(pendingSettle)} />
        <Tile label="Next payout" value={nextPayoutLabel ?? "—"} />
      </View>
    </LinearGradient>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={tileStyles.tile}>
      <Text style={tileStyles.label} numberOfLines={1}>
        {label}
      </Text>
      <Text style={tileStyles.value} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const makeStyles = (_theme: Theme) =>
  StyleSheet.create({
    card: {
      borderRadius: 20,
      padding: 20,
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
    actionRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 18,
    },
    withdrawBtn: {
      flex: 1,
      height: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: "#fff",
      borderRadius: 12,
    },
    withdrawText: {
      fontSize: 13,
      fontWeight: "800",
      // Hard-coded green so the contrast holds whether the surrounding
      // theme is light or dark — the gradient is always dark green.
      color: "#115634", // green-700
    },
    scheduleBtn: {
      flex: 1,
      height: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: "rgba(255,255,255,0.14)",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.25)",
    },
    scheduleText: {
      fontSize: 13,
      fontWeight: "800",
      color: "#fff",
    },
    divider: {
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: "rgba(255,255,255,0.14)",
    },
    tileRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
  });

const tileStyles = StyleSheet.create({
  tile: {
    minWidth: 0,
    flexShrink: 1,
  },
  label: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  value: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
    marginTop: 2,
  },
});
