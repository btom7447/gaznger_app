import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Theme, useTheme } from "@/constants/theme";

/**
 * Filter chip with optional count badge. Used by:
 *   - History filter rail (All / Active / Delivered / Cancelled)
 *   - Notifications filter rail (per-kind)
 *
 * Two visual kinds:
 *   - "neutral" (default) — active = fg-on-bg (high contrast inversion)
 *   - "primary"           — active = primary green
 *
 * NOT to be confused with the small sort chips on Stations or the
 * QuickChips on Order. Those are surface-specific in
 * components/ui/customer/order/.
 */
export type ChipKind = "neutral" | "primary";

interface ChipProps {
  selected?: boolean;
  count?: number | string;
  kind?: ChipKind;
  onPress?: () => void;
  /** Disable the chip (visual + non-interactive). */
  disabled?: boolean;
  accessibilityLabel?: string;
  children: React.ReactNode;
}

export default function Chip({
  selected = false,
  count,
  kind = "neutral",
  onPress,
  disabled,
  accessibilityLabel,
  children,
}: ChipProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const activeBg = kind === "primary" ? theme.primary : theme.fg;
  const activeFg = kind === "primary" ? "#fff" : theme.bg;

  const bg = selected ? activeBg : theme.bgMuted;
  const fg = selected ? activeFg : theme.fg;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: bg },
        disabled && { opacity: 0.5 },
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text
        style={[styles.label, { color: fg }]}
        numberOfLines={1}
      >
        {children}
      </Text>
      {count !== undefined && count !== null ? (
        <View
          style={[
            styles.countBubble,
            {
              // Selected: translucent white over the active bg
              // Inactive: surface-colour over the muted chip bg
              backgroundColor: selected
                ? "rgba(255,255,255,0.20)"
                : theme.surface,
            },
          ]}
        >
          <Text
            style={[
              styles.countText,
              { color: selected ? activeFg : theme.fgMuted },
            ]}
          >
            {count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    chip: {
      height: 34,
      paddingHorizontal: theme.space.s3 + 2,
      borderRadius: 17,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flexShrink: 0,
    },
    label: {
      ...theme.type.caption,
      fontWeight: "700",
    },
    countBubble: {
      borderRadius: theme.radius.pill,
      paddingHorizontal: 7,
      paddingVertical: 1,
      minWidth: 18,
      alignItems: "center",
    },
    countText: {
      ...theme.type.micro,
      fontWeight: "800",
    },
  });
