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
  { key: "closest",  label: "Closest",   icon: "navigate-outline" as const },
  { key: "rating",   label: "Top Rated", icon: "star-outline" as const },
  { key: "price",    label: "Cheapest",  icon: "pricetag-outline" as const },
];

export default function StationsFilterBar({
  filters,
  onChangeFilter,
  sort,
  onSortChange,
  radius = 5,
  onRadiusChange,
}: FilterBarProps) {
  const theme = useTheme();
  const verifiedActive = filters.verified === "true";

  const handleRadiusTap = () => {
    const idx = RADIUS_OPTIONS.indexOf(radius);
    const next = RADIUS_OPTIONS[(idx + 1) % RADIUS_OPTIONS.length];
    onRadiusChange?.(next);
  };

  return (
    <View style={styles(theme).wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles(theme).row}
      >
        {/* Sort options */}
        {SORT_OPTIONS.map((opt) => {
          const active = sort === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              onPress={() => onSortChange(opt.key)}
              activeOpacity={0.7}
              style={[
                styles(theme).chip,
                active
                  ? { backgroundColor: theme.primary, borderColor: theme.primary }
                  : { backgroundColor: theme.surface, borderColor: theme.ash },
              ]}
            >
              <Ionicons
                name={opt.icon}
                size={12}
                color={active ? "#fff" : theme.icon}
              />
              <Text style={[styles(theme).chipLabel, { color: active ? "#fff" : theme.text }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Separator */}
        <View style={[styles(theme).separator, { backgroundColor: theme.ash }]} />

        {/* Verified filter */}
        <TouchableOpacity
          onPress={() => onChangeFilter("verified", verifiedActive ? "" : "true")}
          activeOpacity={0.7}
          style={[
            styles(theme).chip,
            verifiedActive
              ? { backgroundColor: "#22C55E", borderColor: "#22C55E" }
              : { backgroundColor: theme.surface, borderColor: theme.ash },
          ]}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={12}
            color={verifiedActive ? "#fff" : theme.icon}
          />
          <Text style={[styles(theme).chipLabel, { color: verifiedActive ? "#fff" : theme.text }]}>
            Verified
          </Text>
        </TouchableOpacity>

        {/* Radius — tap to cycle */}
        <TouchableOpacity
          onPress={handleRadiusTap}
          activeOpacity={0.7}
          style={[styles(theme).chip, { backgroundColor: theme.surface, borderColor: theme.ash }]}
        >
          <Ionicons name="radio-outline" size={12} color={theme.primary} />
          <Text style={[styles(theme).chipLabel, { color: theme.text }]}>{radius} km</Text>
          <Ionicons name="chevron-forward" size={10} color={theme.icon} style={{ marginLeft: 1 }} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    wrapper: { paddingVertical: 12 },
    row: { flexDirection: "row", paddingHorizontal: 2, gap: 6, alignItems: "center" },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 20,
      borderWidth: 1,
    },
    chipLabel: { fontSize: 12, fontWeight: "500" },
    separator: {
      width: 1,
      height: 18,
      marginHorizontal: 2,
    },
  });
