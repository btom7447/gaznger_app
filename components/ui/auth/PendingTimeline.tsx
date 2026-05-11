import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Theme, useTheme } from "@/constants/theme";

export type PendingTone = "success" | "warning" | "neutral";

export interface PendingRow {
  label: string;
  /** Display string ("Done" / "In progress" / "Pending"). */
  status: string;
  tone: PendingTone;
}

interface Props {
  rows: PendingRow[];
}

/**
 * 4-row status table for the verification pending lobby. Each row is
 * a label on the left + colored dot + status text on the right.
 * Hairline dividers above and below the block, no internal lines.
 */
export default function PendingTimeline({ rows }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const dotColor: Record<PendingTone, string> = {
    success: theme.success,
    warning: theme.warning,
    neutral: theme.mode === "dark" ? theme.palette.neutral600 : theme.palette.neutral400,
  };

  return (
    <View style={styles.wrap}>
      {rows.map((r) => (
        <View key={r.label} style={styles.row}>
          <Text style={styles.label}>{r.label}</Text>
          <View style={styles.statusGroup}>
            <View style={[styles.dot, { backgroundColor: dotColor[r.tone] }]} />
            <Text style={styles.status}>{r.status}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: {
      paddingVertical: theme.space.s3 + 2,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: theme.divider,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.space.s2,
    },
    label: {
      ...theme.type.bodySm,
      color: theme.fg,
      fontWeight: "700",
    },
    statusGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    status: {
      ...theme.type.caption,
      color: theme.fgMuted,
    },
  });
