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
    fieldContainer: { marginVertical: 20 },
    label: {
      fontSize: 18,
      fontWeight: "600",
      marginBottom: 8,
      color: theme.text,
    },
    inputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.quaternary,
      borderRadius: 12,
      backgroundColor: theme.quinest,
      paddingHorizontal: 12,
      height: 55,
    },
    input: {
      flex: 1,
      fontSize: 16,
      fontWeight: "400",
      color: theme.text,
      paddingVertical: 10,
    },
    unitText: {
      fontSize: 16,
      fontWeight: "500",
      color: theme.text,
      marginLeft: 10,
    },
  });
