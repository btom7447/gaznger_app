import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/constants/theme";
import { useOrderStore, FuelType } from "@/store/useOrderStore";

const SkeletonCard = () => <View style={[styles.card, styles.skeletonCard]} />;

export default function FuelGrid() {
  const router = useRouter();
  const theme = useTheme();

  const fuelTypes = useOrderStore((s) => s.fuelTypes);
  const currentFuelId = useOrderStore((s) => s.order.fuel?._id);
  const setFuel = useOrderStore((s) => s.setFuel);

  const handleSelect = (fuel: FuelType) => {
    if (currentFuelId === fuel._id) return; // ✅ prevent re-render loop
    setFuel(fuel);
    router.push("/(tabs)/(order)");
  };

  if (!fuelTypes.length) {
    return (
      <View style={styles.container}>
        {[...Array(4)].map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {fuelTypes.map((fuel) => (
        <TouchableOpacity
          key={fuel._id}
          style={[
            styles.card,
            {
              backgroundColor: "#fff",
              borderColor: theme.icon,
            },
          ]}
          onPress={() => handleSelect(fuel)}
          activeOpacity={0.85}
        >
          <Text style={[styles.text, { color: theme.text }]}>{fuel.name}</Text>
          <Text style={[styles.unit, { color: theme.ash }]}>
            per {fuel.unit}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingVertical: 10,
  },
  card: {
    width: "48%",
    paddingVertical: 22,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  unit: {
    fontSize: 13,
  },
  skeletonCard: {
    backgroundColor: "#2a2a2a",
    width: "48%",
    height: 80,
    borderRadius: 20,
    marginBottom: 12,
  },
});
