import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useOrderStore } from "@/store/useOrderStore";
import { useTheme } from "@/constants/theme";

const CYLINDER_OPTIONS: Array<{
  key: string;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}> = [
  { key: "Carbon Fiber", label: "Carbon Fiber", icon: "propane-tank" },
  { key: "Steel", label: "Steel", icon: "propane-tank" },
  { key: "Aluminum", label: "Aluminum", icon: "propane-tank" },
  { key: "Composite", label: "Composite", icon: "propane-tank" },
];

export default function CylinderTypeSelect() {
  const cylinderType = useOrderStore((s) => s.order.cylinderType);
  const setCylinderType = useOrderStore((s) => s.setCylinderType);
  const theme = useTheme();

  return (
    <View style={styles(theme).fieldContainer}>
      <Text style={styles(theme).label}>Cylinder Type</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
      >
        {CYLINDER_OPTIONS.map((opt) => {
          const active = cylinderType === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              onPress={() => setCylinderType(opt.key)}
              activeOpacity={0.85}
              style={[
                styles(theme).card,
                {
                  backgroundColor: active ? theme.tertiary : theme.surface,
                  borderColor: active ? theme.primary : theme.ash,
                  borderWidth: active ? 2 : 1.5,
                },
              ]}
            >
              <View style={[styles(theme).iconWrap, { backgroundColor: active ? theme.primary + "18" : theme.background }]}>
                <MaterialIcons name={opt.icon} size={26} color={active ? theme.primary : theme.icon} />
              </View>
              <Text style={[styles(theme).cardLabel, { color: active ? theme.primary : theme.text }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    fieldContainer: { marginVertical: 16 },
    label: {
      fontSize: 13,
      fontWeight: "500",
      color: theme.text,
      letterSpacing: 0.1,
      marginBottom: 10,
    },
    card: {
      width: 100,
      paddingVertical: 14,
      paddingHorizontal: 10,
      borderRadius: 18,
      alignItems: "center",
      gap: 8,
    },
    iconWrap: {
      width: 52,
      height: 52,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    cardLabel: {
      fontSize: 12,
      fontWeight: "500",
      textAlign: "center",
    },
  });
