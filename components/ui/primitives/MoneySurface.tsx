import React, { useMemo } from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { Theme, useTheme, formatCurrency } from "@/constants/theme";

interface LineItem {
  label: string;
  amount: number;
}

interface MoneySurfaceProps {
  /** Lines above the total. */
  lineItems?: LineItem[];
  /** Optional eyebrow above the line items (e.g., "ORDER"). */
  eyebrow?: string;
  /** Bottom-emphasized total label. */
  totalLabel: string;
  totalValue: number;
  /** Sub line under the total (e.g., "Pay once · receipt to ada@…"). */
  sub?: string;
  /** Visual accent — primary (CTA-paired) or neutral (info-only). */
  emphasis?: "primary" | "neutral";
  style?: ViewStyle;
}

/**
 * Brand-green totals card for Payment + Receipt screens.
 * Ledger-style line items + emphasized total. tabular-nums everywhere.
 */
export default function MoneySurface({
  lineItems = [],
  eyebrow,
  totalLabel,
  totalValue,
  sub,
  emphasis = "primary",
  style,
}: MoneySurfaceProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme, emphasis), [theme, emphasis]);

  return (
    <View style={[styles.surface, style]}>
      {eyebrow ? (
        <Text style={styles.eyebrow}>{eyebrow}</Text>
      ) : null}

      {lineItems.length > 0 ? (
        <View style={styles.lineItems}>
          {lineItems.map((item, i) => (
            <View key={`${item.label}-${i}`} style={styles.lineItem}>
              <Text style={styles.lineLabel} numberOfLines={1}>
                {item.label}
              </Text>
              <Text style={styles.lineValue} numberOfLines={1}>
                {formatCurrency(item.amount)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {lineItems.length > 0 ? <View style={styles.divider} /> : null}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>{totalLabel}</Text>
        <Text style={styles.totalValue}>{formatCurrency(totalValue)}</Text>
      </View>

      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

const makeStyles = (
  theme: Theme,
  emphasis: "primary" | "neutral"
) => {
  const isPrimary = emphasis === "primary";
  const bg = isPrimary ? theme.primary : theme.surface;
  const fg = isPrimary ? theme.fgOnPrimary : theme.fg;
  const fgMuted = isPrimary ? "rgba(255,255,255,0.82)" : theme.fgMuted;
  const fgVeryMuted = isPrimary ? "rgba(255,255,255,0.7)" : theme.fgSubtle;
  const dividerColor = isPrimary
    ? "rgba(255,255,255,0.18)"
    : theme.divider;

  return StyleSheet.create({
    surface: {
      backgroundColor: bg,
      borderRadius: theme.radius.lg,
      padding: theme.space.s4,
      ...(isPrimary ? theme.elevation.card : {}),
      ...(isPrimary
        ? {}
        : { borderWidth: 1, borderColor: theme.border }),
    },
    eyebrow: {
      ...theme.type.micro,
      color: fgVeryMuted,
      marginBottom: theme.space.s2,
    },
    lineItems: { gap: theme.space.s1 + 2 },
    lineItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: theme.space.s2,
    },
    lineLabel: {
      ...theme.type.bodySm,
      color: fgMuted,
      flex: 1,
    },
    lineValue: {
      ...theme.type.bodySm,
      ...theme.type.money,
      color: fg,
      fontWeight: "700",
    },
    divider: {
      height: 1,
      backgroundColor: dividerColor,
      marginVertical: theme.space.s3,
    },
    totalRow: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: theme.space.s2,
    },
    totalLabel: {
      ...theme.type.bodyLg,
      color: fg,
      fontWeight: "700",
    },
    totalValue: {
      ...theme.type.h1,
      ...theme.type.money,
      color: fg,
      fontWeight: "800",
    },
    sub: {
      ...theme.type.caption,
      color: fgVeryMuted,
      marginTop: theme.space.s2,
    },
  });
};
