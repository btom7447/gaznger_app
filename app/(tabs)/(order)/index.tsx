import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/constants/theme";
import { useOrderStore } from "@/store/useOrderStore";

export default function OrderScreen() {
  const theme = useTheme();

  // ✅ Split selectors to avoid creating a new object each render
  const fuel = useOrderStore((s) => s.order.fuel);
  const quantity = useOrderStore((s) => s.order.quantity);
  const setQuantity = useOrderStore((s) => s.setQuantity);

  const canContinue = Boolean(fuel && quantity > 0);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={[styles.title, { color: theme.text }]}>Order Details</Text>

      {/* Selected Fuel */}
      {fuel && (
        <View style={styles.section}>
          <Text style={{ color: theme.ash }}>Service</Text>
          <Text style={{ color: theme.text, fontWeight: "600" }}>
            {fuel.name}
          </Text>
        </View>
      )}

      {/* Quantity placeholder */}
      <View style={styles.section}>
        <Text style={{ color: theme.ash }}>Quantity</Text>
        <TouchableOpacity
          onPress={() => setQuantity(quantity + 1)}
          style={[styles.qtyBtn, { backgroundColor: theme.tertiary }]}
        >
          <Text style={{ color: theme.text }}>+ Add Quantity</Text>
        </TouchableOpacity>
      </View>

      {/* Continue */}
      <TouchableOpacity
        disabled={!canContinue}
        style={[
          styles.continueBtn,
          { backgroundColor: canContinue ? theme.tint : theme.icon },
        ]}
      >
        <Text style={{ color: theme.background, fontWeight: "600" }}>
          Continue
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: "600", marginBottom: 20 },
  section: { marginBottom: 20 },
  qtyBtn: {
    marginTop: 10,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  continueBtn: {
    marginTop: "auto",
    padding: 18,
    borderRadius: 18,
    alignItems: "center",
  },
});
