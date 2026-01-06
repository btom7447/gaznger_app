import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSessionStore } from "@/store/useSessionStore";
import { useOrderStore } from "@/store/useOrderStore";
import { router } from "expo-router";
import { useTheme } from "@/constants/theme";

interface Address {
  _id: string;
  label: string;
  icon?: string;
  default?: boolean;
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

  // Fetch addresses
  useEffect(() => {
    if (!user) return;

    const fetchAddresses = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${process.env.EXPO_PUBLIC_BASE_URL}/api/address-book/${user.id}`
        );
        if (!res.ok) throw new Error("Failed to fetch addresses");
        const data: Address[] = await res.json();

        // Mark default
        const addressesWithDefault = data.map((addr) => ({
          ...addr,
          default: addr._id === user.defaultAddress,
        }));

        // Reorder: default first
        const defaultIndex = addressesWithDefault.findIndex(
          (addr) => addr.default
        );
        const orderedAddresses =
          defaultIndex !== -1
            ? [
                addressesWithDefault[defaultIndex],
                ...addressesWithDefault.filter((_, i) => i !== defaultIndex),
              ]
            : addressesWithDefault;

        setAddresses(orderedAddresses);

        // ✅ Use reordered array to set default
        if (!deliveryAddressId && orderedAddresses.length > 0) {
          const defaultAddr =
            orderedAddresses.find((addr) => addr.default) ||
            orderedAddresses[0];
          setDeliveryAddress(defaultAddr._id, defaultAddr.label);
        }
      } catch (err) {
        console.error("fetchAddresses error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAddresses();
  }, [user]);


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

    if (defaultAddr) {
      setDeliveryAddress(defaultAddr._id, defaultAddr.label);
    } else {
      const firstAddr = addresses[0];
      setDeliveryAddress(firstAddr._id, firstAddr.label);
    }
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
    setDeliveryAddress(item._id, item.label); // ✅ pass label
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
    return <ActivityIndicator size="large" style={{ marginVertical: 20 }} />;
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
      fontSize: 20,
      fontWeight: "600",
      marginBottom: 12,
      color: theme.text,
    },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
      marginRight: 12,
    },
    pillText: {
      marginLeft: 8,
      fontSize: 16,
      fontWeight: "500",
    },
  });
