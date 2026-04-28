import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useOrderStore } from "@/store/useOrderStore";
import { DELIVERY_TYPES as STORE_DELIVERY_TYPES, DeliveryType } from "@/constants/orderOptions";
import { useTheme } from "@/constants/theme";

const DELIVERY_OPTIONS: Array<{ key: DeliveryType; label: string; sub: string; icon: keyof typeof MaterialIcons.glyphMap }> = [
  { key: "cylinder_swap", label: "Cylinder Swap", sub: "Exchange your empty cylinder", icon: "loop" },
  { key: "home_refill",   label: "Home Refill",   sub: "Delivery to your door",        icon: "local-shipping" },
];

export default function DeliveryTypeSelect() {
  const deliveryType = useOrderStore((s) => s.order.deliveryType);
  const setDeliveryType = useOrderStore((s) => s.setDeliveryType);
  const theme = useTheme();

  return (
    <View style={styles(theme).fieldContainer}>
      <Text style={styles(theme).label}>Delivery Type</Text>
      <View style={styles(theme).row}>
        {DELIVERY_OPTIONS.map((opt) => {
          const active = deliveryType === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              onPress={() => setDeliveryType(opt.key)}
              activeOpacity={0.85}
              style={[
                styles(theme).card,
                {
                  backgroundColor: active ? theme.tertiary : theme.surface,
                  borderColor: active ? theme.primary : theme.ash,
                  borderWidth: active ? 2 : 1.5,
                },
              ]}
            >
              <View style={[styles(theme).iconWrap, { backgroundColor: active ? theme.primary + "18" : theme.background }]}>
                <MaterialIcons name={opt.icon} size={26} color={active ? theme.primary : theme.icon} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles(theme).cardLabel, { color: active ? theme.primary : theme.text }]}>
                  {opt.label}
                </Text>
                <Text style={[styles(theme).cardSub, { color: active ? theme.primary + "99" : theme.icon }]}>
                  {opt.sub}
                </Text>
              </View>
              {active && (
                <MaterialIcons name="check-circle" size={18} color={theme.primary} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    fieldContainer: { marginVertical: 16 },
    label: {
      fontSize: 13,
      fontWeight: "500",
      color: theme.text,
      letterSpacing: 0.1,
      marginBottom: 10,
    },
    row: { gap: 10 },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 16,
    },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    cardLabel: { fontSize: 14, fontWeight: "500", marginBottom: 2 },
    cardSub: { fontSize: 12, fontWeight: "300" },
  });
