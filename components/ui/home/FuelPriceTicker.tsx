import React from "react";
import { View, Text, FlatList, StyleSheet, Image, ImageSourcePropType } from "react-native";
import { useTheme } from "@/constants/theme";
import { useOrderStore } from "@/store/useOrderStore";

const FUEL_LOCAL_ICON: Record<string, ImageSourcePropType> = {
  petrol: require("../../../assets/icons/fuel/petrol-icon.png"),
  diesel: require("../../../assets/icons/fuel/diesel-icon.png"),
  gas:    require("../../../assets/icons/fuel/gas-icon.png"),
  oil:    require("../../../assets/icons/fuel/oil-icon.png"),
};

export default function FuelPriceTicker() {
  const theme = useTheme();
  const fuelTypes = useOrderStore((s) => s.fuelTypes);

  if (!fuelTypes.length) return null;

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.heading, { color: theme.text }]}>Market Prices</Text>
      <FlatList
        data={fuelTypes}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const localIcon = FUEL_LOCAL_ICON[item.name.toLowerCase()] ?? FUEL_LOCAL_ICON.petrol;
          return (
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
              <View style={[styles.iconWrap, { backgroundColor: theme.tertiary }]}>
                <Image
                  source={item.icon ? { uri: item.icon } : localIcon}
                  style={styles.icon}
                  resizeMode="contain"
                />
              </View>
              <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[styles.unit, { color: theme.icon }]}>per {item.unit}</Text>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  heading: { fontSize: 15, fontWeight: "500", marginBottom: 12 },
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
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  icon: { width: 32, height: 32 },
  name: { fontSize: 12, fontWeight: "400", textAlign: "center", marginBottom: 4 },
  price: { fontSize: 14, fontWeight: "600", textAlign: "center" },
  unit: { fontSize: 10, fontWeight: "300", textAlign: "center", marginTop: 2 },
});
