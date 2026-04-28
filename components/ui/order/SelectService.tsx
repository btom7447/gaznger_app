import React, { useEffect, useRef, useCallback, memo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  ImageSourcePropType,
  TouchableOpacity,
  StyleSheet,
  ListRenderItemInfo,
  InteractionManager,
} from "react-native";
import { useTheme } from "@/constants/theme";
import { useOrderStore, FuelType } from "@/store/useOrderStore";

const ITEM_WIDTH = 110;

// Local fuel icons — same as FuelGrid, always available
const FUEL_LOCAL_ICON: Record<string, ImageSourcePropType> = {
  petrol: require("../../../assets/icons/fuel/petrol-icon.png"),
  diesel: require("../../../assets/icons/fuel/diesel-icon.png"),
  gas:    require("../../../assets/icons/fuel/gas-icon.png"),
  oil:    require("../../../assets/icons/fuel/oil-icon.png"),
};

function SelectService() {
  const theme = useTheme();
  const listRef = useRef<FlatList<FuelType>>(null);
  const hasScrolledRef = useRef(false);
  const [listReady, setListReady] = useState(false);

  const fuelTypes = useOrderStore((s) => s.fuelTypes);
  const selectedFuelId = useOrderStore((s) => s.order.fuel?._id);
  const setFuel = useOrderStore((s) => s.setFuel);

  useEffect(() => {
    if (!selectedFuelId || !fuelTypes.length || !listReady) return;
    if (hasScrolledRef.current) return;

    const index = fuelTypes.findIndex((f) => f._id === selectedFuelId);
    if (index === -1) return;

    const task = InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        listRef.current?.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0.5,
        });
        hasScrolledRef.current = true;
      }, 50);
    });

    return () => task.cancel();
  }, [selectedFuelId, fuelTypes, listReady]);

  const onSelect = useCallback(
    (fuel: FuelType) => {
      if (fuel._id === selectedFuelId) return;
      hasScrolledRef.current = false;
      setFuel(fuel);
    },
    [selectedFuelId, setFuel]
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<FuelType>) => {
      const isSelected = item._id === selectedFuelId;
      const localIcon = FUEL_LOCAL_ICON[item.name.toLowerCase()] ?? FUEL_LOCAL_ICON.petrol;
      return (
        <TouchableOpacity
          onPress={() => onSelect(item)}
          activeOpacity={0.85}
          style={[
            styles.item,
            {
              backgroundColor: isSelected ? theme.tertiary : theme.surface,
              borderColor: isSelected ? theme.primary : theme.ash,
              borderWidth: isSelected ? 2 : 1.5,
            },
          ]}
        >
          <View style={[styles.iconWrap, { backgroundColor: isSelected ? theme.primary + "18" : theme.background }]}>
            <Image
              source={item.icon ? { uri: item.icon } : localIcon}
              style={styles.icon}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.text, { color: isSelected ? theme.primary : theme.text }]}>
            {item.name}
          </Text>
        </TouchableOpacity>
      );
    },
    [selectedFuelId, theme, onSelect]
  );

  if (!fuelTypes.length) return null;

  return (
    <View style={{ marginTop: 16 }}>
      <Text style={[styles.title, { color: theme.text }]}>Select Service</Text>
      <View onLayout={() => setListReady(true)}>
        <FlatList
          ref={listRef}
          horizontal
          data={fuelTypes}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 4 }}
          getItemLayout={(_, index) => ({
            length: ITEM_WIDTH,
            offset: ITEM_WIDTH * index,
            index,
          })}
          onScrollToIndexFailed={({ index }) =>
            setTimeout(
              () => listRef.current?.scrollToIndex({ index, animated: true }),
              300
            )
          }
        />
      </View>
    </View>
  );
}

export default memo(SelectService);

const styles = StyleSheet.create({
  title: { fontSize: 13, fontWeight: "500", marginBottom: 12, letterSpacing: 0.1 },
  item: {
    width: ITEM_WIDTH,
    paddingVertical: 16,
    paddingHorizontal: 10,
    borderRadius: 18,
    alignItems: "center",
    marginRight: 10,
    gap: 6,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  icon: { width: 44, height: 44, resizeMode: "contain" },
  text: { fontSize: 13, fontWeight: "500", textTransform: "capitalize", textAlign: "center" },
});
