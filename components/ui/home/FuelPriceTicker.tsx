import React from "react";
import { View, Text, FlatList, StyleSheet, Image } from "react-native";
import { useTheme } from "@/constants/theme";
import { useOrderStore } from "@/store/useOrderStore";

export default function FuelPriceTicker() {
  const theme = useTheme();
  const fuelTypes = useOrderStore((s) => s.fuelTypes);

  if (!fuelTypes.length) return null;

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.heading, { color: theme.icon }]}>Market Prices</Text>
      <FlatList
        data={fuelTypes}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
            <View style={[styles.iconWrap, { backgroundColor: theme.tertiary }]}>
              {item.icon ? (
                <Image source={{ uri: item.icon }} style={styles.icon} resizeMode="contain" />
              ) : (
                <Text style={[styles.iconFallback, { color: theme.icon }]}>⛽</Text>
              )}
            </View>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.price, { color: theme.primary }]}>
              {item.pricePerUnit != null ? `₦${item.pricePerUnit}` : "Market"}
            </Text>
            <Text style={[styles.unit, { color: theme.icon }]}>per {item.unit}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  heading: { fontSize: 12, fontWeight: "400", marginBottom: 10, letterSpacing: 0.3 },
  list: { gap: 10 },
  card: {
    width: 110,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  icon: { width: 28, height: 28 },
  iconFallback: { fontSize: 20 },
  name: { fontSize: 12, fontWeight: "400", textAlign: "center", marginBottom: 4 },
  price: { fontSize: 14, fontWeight: "600", textAlign: "center" },
  unit: { fontSize: 10, fontWeight: "300", textAlign: "center", marginTop: 2 },
});
