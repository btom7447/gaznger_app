import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";
import VendorPill, { PillTone } from "./VendorPill";

/**
 * Card surface for a single in-flight (or historical) bulk purchase
 * on the Supplies screen.
 *
 * Composition:
 *   plant name + status pill
 *   product + qty + step counter (e.g. "7 / 11")
 *   horizontal progress bar
 *   total cost + truck plate (optional)
 *
 * Comfortable density (14 vertical padding). Whole card is tappable
 * to open the tracker detail.
 */
export interface BulkInFlightCardProps {
  plantName: string;
  product: string;
  qty: string;
  totalCostFormatted: string;
  stepLabel?: string | null;
  progressPct: number; // 0..100
  status:
    | "pending"
    | "confirmed"
    | "in-transit"
    | "delivered"
    | "cancelled";
  truckPlate?: string | null;
  onPress?: () => void;
}

const STATUS_TONE: Record<BulkInFlightCardProps["status"], PillTone> = {
  pending: "warning",
  confirmed: "info",
  "in-transit": "primary",
  delivered: "success",
  cancelled: "neutral",
};

const STATUS_LABEL: Record<BulkInFlightCardProps["status"], string> = {
  pending: "Requested",
  confirmed: "Confirmed",
  "in-transit": "In transit",
  delivered: "Done",
  cancelled: "Cancelled",
};

export default function BulkInFlightCard({
  plantName,
  product,
  qty,
  totalCostFormatted,
  stepLabel,
  progressPct,
  status,
  truckPlate,
  onPress,
}: BulkInFlightCardProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const a11y =
    `${plantName}, ${qty} ${product}, ${STATUS_LABEL[status]}` +
    (stepLabel ? `, step ${stepLabel}` : "") +
    `, total ${totalCostFormatted}`;

  const body = (
    <>
      <View style={styles.headerRow}>
        <View style={styles.plantWrap}>
          <View style={styles.plantIcon}>
            <Ionicons name="business" size={14} color={theme.primary} />
          </View>
          <Text style={styles.plantName} numberOfLines={1}>
            {plantName}
          </Text>
        </View>
        <VendorPill tone={STATUS_TONE[status]} size="sm" accessibilityHidden>
          {STATUS_LABEL[status]}
        </VendorPill>
      </View>

      <View style={styles.specRow}>
        <Text style={styles.spec} numberOfLines={1}>
          {qty} {product}
        </Text>
        {stepLabel ? (
          <Text style={styles.stepCounter} numberOfLines={1}>
            {stepLabel}
          </Text>
        ) : null}
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${Math.max(2, Math.min(100, progressPct))}%`,
              backgroundColor:
                status === "cancelled" ? theme.fgSubtle : theme.primary,
            },
          ]}
        />
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.totalLabel} numberOfLines={1}>
          Total
        </Text>
        <View style={styles.footerRight}>
          {truckPlate ? (
            <View style={styles.plate}>
              <Ionicons name="car-outline" size={11} color={theme.fgMuted} />
              <Text style={styles.plateText} numberOfLines={1}>
                {truckPlate}
              </Text>
            </View>
          ) : null}
          <Text style={styles.total} numberOfLines={1}>
            {totalCostFormatted}
          </Text>
        </View>
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
      >
        {body}
      </Pressable>
    );
  }
  return (
    <View style={styles.card} accessible accessibilityLabel={a11y}>
      {body}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      gap: 10,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    plantWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flex: 1,
    },
    plantIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.primaryTint,
      alignItems: "center",
      justifyContent: "center",
    },
    plantName: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
      flexShrink: 1,
    },
    specRow: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
    },
    spec: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    stepCounter: {
      ...theme.type.caption,
      color: theme.primary,
      fontWeight: "800",
      letterSpacing: 0.4,
    },
    progressTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.bgMuted,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: 3,
    },
    footerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    totalLabel: {
      ...theme.type.caption,
      color: theme.fgMuted,
      fontWeight: "600",
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },
    footerRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    plate: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.bgMuted,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: theme.radius.pill,
    },
    plateText: {
      fontSize: 11,
      color: theme.fgMuted,
      fontWeight: "700",
      letterSpacing: 0.3,
    },
    total: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "800",
    },
  });
