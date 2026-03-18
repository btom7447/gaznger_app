import React, { useEffect, useRef, useCallback, memo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  ListRenderItemInfo,
  InteractionManager,
} from "react-native";
import { useTheme } from "@/constants/theme";
import { useOrderStore, FuelType } from "@/store/useOrderStore";

const ITEM_WIDTH = 100;

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
      return (
        <TouchableOpacity
          onPress={() => onSelect(item)}
          activeOpacity={0.85}
          style={[
            styles.item,
            {
              backgroundColor: isSelected ? theme.tertiary : theme.surface,
              borderColor: isSelected ? theme.primary : theme.ash,
            },
          ]}
        >
          {item.icon && <Image source={{ uri: item.icon }} style={styles.icon} />}
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
  title: { fontSize: 13, fontWeight: "400", marginBottom: 10, letterSpacing: 0.1 },
  item: {
    width: ITEM_WIDTH,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1.5,
    marginRight: 10,
  },
  icon: { width: 48, height: 52, resizeMode: "contain", marginBottom: 6 },
  text: { fontSize: 12, fontWeight: "400", textTransform: "capitalize" },
});
