import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Theme, useTheme } from "@/constants/theme";

/**
 * Minimal vertical bar chart for the vendor Earnings screen.
 *
 * Pure RN — no charting lib (would balloon the bundle for a single
 * use). Bars are flex children sized as a percentage of the max
 * value; an empty-state line surfaces if every bucket is zero.
 */

export interface BarChartBucket {
  label: string;
  value: number;
}

export interface BarChartProps {
  buckets: BarChartBucket[];
  /** Optional minimum height in points (default 120). */
  height?: number;
}

function fmtCompactNaira(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

export default function BarChart({ buckets, height = 140 }: BarChartProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const max = useMemo(
    () => Math.max(...buckets.map((b) => b.value), 1),
    [buckets],
  );
  const allZero = buckets.every((b) => b.value <= 0);

  if (allZero) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>No earnings in this period.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={[styles.bars, { height }]}>
        {buckets.map((b, i) => {
          const pct = max === 0 ? 0 : (b.value / max) * 100;
          return (
            <View key={i} style={styles.col}>
              {b.value > 0 ? (
                <Text style={styles.value} numberOfLines={1}>
                  {fmtCompactNaira(b.value)}
                </Text>
              ) : (
                <View style={{ height: 14 }} />
              )}
              <View style={styles.track}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: `${Math.max(3, pct)}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.label} numberOfLines={1}>
                {b.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: { gap: 4 },
    bars: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 10,
    },
    col: {
      flex: 1,
      alignItems: "center",
      gap: 4,
    },
    value: {
      fontSize: 10,
      fontWeight: "700",
      color: theme.fgMuted,
    },
    track: {
      width: "70%",
      flex: 1,
      backgroundColor: theme.bgMuted,
      borderRadius: theme.radius.sm,
      overflow: "hidden",
      justifyContent: "flex-end",
    },
    bar: {
      width: "100%",
      backgroundColor: theme.primary,
      borderRadius: theme.radius.sm,
    },
    label: {
      fontSize: 11,
      color: theme.fgMuted,
      fontWeight: "700",
    },
    empty: {
      alignItems: "center",
      justifyContent: "center",
    },
    emptyText: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
  });
