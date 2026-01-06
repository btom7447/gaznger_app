import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useOrderStore } from "@/store/useOrderStore";
import { useTheme } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";

const CYLINDER_TYPES = ["Carbon Fiber", "Steel", "Aluminum"];

export default function CylinderTypeSelect() {
  const cylinderType = useOrderStore((s) => s.order.cylinderType);
  const setCylinderType = useOrderStore((s) => s.setCylinderType);
  const [open, setOpen] = useState(false);

  const theme = useTheme();

  return (
    <View style={styles(theme).fieldContainer}>
      <Text style={styles(theme).label}>Cylinder Type</Text>

      {/* Main Dropdown */}
      <TouchableOpacity
        style={styles(theme).dropdown}
        onPress={() => setOpen((prev) => !prev)}
        activeOpacity={0.8}
      >
        <Text style={[styles(theme).placeholder, { flex: 1 }]}>
          {cylinderType || "Select cylinder type"}
        </Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={20}
          color={theme.text}
        />
      </TouchableOpacity>

      {/* Dropdown Items */}
      {open && (
        <View style={styles(theme).dropdownItemsContainer}>
          {CYLINDER_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              style={styles(theme).dropdownItem}
              activeOpacity={0.7}
              onPress={() => {
                setCylinderType(type);
                setOpen(false);
              }}
            >
              <Text style={styles(theme).dropdownItemText}>{type}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    fieldContainer: { marginBottom: 20 },
    label: { fontSize: 20, fontWeight: "600", marginBottom: 10 },
    dropdown: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.quaternary,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: theme.quinest,
      height: 55,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },

    dropdownItemsContainer: {
      marginTop: 8,
      borderRadius: 14,
      backgroundColor: theme.background,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 5,
      overflow: "hidden",
    },

    dropdownItem: {
      paddingVertical: 16,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.quinest,
      backgroundColor: theme.background,
    },

    dropdownItemText: {
      fontSize: 16,
      fontWeight: "500",
      color: theme.text,
    },

    placeholder: {
      fontSize: 16,
      fontWeight: "400",
      color: theme.text,
    },
  });