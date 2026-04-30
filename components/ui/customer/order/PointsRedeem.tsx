import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  // Tracks whether the user explicitly tapped the chevron to close the
  // accordion. Once true, we skip the "auto-expand when redemption is
  // active" effect — otherwise tapping close re-renders, the effect
  // sees `pointsToSpend > 0 && collapsed` and immediately re-opens it,
  // making the close button look broken.
  const userClosedRef = useRef(false);

  /**
   * Wraps `setCollapsed` so closing the accordion always sets the
   * "user explicitly closed" sentinel. Reopening (programmatically or
   * via header tap) clears it so subsequent close-then-pick cycles
   * still auto-expand on the second opening.
   */
  const setCollapsedSafely = useCallback((next: boolean) => {
    if (next) userClosedRef.current = true;
    else userClosedRef.current = false;
    setCollapsed(next);
  }, []);

  // Auto-expand whenever a redemption is active AND the user hasn't
  // explicitly collapsed since the last activation. Auto-collapse on
  // Clear (back to 0) — that's a programmatic close that doesn't trip
  // the user-closed sentinel because the effect path drives it.
  useEffect(() => {
    if (!collapsible) return;
    if (
      pointsToSpend > 0 &&
      collapsed &&
      !userClosedRef.current
    ) {
      setCollapsed(false);
    }
    if (pointsToSpend === 0) {
      // Clean slate on Clear — next time the user picks an amount,
      // auto-expand may fire again.
      userClosedRef.current = false;
    }
  }, [pointsToSpend, collapsible, collapsed]);

  const handlePreset = (n: number) => {
    onChange(n === pointsToSpend ? 0 : n);
  };

  // Header — same shape across collapsed + expanded. Per v3 design:
  //   gold-tinted icon tile (36×36) with filled star
  //   "You have X points" / "≈ ₦X to spend on this order"
  //   chevron right when collapsed, chevron down when expanded.
  const Header = (
    <View style={styles.headerRow}>
      <View style={styles.coin}>
        <Ionicons
          name="star"
          size={16}
          color={
            theme.mode === "dark"
              ? theme.palette.gold300
              : theme.palette.gold700
          }
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.title}>
          {balance === 0
            ? "No points yet"
            : `You have ${balance.toLocaleString("en-NG")} points`}
        </Text>
        <Text style={styles.sub}>
          {balance === 0
            ? "Earn 50 on your first order."
            : maxRedeemable > 0
            ? `≈ ${formatCurrency(maxRedeemable * POINTS_TO_NAIRA)} to spend on this order`
            : "Order total is too low to redeem points"}
        </Text>
      </View>
      {collapsible ? (
        <Ionicons
          name={collapsed ? "chevron-forward" : "chevron-down"}
          size={16}
          color={
            theme.mode === "dark"
              ? theme.palette.gold300
              : theme.palette.gold700
          }
        />
      ) : null}
    </View>
  );

  // ── Collapsed render (v3) ──
  if (collapsible && collapsed && balance > 0 && maxRedeemable > 0) {
    return (
      <Pressable
        onPress={() => setCollapsedSafely(false)}
        accessibilityRole="button"
        accessibilityLabel={`Redeem points. You have ${balance} points, up to ${formatCurrency(maxRedeemable * POINTS_TO_NAIRA)} off this order.`}
        accessibilityHint="Expands the redemption options."
        style={({ pressed }) => [
          styles.card,
          pressed && { opacity: 0.92 },
        ]}
      >
        {Header}
      </Pressable>
    );
  }

  // ── Expanded render ──
  return (
    <Pressable
      onPress={collapsible ? () => setCollapsedSafely(true) : undefined}
      style={styles.card}
      // Cards aren't "buttons" when expanded — only the header chevron
      // closes it. The Pressable wrapper carries the press handler so
      // the whole card surface is tappable when collapsible.
      disabled={!collapsible}
    >
      {Header}

      {balance > 0 && maxRedeemable > 0 ? (
        <>
          <View style={styles.divider} />
          <View style={styles.applyRow}>
            <Text style={styles.applyLabel}>APPLY</Text>
            {pointsToSpend > 0 ? (
              <Pressable
                onPress={() => onChange(0)}
                accessibilityRole="button"
                accessibilityLabel="Clear redemption"
                hitSlop={8}
              >
                <Text style={styles.clear}>Clear</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.presetGrid}>
            {presets.map((p) => {
              const isSel = p === pointsToSpend;
              const isMax = p === maxRedeemable;
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
                      isSel && styles.presetTextSelected,
                    ]}
                  >
                    {isMax ? "Max" : p.toLocaleString("en-NG")}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.footnote}>
            Points apply after payment confirms.
          </Text>
        </>
      ) : null}
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    /**
     * Gold-tinted card. Light mode = gold50 (#FEF7D6), dark mode =
     * a translucent gold so the points always read as their own
     * thing rather than blending into the green primary surfaces.
     */
    card: {
      backgroundColor:
        theme.mode === "dark"
          ? "rgba(245,197,24,0.06)"
          : theme.palette.gold50,
      borderWidth: 1,
      borderColor:
        theme.mode === "dark"
          ? "rgba(245,197,24,0.18)"
          : theme.palette.gold100,
      borderRadius: 14,
      padding: 14,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    coin: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor:
        theme.mode === "dark"
          ? "rgba(245,197,24,0.18)"
          : theme.palette.gold100,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      fontSize: 13.5,
      fontWeight: "800",
      color:
        theme.mode === "dark"
          ? theme.palette.gold300
          : theme.palette.gold700,
    },
    sub: {
      fontSize: 11.5,
      color: theme.fgMuted,
      marginTop: 2,
    },
    divider: {
      height: 1,
      backgroundColor:
        theme.mode === "dark"
          ? "rgba(245,197,24,0.18)"
          : theme.palette.gold100,
      marginVertical: 14,
    },
    applyRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: 10,
    },
    applyLabel: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.fgMuted,
      letterSpacing: 0.5,
    },
    clear: {
      fontSize: 11.5,
      fontWeight: "700",
      color:
        theme.mode === "dark"
          ? theme.palette.gold300
          : theme.palette.gold700,
    },
    presetGrid: {
      flexDirection: "row",
      gap: 6,
    },
    preset: {
      flex: 1,
      height: 38,
      borderRadius: 10,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor:
        theme.mode === "dark"
          ? "rgba(245,197,24,0.30)"
          : theme.palette.gold300,
      backgroundColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
    },
    presetSelected: {
      backgroundColor:
        theme.mode === "dark" ? theme.palette.gold300 : theme.palette.gold700,
      borderStyle: "solid",
      borderColor:
        theme.mode === "dark" ? theme.palette.gold300 : theme.palette.gold700,
    },
    presetText: {
      fontSize: 12.5,
      fontWeight: "800",
      color:
        theme.mode === "dark"
          ? theme.palette.gold300
          : theme.palette.gold700,
      ...theme.type.money,
    },
    presetTextSelected: {
      color:
        theme.mode === "dark" ? theme.palette.neutral900 : "#fff",
    },
    footnote: {
      fontSize: 10.5,
      color: theme.fgMuted,
      marginTop: 10,
      lineHeight: 14,
    },
  });
