import React, { useMemo, useState, useEffect } from "react";
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
  /**
   * v3 design: render a collapsed primary state ("Redeem points?") that
   * expands on tap to reveal the preset row. Defaults to false to
   * preserve the existing always-expanded behaviour for any caller that
   * doesn't opt in. (Backward-compatible — no consumer break.)
   */
  collapsible?: boolean;
  /**
   * Initial collapsed state when `collapsible=true`. Default true when
   * pointsToSpend === 0 (collapsed), false when > 0 (expanded so the
   * user sees their selection). Caller can force a value either way.
   */
  defaultCollapsed?: boolean;
}

/**
 * Quick-pick redemption with two visual modes:
 *
 *   - LEGACY (collapsible=false, default): always-expanded card with
 *     header + preset chip row.
 *   - v3 COLLAPSED (collapsible=true + collapsed): a single tappable
 *     header row with a "Redeem points?" affordance + chevron. Tapping
 *     expands into the preset row. Auto-expands when pointsToSpend > 0
 *     so a redemption is never hidden behind a tap.
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
  collapsible = false,
  defaultCollapsed,
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

  // Collapsed state — only meaningful when collapsible=true.
  const [collapsed, setCollapsed] = useState<boolean>(
    defaultCollapsed ?? pointsToSpend === 0
  );

  // Auto-expand whenever a redemption is active so the user can always
  // see + change their selection. Auto-collapse on Clear (back to 0).
  useEffect(() => {
    if (!collapsible) return;
    if (pointsToSpend > 0 && collapsed) setCollapsed(false);
  }, [pointsToSpend, collapsible, collapsed]);

  const handlePreset = (n: number) => {
    onChange(n === pointsToSpend ? 0 : n);
  };

  // ── Collapsed render (v3 only) ──
  if (collapsible && collapsed && balance > 0 && maxRedeemable > 0) {
    return (
      <Pressable
        onPress={() => setCollapsed(false)}
        accessibilityRole="button"
        accessibilityLabel="Redeem Gaznger Points"
        accessibilityHint="Expands the redemption options."
        style={({ pressed }) => [
          styles.card,
          styles.collapsedCard,
          pressed && { opacity: 0.92 },
        ]}
      >
        <View style={styles.headerLeft}>
          <View style={styles.coin}>
            <Ionicons name="star" size={13} color={theme.palette.neutral900} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.title}>Redeem points?</Text>
            <Text style={styles.sub}>
              {balance.toLocaleString("en-NG")} available · up to{" "}
              {formatCurrency(maxRedeemable * POINTS_TO_NAIRA)} off
            </Text>
          </View>
        </View>
        <Ionicons
          name="chevron-down"
          size={18}
          color={theme.fgMuted}
        />
      </Pressable>
    );
  }

  // ── Expanded render (legacy + v3 expanded) ──
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
            onPress={() => {
              onChange(0);
              if (collapsible) setCollapsed(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Don't redeem points"
            hitSlop={8}
          >
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        ) : collapsible ? (
          <Pressable
            onPress={() => setCollapsed(true)}
            accessibilityRole="button"
            accessibilityLabel="Hide redemption options"
            hitSlop={8}
          >
            <Ionicons name="chevron-up" size={18} color={theme.fgMuted} />
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
    collapsedCard: {
      // Single-row variant: row layout, no inner gap.
      flexDirection: "row",
      alignItems: "center",
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
