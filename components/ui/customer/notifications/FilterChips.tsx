import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Theme, useTheme } from "@/constants/theme";

export type NotificationFilter =
  | "all"
  | "order"
  | "payment"
  | "lpg"
  | "reminder"
  | "promo";

const ORDER: NotificationFilter[] = [
  "all",
  "order",
  "payment",
  "lpg",
  "reminder",
  "promo",
];

const LABEL: Record<NotificationFilter, string> = {
  all: "All",
  order: "Orders",
  payment: "Payment",
  lpg: "LPG",
  reminder: "Reminders",
  promo: "Promo",
};

interface FilterChipsProps {
  selected: NotificationFilter;
  onChange: (filter: NotificationFilter) => void;
  /** Per-filter counts; pass `all` for the total. */
  counts?: Partial<Record<NotificationFilter, number>>;
}

export default function FilterChips({
  selected,
  onChange,
  counts,
}: FilterChipsProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      {ORDER.map((f) => {
        const isSel = f === selected;
        const count = counts?.[f];
        return (
          <Pressable
            key={f}
            onPress={() => onChange(f)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSel }}
            accessibilityLabel={
              count != null ? `${LABEL[f]}, ${count}` : LABEL[f]
            }
            style={({ pressed }) => [
              styles.chip,
              isSel && styles.chipSelected,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.chipText,
                { color: isSel ? theme.bg : theme.fg },
              ]}
            >
              {LABEL[f]}
            </Text>
            {count != null && count > 0 ? (
              isSel ? (
                <View style={styles.countPillActive}>
                  <Text
                    numberOfLines={1}
                    style={[styles.countText, { color: theme.bg }]}
                  >
                    {count > 99 ? "99+" : String(count)}
                  </Text>
                </View>
              ) : (
                <Text
                  numberOfLines={1}
                  style={[styles.countInline, { color: theme.fgMuted }]}
                >
                  {count > 99 ? "99+" : String(count)}
                </Text>
              )
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    scroll: {
      // Prevents the horizontal ScrollView from greedily consuming vertical
      // space inside a flex column (which pushed the chips to the center of
      // the screen). flexGrow: 0 keeps it sized to its content.
      flexGrow: 0,
    },
    row: {
      flexDirection: "row",
      gap: theme.space.s2,
      paddingHorizontal: theme.space.s4,
      paddingVertical: theme.space.s3,
      alignItems: "center",
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.bgMuted,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.space.s4,
      paddingVertical: theme.space.s2 + 2, // 10
      minHeight: 36,
    },
    chipSelected: {
      backgroundColor: theme.fg,
    },
    chipText: {
      ...theme.type.caption,
      fontWeight: "700",
      lineHeight: 16,
    },
    countPillActive: {
      backgroundColor: "rgba(255,255,255,0.18)",
      paddingHorizontal: 7,
      paddingVertical: 1,
      borderRadius: theme.radius.pill,
      minWidth: 22,
      alignItems: "center",
    },
    countText: {
      fontSize: 11,
      lineHeight: 14,
      fontFamily: theme.type.caption.fontFamily,
      fontWeight: "800",
    },
    countInline: {
      ...theme.type.caption,
      fontWeight: "700",
      marginLeft: 2,
    },
  });
