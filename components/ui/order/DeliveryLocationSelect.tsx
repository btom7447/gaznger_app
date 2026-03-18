import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import SkeletonBox from "@/components/ui/skeletons/SkeletonBox";
import { Ionicons } from "@expo/vector-icons";
import { useSessionStore } from "@/store/useSessionStore";
import { useOrderStore } from "@/store/useOrderStore";
import { router, useFocusEffect } from "expo-router";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";

interface Address {
  _id: string;
  label: string;
  icon?: string;
  default?: boolean;
  latitude?: number;
  longitude?: number;
}

export default function DeliveryLocationSelect() {
  const theme = useTheme();
  const user = useSessionStore((s) => s.user);
  const deliveryAddressId = useOrderStore((s) => s.order.deliveryAddressId);
  const setDeliveryAddress = useOrderStore((s) => s.setDeliveryAddress);
  const canEditOrder = useOrderStore((s) => s.canEditOrder());

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList>(null);

  // Fetch addresses — runs on mount and every time the screen regains focus
  // (covers the case where user edits/adds an address in the address-book screen)
  const fetchAddresses = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Backend now returns isDefault per address
      const data = await api.get<Address[]>("/api/address-book");

      // Reorder: default first
      const defaultIndex = data.findIndex((addr) => (addr as any).isDefault);
      const orderedAddresses =
        defaultIndex !== -1
          ? [data[defaultIndex], ...data.filter((_, i) => i !== defaultIndex)]
          : data;

      // Map to local Address shape (default field for backward compat)
      const mapped = orderedAddresses.map((addr) => ({
        ...addr,
        default: !!(addr as any).isDefault,
      }));

      setAddresses(mapped);

      if (!deliveryAddressId && mapped.length > 0) {
        const defaultAddr = mapped.find((a) => a.default) || mapped[0];
        const coords = defaultAddr.latitude && defaultAddr.longitude
          ? { lat: defaultAddr.latitude, lng: defaultAddr.longitude }
          : undefined;
        setDeliveryAddress(defaultAddr._id, defaultAddr.label, coords);
      }
    } catch {
      // address list remains empty on error
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial fetch
  useEffect(() => { fetchAddresses(); }, [user]);

  // Re-fetch whenever the parent screen comes back into focus
  // (e.g. user navigated to address-book, changed an icon, and returned)
  useFocusEffect(useCallback(() => { fetchAddresses(); }, [fetchAddresses]));


  // Add “Add new address”
  const extendedData: Address[] = [
    ...addresses,
    { _id: "add", label: "Add new address" },
  ];

  // Ensure default delivery address is set
  useEffect(() => {
    if (!user || addresses.length === 0 || deliveryAddressId) return;

    const userDefaultAddressId = user.defaultAddress;
    const defaultAddr = addresses.find(
      (addr) => addr._id === userDefaultAddressId
    );

    const toSelect = defaultAddr || addresses[0];
    const coords = toSelect.latitude && toSelect.longitude
      ? { lat: toSelect.latitude, lng: toSelect.longitude }
      : undefined;
    setDeliveryAddress(toSelect._id, toSelect.label, coords);
  }, [addresses, user]);

  // Scroll to selected
  useEffect(() => {
    if (!deliveryAddressId || !listRef.current) return;

    const index = extendedData.findIndex(
      (addr) => addr._id === deliveryAddressId
    );
    if (index !== -1) {
      setTimeout(() => {
        listRef.current?.scrollToIndex({ index, animated: true });
      }, 100);
    }
  }, [deliveryAddressId, extendedData]);

  const handleSelect = (item: Address, index: number) => {
    if (item._id === "add") {
      router.push("/(screens)/address-book");
      return;
    }
    const coords = item.latitude && item.longitude
      ? { lat: item.latitude, lng: item.longitude }
      : undefined;
    setDeliveryAddress(item._id, item.label, coords);
    listRef.current?.scrollToIndex({ index, animated: true });
  };

  const renderItem = ({ item, index }: { item: Address; index: number }) => {
    const isAdd = item._id === "add";
    const isSelected = deliveryAddressId === item._id;

    const iconName = isSelected
      ? item.icon?.replace("-outline", "") ?? "location-sharp"
      : item.icon ?? "location-outline";

    return (
      <TouchableOpacity
        disabled={!canEditOrder && !isAdd}
        onPress={() => handleSelect(item, index)}
        style={[
          styles(theme).pill,
          {
            backgroundColor: isAdd
              ? theme.background
              : isSelected
              ? theme.quaternary
              : theme.quinest,
            borderColor: isAdd
              ? theme.ash
              : isSelected
              ? theme.quaternary
              : theme.quinary,
            borderWidth: 1,
            borderStyle: isAdd ? "dashed" : "solid",
          },
        ]}
      >
        <Ionicons
          name={isAdd ? "add-circle-outline" : (iconName as any)}
          size={22}
          color={isAdd ? theme.ash : isSelected ? "#fff" : theme.quaternary}
        />
        <Text
          style={[
            styles(theme).pillText,
            {
              color: isAdd ? theme.ash : isSelected ? "#fff" : theme.quaternary,
            },
          ]}
        >
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    const PillSkeleton = ({ textWidth }: { textWidth: number }) => (
      <View style={{
        flexDirection: "row", alignItems: "center",
        height: 44, borderRadius: 12, borderWidth: 1, borderColor: theme.ash,
        backgroundColor: theme.surface, paddingHorizontal: 14, gap: 8, marginRight: 10,
      }}>
        <SkeletonBox width={20} height={20} borderRadius={10} />
        <SkeletonBox width={textWidth} height={12} borderRadius={6} />
      </View>
    );
    return (
      <View style={{ marginBottom: 20 }}>
        <Text style={styles(theme).label}>Delivery Location</Text>
        <View style={{ flexDirection: "row", paddingVertical: 5 }}>
          <PillSkeleton textWidth={72} />
          <PillSkeleton textWidth={56} />
          <PillSkeleton textWidth={64} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={styles(theme).label}>Delivery Location</Text>
      <FlatList
        ref={listRef}
        data={extendedData}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 5 }}
      />
    </View>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    label: {
      fontSize: 16,
      fontWeight: "700",
      marginBottom: 10,
      color: theme.text,
      letterSpacing: 0.1,
    },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      marginRight: 10,
    },
    pillText: {
      marginLeft: 8,
      fontSize: 13,
      fontWeight: "600",
    },
  });
