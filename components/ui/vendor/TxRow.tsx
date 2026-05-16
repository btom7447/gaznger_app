import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";

/**
 * Transaction row for the vendor Activity list.
 *
 *   [icon disc]  Description           +/− Amount
 *                Type · date           state pill (optional)
 *
 * Tone-tinted icon based on tx kind (earnings → success, withdrawal →
 * primary, refund → info, etc.). Signed amount is color-coded:
 * credit (+) → success, debit (−) → fg.
 */
export interface TxRowProps {
  description: string;
  type: string;
  kind: string;
  /** ISO timestamp. */
  dateIso: string;
  amount: number;
  amountFormatted: string;
  signed: "credit" | "debit";
  state?: "pending" | "available";
  onPress?: () => void;
  /**
   * When the row sits in a stacked list (Activity card), set true on
   * the last row so the bottom divider line is suppressed.
   */
  last?: boolean;
}

function iconForKind(kind: string): {
  name: keyof typeof Ionicons.glyphMap;
  tone: "success" | "primary" | "warning" | "error" | "info" | "neutral";
} {
  switch (kind) {
    case "vendor_earning_credit":
      return { name: "cash", tone: "success" };
    case "topup_credit":
      return { name: "add-circle", tone: "info" };
    case "refund_credit":
      return { name: "return-down-back", tone: "info" };
    case "withdraw_debit":
      return { name: "arrow-up-circle", tone: "primary" };
    case "withdraw_fee_debit":
      return { name: "remove-circle", tone: "warning" };
    case "withdraw_reversal_credit":
      return { name: "refresh-circle", tone: "info" };
    case "escrow_release_debit":
      return { name: "cube", tone: "primary" };
    case "order_charge_credit":
      return { name: "card", tone: "success" };
    case "platform_commission_credit":
      return { name: "trophy", tone: "primary" };
    case "admin_adjust":
      return { name: "settings", tone: "neutral" };
    default:
      return { name: "swap-horizontal", tone: "neutral" };
  }
}

function tonePalette(theme: Theme, tone: ReturnType<typeof iconForKind>["tone"]) {
  switch (tone) {
    case "success":
      return { bg: theme.successTint, fg: theme.success };
    case "primary":
      return { bg: theme.primaryTint, fg: theme.primary };
    case "warning":
      return { bg: theme.warningTint, fg: theme.warning };
    case "error":
      return { bg: theme.errorTint, fg: theme.error };
    case "info":
      return { bg: theme.infoTint, fg: theme.info };
    case "neutral":
    default:
      return { bg: theme.bgMuted, fg: theme.fgMuted };
  }
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    const today = new Date();
    const isToday =
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();
    const time = d.toLocaleTimeString("en-NG", {
      hour: "numeric",
      minute: "2-digit",
    });
    if (isToday) return `Today · ${time}`;
    return d.toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return "";
  }
}

export default function TxRow({
  description,
  type,
  kind,
  dateIso,
  amount,
  amountFormatted,
  signed,
  state,
  onPress,
  last,
}: TxRowProps) {
  const theme = useTheme();
  const iconCfg = iconForKind(kind);
  const palette = tonePalette(theme, iconCfg.tone);
  const styles = useMemo(
    () => makeStyles(theme, palette),
    [theme, palette],
  );

  const a11y = `${type}: ${description}, ${amountFormatted}, ${fmtDate(dateIso)}`;

  const body = (
    <>
      <View style={styles.iconWrap}>
        <Ionicons name={iconCfg.name} size={18} color={palette.fg} />
      </View>
      <View style={styles.text}>
        <Text style={styles.description} numberOfLines={1}>
          {description}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {type} · {fmtDate(dateIso)}
          {state === "pending" ? "  ·  Pending" : ""}
        </Text>
      </View>
      <Text
        style={[
          styles.amount,
          {
            color: signed === "credit" ? theme.success : theme.fg,
          },
        ]}
        numberOfLines={1}
      >
        {amountFormatted}
      </Text>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        style={({ pressed }) => [
          styles.row,
          last ? null : styles.rowDivided,
          pressed && { opacity: 0.92 },
        ]}
      >
        {body}
      </Pressable>
    );
  }
  return (
    <View
      style={[styles.row, last ? null : styles.rowDivided]}
      accessible
      accessibilityLabel={a11y}
    >
      {body}
    </View>
  );
}

const makeStyles = (theme: Theme, palette: { bg: string; fg: string }) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      backgroundColor: "transparent",
    },
    rowDivided: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.divider,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: palette.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    text: { flex: 1, gap: 2 },
    description: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
    },
    meta: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    amount: {
      ...theme.type.body,
      fontWeight: "800",
    },
  });
