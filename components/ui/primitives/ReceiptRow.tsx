import React, { useMemo } from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { Theme, useTheme, formatCurrency } from "@/constants/theme";

interface ReceiptRowProps {
  label: string;
  /** String value or number (auto-formatted as currency). */
  value: string | number;
  /** When value is currency, money-color emphasis. */
  emphasis?: "default" | "positive" | "negative";
  /** Bigger row for the total. */
  isTotal?: boolean;
  /** Override foreground color for the value. */
  valueColor?: string;
  style?: ViewStyle;
}

/**
 * Single receipt-style label/value row. Used in Receipt + Delivered + Payment.
 * Number values auto-format via formatCurrency.
 */
export default function ReceiptRow({
  label,
  value,
  emphasis = "default",
  isTotal = false,
  valueColor,
  style,
}: ReceiptRowProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const display = typeof value === "number" ? formatCurrency(value) : value;

  const resolvedValueColor =
    valueColor ??
    (emphasis === "positive"
      ? theme.moneyPositive
      : emphasis === "negative"
        ? theme.moneyNegative
        : theme.fg);

  return (
    <View style={[styles.row, isTotal && styles.rowTotal, style]}>
      <Text
        style={[styles.label, { color: theme.fgMuted }, isTotal && styles.labelTotal]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.value,
          { color: resolvedValueColor },
          isTotal && styles.valueTotal,
        ]}
        numberOfLines={1}
      >
        {display}
      </Text>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.space.s1 + 2, // 6
      gap: theme.space.s3,
    },
    rowTotal: {
      paddingVertical: theme.space.s2 + 2, // 10
    },
    label: {
      ...theme.type.body,
      flex: 1,
    },
    labelTotal: {
      ...theme.type.bodyLg,
      fontWeight: "800",
      color: theme.fg,
    },
    value: {
      ...theme.type.body,
      fontWeight: "700",
      ...theme.type.money,
    },
    valueTotal: {
      ...theme.type.bodyLg,
      fontWeight: "800",
      ...theme.type.money,
    },
  });
