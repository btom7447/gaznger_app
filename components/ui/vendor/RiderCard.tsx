import React, { useMemo, useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { toast } from "sonner-native";
import { Theme, useTheme } from "@/constants/theme";
import VendorPill, { PillTone } from "./VendorPill";

/**
 * Rider card — list + copy variant.
 *
 * v6 hard rule for "rider assignment behavior": list + copy. The card
 * is the row inside the assign-rider list:
 *   - Left: round avatar (initial fallback)
 *   - Body:
 *       line 1: name + plate
 *       line 2: rating · trips · distance
 *   - Right: status pill + tap-to-copy phone icon
 *
 * Tap on the row body invokes `onSelect(riderId)`. Tap on the copy
 * icon (separate hit area) copies the phone to the clipboard and
 * surfaces a toast — useful for vendors who want to send a manual
 * SMS in parallel with the assign.
 */
export type RiderStatus = "active" | "idle" | "offline";

const STATUS_TONE: Record<RiderStatus, PillTone> = {
  active: "primary",
  idle: "success",
  offline: "neutral",
};

const STATUS_LABEL: Record<RiderStatus, string> = {
  active: "On order",
  idle: "Idle",
  offline: "Offline",
};

export interface RiderCardProps {
  id: string;
  name: string;
  /** Vehicle plate, terse (e.g. "EKY-218-XL"). */
  plate?: string;
  /** Float 0–5 (e.g. 4.8). */
  rating?: number;
  /** Lifetime trip count. */
  trips?: number;
  /** Distance to customer in km, rounded to 1 decimal. */
  distanceKm?: number;
  status: RiderStatus;
  /** E.164 phone — required for the copy action. */
  phone?: string;
  /** Trigger the assign action. */
  onSelect: (id: string) => void;
}

function initial(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  return first.charAt(0).toUpperCase() || "?";
}

export default function RiderCard({
  id,
  name,
  plate,
  rating,
  trips,
  distanceKm,
  status,
  phone,
  onSelect,
}: RiderCardProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const copyPhone = useCallback(async () => {
    if (!phone) return;
    try {
      await Clipboard.setStringAsync(phone);
      toast.success("Phone copied", { description: phone });
    } catch {
      toast.error("Couldn't copy phone");
    }
  }, [phone]);

  const meta = [
    typeof rating === "number" ? `★ ${rating.toFixed(1)}` : null,
    typeof trips === "number" ? `${trips} trips` : null,
    typeof distanceKm === "number" ? `${distanceKm.toFixed(1)} km` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  const a11y =
    `${name}${plate ? `, plate ${plate}` : ""}, ${STATUS_LABEL[status]}` +
    (meta ? `, ${meta}` : "");

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => onSelect(id)}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        accessibilityHint="Tap to assign this rider"
        style={({ pressed }) => [
          styles.row,
          pressed && { opacity: 0.92 },
        ]}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial(name)}</Text>
        </View>
        <View style={styles.text}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            {plate ? (
              <Text style={styles.plate} numberOfLines={1}>
                {plate}
              </Text>
            ) : null}
          </View>
          {meta ? (
            <Text style={styles.meta} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
        <VendorPill tone={STATUS_TONE[status]} size="sm" dot accessibilityHidden>
          {STATUS_LABEL[status]}
        </VendorPill>
      </Pressable>

      {phone ? (
        <Pressable
          onPress={copyPhone}
          accessibilityRole="button"
          accessibilityLabel={`Copy phone number ${phone}`}
          hitSlop={8}
          style={({ pressed }) => [
            styles.copyBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons name="copy-outline" size={16} color={theme.fgMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: {
      flexDirection: "row",
      alignItems: "stretch",
      backgroundColor: theme.surface,
      borderRadius: theme.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      flex: 1,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.primaryTint,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      ...theme.type.h2,
      color: theme.primary,
      fontWeight: "800",
    },
    text: { flex: 1, gap: 4 },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    name: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
      flexShrink: 1,
    },
    plate: {
      ...theme.type.caption,
      color: theme.fgMuted,
      fontWeight: "700",
      letterSpacing: 0.4,
    },
    meta: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    copyBtn: {
      width: 40,
      alignItems: "center",
      justifyContent: "center",
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: theme.border,
    },
  });
