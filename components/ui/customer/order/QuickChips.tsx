import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Theme, useTheme } from "@/constants/theme";

interface QuickChipsProps {
  values: number[];
  unit?: string;
  /** Currently selected value (highlights the matching chip). */
  selected?: number;
  onChange: (value: number) => void;
}

/**
 * Quantity preset chips that sync bidirectionally with the Stepper.
 * Selected when `selected` exactly equals the chip's value.
 */
export default function QuickChips({
  values,
  unit,
  selected,
  onChange,
}: QuickChipsProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.row}>
      {values.map((v) => {
        const isSel = v === selected;
        const label = unit ? `${v} ${unit}` : String(v);
        return (
          <Pressable
            key={v}
            onPress={() => onChange(v)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSel }}
            accessibilityLabel={`${v} ${unit ?? ""}`.trim()}
            style={({ pressed }) => [
              styles.chip,
              isSel && styles.chipSelected,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text
              style={[
                styles.text,
                { color: isSel ? theme.primary : theme.fg },
              ]}
            >
              {label}
            </Text>
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
      gap: theme.space.s2,
    },
    chip: {
      flex: 1,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: theme.radius.pill,
    },
    chipSelected: {
      backgroundColor: theme.primaryTint,
      borderColor: theme.primary,
    },
    text: {
      ...theme.type.caption,
      fontWeight: "700",
    },
  });
