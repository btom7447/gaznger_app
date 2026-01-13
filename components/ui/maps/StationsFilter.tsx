import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "@/constants/theme";

interface FilterBarProps {
  filters: any;
  onChangeFilter: (key: string, value: any) => void;
  sort: string;
  onSortChange: (value: string) => void;
}

export default function StationsFilterBar({
  filters,
  onChangeFilter,
  sort,
  onSortChange,
}: FilterBarProps) {
  const theme = useTheme();

  return (
    <View style={styles(theme).container}>
      <View style={styles(theme).filtersRow}>
        <TouchableOpacity
          style={styles(theme).filterBtn}
          onPress={() => onSortChange("closest")}
        >
          <Text style={styles(theme).filterText}>Closest</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles(theme).filterBtn}
          onPress={() => onSortChange("rating")}
        >
          <Text style={styles(theme).filterText}>Highest Rating</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles(theme).filterBtn}
          onPress={() => onSortChange("price")}
        >
          <Text style={styles(theme).filterText}>Cheapest</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: { padding: 12, paddingTop: 30,  backgroundColor: theme.background },
    filtersRow: { flexDirection: "row", justifyContent: "space-around" },
    filterBtn: {
      padding: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.ash,
    },
    filterText: { color: theme.text, fontWeight: "600" },
  });
