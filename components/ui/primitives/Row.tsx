import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";
import Switch from "./Switch";

/**
 * Settings / profile / list row primitive.
 *
 * Three trailing affordances driven by `kind`:
 *   - "chevron" (default) — caret-right, makes the whole row tappable.
 *   - "switch"            — pill toggle wired to `value` + `onValueChange`.
 *   - "none"              — no trailing element. For static rows.
 *
 * Sets the icon-tile background using the same recipe the design uses:
 *   accent  → custom tint passed in (used by the Wallet quick-balance row)
 *   danger  → error-50 with error-500 icon (Sign out)
 *   default → bgMuted with fg icon
 */
export type RowKind = "chevron" | "switch" | "none";

interface RowProps {
  /** Ionicon name OR a custom node (e.g. an avatar). */
  icon?: React.ComponentProps<typeof Ionicons>["name"] | React.ReactNode;
  label: string;
  /** Trailing meta text (e.g. "Default" pill text — drives Switch's `value` when kind="switch"). */
  meta?: string;
  /** Sub-label rendered below the main label. */
  sub?: string;
  /** Custom icon-tile background. Overrides the default tile colour. */
  accent?: string;
  onPress?: () => void;
  /** Red label + icon. Used for Sign out. */
  danger?: boolean;
  /** Pill-style count badge inline with the label. Number renders with leading "·". */
  badge?: string | number;
  /** Bottom divider. Defaults true; pass false on the last row of a group. */
  divider?: boolean;
  kind?: RowKind;
  /** Switch state when `kind="switch"`. */
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
  /** Disable the row (visual + non-interactive). */
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export default function Row({
  icon,
  label,
  meta,
  sub,
  accent,
  onPress,
  danger,
  badge,
  divider = true,
  kind = "chevron",
  switchValue,
  onSwitchChange,
  disabled,
  style,
  accessibilityLabel,
  accessibilityHint,
}: RowProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const labelColor = danger ? theme.error : theme.fg;
  const iconColor = danger
    ? theme.error
    : accent
    ? theme.mode === "dark"
      ? "#fff"
      : theme.palette.green700
    : theme.fg;
  const tileBg = accent ?? (danger ? theme.errorTint : theme.bgMuted);

  // The chevron variant treats the whole row as a button. The switch
  // variant lets the row stay non-interactive (the switch itself
  // captures the tap) so screen readers don't double-announce.
  const wholeRowPressable =
    kind === "chevron" && !!onPress && !disabled;

  const Body = (
    <View
      style={[
        styles.row,
        divider && styles.divider,
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon !== undefined && icon !== null ? (
        <View style={[styles.tile, { backgroundColor: tileBg }]}>
          {typeof icon === "string" ? (
            <Ionicons
              name={icon as React.ComponentProps<typeof Ionicons>["name"]}
              size={18}
              color={iconColor}
            />
          ) : (
            icon
          )}
        </View>
      ) : null}

      <View style={styles.body}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: labelColor }]} numberOfLines={1}>
            {label}
          </Text>
          {badge !== undefined && badge !== null ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        {sub ? (
          <Text style={styles.sub} numberOfLines={2}>
            {sub}
          </Text>
        ) : null}
      </View>

      {kind === "chevron" ? (
        <View style={styles.trailing}>
          {meta ? <Text style={styles.meta}>{meta}</Text> : null}
          <Ionicons name="chevron-forward" size={18} color={theme.fgMuted} />
        </View>
      ) : null}

      {kind === "switch" ? (
        <Switch
          value={switchValue ?? false}
          onValueChange={onSwitchChange ?? (() => {})}
          disabled={disabled}
        />
      ) : null}
    </View>
  );

  if (wholeRowPressable) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled }}
        style={({ pressed }) => [pressed && { opacity: 0.92 }]}
      >
        {Body}
      </Pressable>
    );
  }

  return Body;
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s3 + 2, // 14 — matches design density
      paddingHorizontal: theme.space.s4,
      paddingVertical: theme.space.s3 + 2,
      backgroundColor: theme.surface,
    },
    divider: {
      borderBottomColor: theme.divider,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    disabled: {
      opacity: 0.5,
    },
    tile: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.md - 2, // 10 per design
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    body: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    labelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s2,
    },
    label: {
      ...theme.type.body,
      fontWeight: "700",
      flexShrink: 1,
    },
    badge: {
      backgroundColor: theme.bgMuted,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.space.s2,
      paddingVertical: 1,
    },
    badgeText: {
      ...theme.type.micro,
      color: theme.fgMuted,
      fontWeight: "800",
    },
    sub: {
      ...theme.type.caption,
      color: theme.fgMuted,
    },
    trailing: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s2,
    },
    meta: {
      ...theme.type.caption,
      color: theme.fgMuted,
      fontWeight: "600",
    },
  });
