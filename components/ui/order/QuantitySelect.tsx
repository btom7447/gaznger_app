import React, { useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useOrderStore } from "@/store/useOrderStore";
import { useTheme } from "@/constants/theme";
import { MIN_QUANTITY } from "@/constants/orderOptions";

export default function QuantitySelect() {
  const { quantity, fuel } = useOrderStore((s) => s.order);
  const setQuantity = useOrderStore((s) => s.setQuantity);
  const theme = useTheme();
  const inputRef = useRef<TextInput>(null);

  const fuelKey = fuel?.name?.toLowerCase() ?? "";
  const minQty = MIN_QUANTITY[fuelKey] ?? 0;
  const unit = fuel?.unit ?? "";

  return (
    <View style={styles(theme).fieldContainer}>
      {/* Label + min badge inline */}
      <View style={styles(theme).labelRow}>
        <Text style={styles(theme).label}>Quantity</Text>
        {minQty > 0 && (
          <View style={[styles(theme).minBadge, { backgroundColor: theme.tertiary, borderColor: theme.ash }]}>
            <Text style={[styles(theme).minBadgeText, { color: theme.primary }]}>
              min {minQty} {unit}
            </Text>
          </View>
        )}
      </View>

      {/* Input with prefix + vertical demarcation */}
      <TouchableOpacity
        activeOpacity={1}
        style={[styles(theme).inputWrapper, { borderColor: theme.ash, backgroundColor: theme.surface }]}
        onPress={() => inputRef.current?.focus()}
      >
        {/* Left prefix */}
        <View style={styles(theme).prefixWrap}>
          <Text style={[styles(theme).prefix, { color: theme.primary }]}>
            {unit || "qty"}
          </Text>
        </View>

        {/* Vertical divider */}
        <View style={[styles(theme).vDivider, { backgroundColor: theme.ash }]} />

        {/* Numeric input */}
        <TextInput
          ref={inputRef}
          style={[styles(theme).input, { color: theme.text }]}
          keyboardType="numeric"
          value={quantity > 0 ? quantity.toString() : ""}
          placeholder="Enter amount"
          placeholderTextColor={theme.icon}
          onChangeText={(text) => {
            const value = Number(text);
            setQuantity(Number.isNaN(value) ? 0 : value);
          }}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    fieldContainer: { marginVertical: 16 },
    labelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 10,
    },
    label: {
      fontSize: 13,
      fontWeight: "500",
      color: theme.text,
      letterSpacing: 0.1,
    },
    minBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      borderWidth: 1,
    },
    minBadgeText: { fontSize: 11, fontWeight: "500" },
    inputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1.5,
      borderRadius: 14,
      height: 56,
      overflow: "hidden",
    },
    prefixWrap: {
      width: 54,
      alignItems: "center",
      justifyContent: "center",
    },
    prefix: {
      fontSize: 14,
      fontWeight: "600",
      letterSpacing: 0.2,
    },
    vDivider: {
      width: 1,
      height: 28,
    },
    input: {
      flex: 1,
      fontSize: 16,
      fontWeight: "400",
      paddingHorizontal: 16,
      paddingVertical: 0,
    },
  });
