import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Theme, useTheme } from "@/constants/theme";

/**
 * Horizontal filter pills row — Orders queue (All / New / In-flight)
 * and Activity filter (All / Orders / Bulk / Payouts / Topups).
 *
 * Terse copy convention: each pill has a short label + optional count
 * badge to its right. Active state inverts to a primary-tinted chip.
 */
export interface FilterPillOption<T extends string = string> {
  value: T;
  label: string;
  /** Optional count to render after the label. */
  count?: number;
}

export interface FilterPillsProps<T extends string = string> {
  value: T;
  options: FilterPillOption<T>[];
  onChange: (value: T) => void;
}

export default function FilterPills<T extends string = string>({
  value,
  options,
  onChange,
}: FilterPillsProps<T>) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.row}>
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={
              opt.count != null
                ? `${opt.label}, ${opt.count} items`
                : opt.label
            }
            hitSlop={4}
            style={({ pressed }) => [
              styles.chip,
              isActive && styles.chipActive,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text
              style={[
                styles.label,
                isActive && styles.labelActive,
              ]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
            {opt.count != null ? (
              <View
                style={[styles.badge, isActive && styles.badgeActive]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    isActive && styles.badgeTextActive,
                  ]}
                >
                  {opt.count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      gap: 8,
      flexWrap: "wrap",
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.bgMuted,
      borderWidth: 1,
      borderColor: theme.border,
    },
    chipActive: {
      backgroundColor: theme.primaryTint,
      borderColor: theme.primary,
    },
    label: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      fontWeight: "700",
    },
    labelActive: {
      color: theme.primary,
    },
    badge: {
      minWidth: 18,
      paddingHorizontal: 5,
      height: 18,
      borderRadius: 9,
      backgroundColor: theme.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeActive: {
      backgroundColor: theme.primary,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.fgMuted,
    },
    badgeTextActive: {
      color: theme.fgOnPrimary,
    },
  });
