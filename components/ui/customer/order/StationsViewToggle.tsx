import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";

/**
 * Segmented List/Map toggle that lives in the right slot of the
 * Stations screen header. Pill-style two-option control with the
 * active option lifted in surface colour.
 */
export type StationsViewMode = "list" | "map";

interface Props {
  mode: StationsViewMode;
  onChange: (next: StationsViewMode) => void;
}

const OPTIONS: Array<{
  value: StationsViewMode;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}> = [
  { value: "list", label: "List", icon: "options" },
  { value: "map", label: "Map", icon: "navigate" },
];

export default function StationsViewToggle({ mode, onChange }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.wrap}>
      {OPTIONS.map((opt) => {
        const isActive = opt.value === mode;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${opt.label} view`}
            style={({ pressed }) => [
              styles.segment,
              isActive && styles.segmentActive,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons
              name={opt.icon}
              size={13}
              color={isActive ? theme.fg : theme.fgMuted}
            />
            <Text
              style={[
                styles.label,
                { color: isActive ? theme.fg : theme.fgMuted },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: {
      flexDirection: "row",
      backgroundColor: theme.bgMuted,
      borderRadius: 10,
      padding: 3,
    },
    segment: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
    },
    segmentActive: {
      backgroundColor: theme.surface,
      ...theme.elevation.card,
    },
    label: {
      fontSize: 11,
      fontWeight: "800",
      textTransform: "capitalize",
    },
  });
