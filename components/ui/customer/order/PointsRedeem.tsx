import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme, formatCurrency } from "@/constants/theme";

/**
 * Points → naira conversion: 1 point = ₦1 (server contract — see
 * server/src/routes/points.ts → POST /api/points/redeem). Customizable
 * server-side; mirror the rate here when it changes.
 */
export const POINTS_TO_NAIRA = 1;

interface PointsRedeemProps {
  /** Total naira before discount (subtotal + fees). */
  total: number;
  /** Available points balance for the user. */
  balance: number;
  /** Currently chosen points to spend (0 = no redemption). */
  pointsToSpend: number;
  onChange: (points: number) => void;
}

/**
 * Quick-pick redemption bar with a few preset amounts (capped to balance
 * and to total). Tapping a preset toggles between "redeem N" and "off".
 *
 * The user's balance and the order total both bound the maximum: you can
 * never spend more points than you own, and you can never reduce the
 * order below ₦0.
 */
export default function PointsRedeem({
  total,
  balance,
  pointsToSpend,
  onChange,
}: PointsRedeemProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const maxRedeemable = Math.max(0, Math.min(balance, total / POINTS_TO_NAIRA));
  const presets = useMemo(() => {
    if (maxRedeemable <= 0) return [];
    // Round-number presets that fit under the cap.
    const candidates = [100, 250, 500, 1000, 2500];
    const fits = candidates.filter((c) => c <= maxRedeemable);
    // Always include the "All" cap as the final option.
    if (maxRedeemable > 0 && !fits.includes(maxRedeemable)) {
      fits.push(maxRedeemable);
    }
    return fits;
  }, [maxRedeemable]);

  const handlePreset = (n: number) => {
    onChange(n === pointsToSpend ? 0 : n);
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.coin}>
            <Ionicons name="star" size={13} color={theme.palette.neutral900} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.title}>Use Gaznger Points</Text>
            <Text style={styles.sub}>
              {balance.toLocaleString("en-NG")} points · 1 point = {formatCurrency(POINTS_TO_NAIRA)}
            </Text>
          </View>
        </View>
        {pointsToSpend > 0 ? (
          <Pressable
            onPress={() => onChange(0)}
            accessibilityRole="button"
            accessibilityLabel="Don't redeem points"
            hitSlop={8}
          >
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {balance === 0 ? (
        <Text style={styles.empty}>
          Earn points on every order — they'll appear here for your next checkout.
        </Text>
      ) : maxRedeemable === 0 ? (
        <Text style={styles.empty}>Order total is too low to redeem points.</Text>
      ) : (
        <View style={styles.presetRow}>
          {presets.map((p) => {
            const isSel = p === pointsToSpend;
            return (
              <Pressable
                key={p}
                onPress={() => handlePreset(p)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSel }}
                accessibilityLabel={`Redeem ${p} points (${formatCurrency(p * POINTS_TO_NAIRA)} off)`}
                style={({ pressed }) => [
                  styles.preset,
                  isSel && styles.presetSelected,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text
                  style={[
                    styles.presetText,
                    { color: isSel ? "#fff" : theme.fg },
                  ]}
                >
                  {p === maxRedeemable && p !== 100 && p !== 250 && p !== 500 && p !== 1000 && p !== 2500
                    ? `All ${p.toLocaleString("en-NG")}`
                    : p.toLocaleString("en-NG")}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.accentTint,
      borderRadius: theme.radius.lg,
      padding: theme.space.s3 + 2,
      gap: theme.space.s3,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s3,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s3,
      flex: 1,
    },
    coin: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "800",
    },
    sub: {
      ...theme.type.caption,
      color: theme.fgMuted,
    },
    clear: {
      ...theme.type.caption,
      color: theme.primary,
      fontWeight: "800",
    },
    empty: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    presetRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.space.s2,
    },
    preset: {
      paddingHorizontal: theme.space.s3,
      paddingVertical: theme.space.s2 + 2,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      minWidth: 70,
      alignItems: "center",
    },
    presetSelected: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    presetText: {
      ...theme.type.caption,
      ...theme.type.money,
      fontWeight: "800",
    },
  });
