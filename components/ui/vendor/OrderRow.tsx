import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";
import VendorPill, { PillTone } from "./VendorPill";

/**
 * Order row — vendor's view of a customer order in the queue.
 *
 * Density: comfortable (14 vertical padding, 12 gap between rows).
 * Tone copy: terse — fuel qty, customer first name, ETA, status pill.
 *
 * Three layout zones:
 *   left   — small fuel-tone disc with the fuel icon
 *   middle — customer (1st line) + product + qty + addr line (2nd line)
 *   right  — price + ETA + status pill, right-aligned
 *
 * Calling pattern: <OrderRow {...api fields} onPress={...}/>.
 * Real API may return more fields; this component reads only what it
 * needs and ignores the rest.
 */
export type OrderStatus =
  | "new"
  | "confirmed"
  | "assigned"
  | "in-transit"
  | "awaiting_confirmation"
  | "delivered"
  | "cancelled";

const STATUS_LABEL: Record<OrderStatus, string> = {
  new: "New",
  confirmed: "Confirmed",
  assigned: "Assigned",
  "in-transit": "In-flight",
  awaiting_confirmation: "At gate",
  delivered: "Done",
  cancelled: "Cancelled",
};

const STATUS_TONE: Record<OrderStatus, PillTone> = {
  new: "warning",
  confirmed: "info",
  assigned: "info",
  "in-transit": "primary",
  awaiting_confirmation: "primary",
  delivered: "success",
  cancelled: "neutral",
};

export interface OrderRowProps {
  customer: string;
  fuel: string;
  /** Quantity with unit baked in (e.g. "30 L", "12.5 kg"). */
  qty: string;
  /** Display total — pre-formatted (e.g. "₦24,000"). */
  price: string;
  status: OrderStatus;
  /** ETA in minutes; pass null when not known. */
  etaMin?: number | null;
  /** Address line 1 (street + area, terse). */
  addr?: string;
  onPress?: () => void;
}

function formatEta(etaMin: number | null | undefined): string | null {
  if (etaMin == null) return null;
  if (etaMin <= 0) return "Now";
  if (etaMin < 60) return `${etaMin} min`;
  const h = Math.floor(etaMin / 60);
  const m = etaMin % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export default function OrderRow({
  customer,
  fuel,
  qty,
  price,
  status,
  etaMin,
  addr,
  onPress,
}: OrderRowProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const eta = formatEta(etaMin);

  const body = (
    <>
      <View style={styles.iconWrap}>
        <Ionicons name="flame" size={18} color={theme.primary} />
      </View>
      <View style={styles.text}>
        <Text style={styles.customer} numberOfLines={1}>
          {customer}
        </Text>
        <Text style={styles.line2} numberOfLines={1}>
          {qty} {fuel}
          {addr ? ` · ${addr}` : ""}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.price} numberOfLines={1}>
          {price}
        </Text>
        <View style={styles.metaRow}>
          {eta ? <Text style={styles.eta}>{eta}</Text> : null}
          <VendorPill
            tone={STATUS_TONE[status]}
            size="sm"
            accessibilityHidden
          >
            {STATUS_LABEL[status]}
          </VendorPill>
        </View>
      </View>
    </>
  );

  const a11y =
    `${customer}, ${qty} ${fuel}, ${price}, status ${STATUS_LABEL[status]}` +
    (eta ? `, ETA ${eta}` : "");

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        style={({ pressed }) => [styles.wrap, pressed && { opacity: 0.92 }]}
      >
        {body}
      </Pressable>
    );
  }

  return (
    <View style={styles.wrap} accessible accessibilityLabel={a11y}>
      {body}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.primaryTint,
      alignItems: "center",
      justifyContent: "center",
    },
    text: { flex: 1, gap: 2 },
    customer: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
    },
    line2: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    right: {
      alignItems: "flex-end",
      gap: 4,
    },
    price: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "800",
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    eta: {
      ...theme.type.caption,
      color: theme.fgMuted,
      fontWeight: "600",
    },
  });
