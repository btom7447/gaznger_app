import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Theme, useTheme } from "@/constants/theme";

export interface CylinderOption {
  /** Whole kg as id; matches the stepper qty exactly. */
  kg: number;
  label: string; // "12kg"
  sub: string; // "standard"
}

export const DEFAULT_SIZES: CylinderOption[] = [
  { kg: 3, label: "3kg", sub: "small" },
  { kg: 6, label: "6kg", sub: "common" },
  { kg: 12, label: "12kg", sub: "standard" },
  { kg: 25, label: "25kg", sub: "commercial" },
  { kg: 50, label: "50kg", sub: "industrial" },
  { kg: 100, label: "100kg", sub: "bulk" },
];

interface CylinderSizeGridProps {
  options?: CylinderOption[];
  /** Currently selected kg (matches the stepper qty). */
  value: number | null;
  onChange: (kg: number) => void;
}

/**
 * 3-column grid of cylinder sizes. Tapping a card selects.
 */
export default function CylinderSizeGrid({
  options = DEFAULT_SIZES,
  value,
  onChange,
}: CylinderSizeGridProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const rows: CylinderOption[][] = [];
  for (let i = 0; i < options.length; i += 3) {
    rows.push(options.slice(i, i + 3));
  }

  return (
    <View style={styles.col}>
      {rows.map((row, ri) => (
        <View key={`row-${ri}`} style={styles.row}>
          {row.map((opt) => {
            const isSel = opt.kg === value;
            return (
              <Pressable
                key={opt.kg}
                onPress={() => onChange(opt.kg)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSel }}
                accessibilityLabel={`${opt.label}. ${opt.sub}.`}
                style={({ pressed }) => [
                  styles.cell,
                  isSel && styles.cellSelected,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                ]}
              >
                <Text
                  style={[
                    styles.label,
                    { color: isSel ? theme.primary : theme.fg },
                  ]}
                  numberOfLines={1}
                >
                  {opt.label}
                </Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {opt.sub}
                </Text>
              </Pressable>
            );
          })}
          {row.length < 3
            ? Array.from({ length: 3 - row.length }).map((_, i) => (
                <View key={`pad-${i}`} style={styles.cellPad} />
              ))
            : null}
        </View>
      ))}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    col: { gap: theme.space.s2 },
    row: { flexDirection: "row", gap: theme.space.s2 },
    cell: {
      flex: 1,
      paddingVertical: theme.space.s3 + 2,
      paddingHorizontal: theme.space.s2,
      borderRadius: theme.radius.md,
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      alignItems: "center",
      gap: 2,
      minHeight: 70,
    },
    cellSelected: {
      backgroundColor: theme.primaryTint,
      borderColor: theme.primary,
      borderWidth: 1.5,
    },
    cellPad: { flex: 1 },
    label: {
      ...theme.type.body,
      ...theme.type.money,
      fontWeight: "800",
    },
    sub: {
      ...theme.type.micro,
      color: theme.fgMuted,
    },
  });
