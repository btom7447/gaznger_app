import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  ListRenderItemInfo,
} from "react-native";
import { useTheme } from "@/constants/theme";
import { useOrderStore, FuelType } from "@/store/useOrderStore";

export default function SelectService() {
  const theme = useTheme();
  const listRef = useRef<FlatList<FuelType>>(null);

  const fuelTypes = useOrderStore((s) => s.fuelTypes);
  const fuelId = useOrderStore((s) => s.order.fuel?._id);
  const setFuel = useOrderStore((s) => s.setFuel);

  // ✅ Scroll to selected fuel only when fuelId or fuelTypes change
  useEffect(() => {
    if (!fuelId) return;
    const index = fuelTypes.findIndex((f) => f._id === fuelId);
    if (index !== -1) listRef.current?.scrollToIndex({ index, animated: true });
  }, [fuelId, fuelTypes]);

  const renderFuelItem = ({ item }: ListRenderItemInfo<FuelType>) => {
    const isSelected = fuelId === item._id;

    return (
      <TouchableOpacity
        onPress={() => {
          if (fuelId === item._id) return; // prevent re-render loop
          setFuel(item);
        }}
        style={[
          styles.item,
          {
            backgroundColor: isSelected ? theme.tertiary : theme.background,
            borderColor: isSelected ? theme.tint : "transparent",
          },
        ]}
      >
        {item.icon && <Image source={{ uri: item.icon }} style={styles.icon} />}
        <Text style={{ color: theme.text, fontWeight: "600" }}>
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  if (!fuelTypes.length) return null;

  return (
    <View>
      <Text style={[styles.title, { color: theme.text }]}>Select Service</Text>
      <FlatList
        ref={listRef}
        horizontal
        data={fuelTypes}
        keyExtractor={(item) => item._id}
        showsHorizontalScrollIndicator={false}
        renderItem={renderFuelItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "600", marginBottom: 10 },
  item: {
    padding: 16,
    borderRadius: 24,
    marginRight: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  icon: { width: 60, height: 60, resizeMode: "contain", marginBottom: 6 },
});
