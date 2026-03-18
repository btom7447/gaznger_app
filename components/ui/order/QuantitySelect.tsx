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

export default function QuantitySelect() {
  const { quantity, fuel } = useOrderStore((s) => s.order);
  const setQuantity = useOrderStore((s) => s.setQuantity);

  const theme = useTheme();
  const inputRef = useRef<TextInput>(null);

  return (
    <View style={styles(theme).fieldContainer}>
      <Text style={styles(theme).label}>Select your Quantity</Text>
      <TouchableOpacity
        activeOpacity={1}
        style={styles(theme).inputWrapper}
        onPress={() => inputRef.current?.focus()}
      >
        <TextInput
          ref={inputRef}
          style={styles(theme).input}
          keyboardType="numeric"
          value={quantity?.toString() || ""}
          placeholder="Enter quantity"
          onChangeText={(text) => {
            const value = Number(text);
            setQuantity(Number.isNaN(value) ? 0 : value);
          }}
        />
        <Text style={styles(theme).unitText}>{fuel?.unit || ""}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    fieldContainer: { marginVertical: 16 },
    label: {
      fontSize: 13,
      fontWeight: "400",
      marginBottom: 8,
      color: theme.icon,
      letterSpacing: 0.1,
    },
    inputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: theme.ash,
      borderRadius: 14,
      backgroundColor: theme.surface,
      paddingHorizontal: 14,
      height: 54,
    },
    input: {
      flex: 1,
      fontSize: 16,
      fontWeight: "300",
      color: theme.text,
      paddingVertical: 10,
    },
    unitText: {
      fontSize: 13,
      fontWeight: "400",
      color: theme.primary,
      marginLeft: 10,
      backgroundColor: theme.tertiary,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
  });
