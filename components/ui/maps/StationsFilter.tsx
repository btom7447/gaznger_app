import React from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/constants/theme";

const RADIUS_OPTIONS = [3, 5, 10];

interface FilterBarProps {
  filters: Record<string, string>;
  onChangeFilter: (key: string, value: string) => void;
  sort: string;
  onSortChange: (value: string) => void;
  radius?: number;
  onRadiusChange?: (km: number) => void;
}

const SORT_OPTIONS = [
  { key: "closest", label: "Closest", icon: "navigate-outline" as const },
  { key: "rating",  label: "Rating",  icon: "star-outline" as const },
  { key: "price",   label: "Cheapest", icon: "pricetag-outline" as const },
];

export default function StationsFilterBar({
  sort,
  onSortChange,
  radius = 5,
  onRadiusChange,
}: FilterBarProps) {
  const theme = useTheme();

  const handleRadiusTap = () => {
    const idx = RADIUS_OPTIONS.indexOf(radius);
    const next = RADIUS_OPTIONS[(idx + 1) % RADIUS_OPTIONS.length];
    onRadiusChange?.(next);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {SORT_OPTIONS.map((opt) => {
          const active = sort === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              onPress={() => onSortChange(opt.key)}
              activeOpacity={0.75}
              style={[
                styles.chip,
                active
                  ? { backgroundColor: theme.quaternary, borderColor: theme.quaternary }
                  : { backgroundColor: "transparent", borderColor: theme.ash },
              ]}
            >
              <Ionicons
                name={opt.icon}
                size={13}
                color={active ? "#fff" : theme.icon}
                style={{ marginRight: 5 }}
              />
              <Text style={[styles.chipLabel, { color: active ? "#fff" : theme.text }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Radius chip — cycles 3→5→10 */}
        <TouchableOpacity
          onPress={handleRadiusTap}
          activeOpacity={0.75}
          style={[styles.chip, { backgroundColor: "transparent", borderColor: theme.ash }]}
        >
          <Ionicons
            name="radio-outline"
            size={13}
            color={theme.icon}
            style={{ marginRight: 5 }}
          />
          <Text style={[styles.chipLabel, { color: theme.text }]}>{radius} km</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 10 },
  row: { flexDirection: "row", paddingHorizontal: 4, gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipLabel: { fontSize: 13, fontWeight: "500" },
});
