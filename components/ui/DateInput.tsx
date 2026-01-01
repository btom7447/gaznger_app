import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/constants/theme";

interface DateInputProps {
  value: Date;
  onChange: (date: Date) => void;
  mode?: "date" | "time" | "datetime";
  minimumDate?: Date;
  maximumDate?: Date;
  label?: string;
  style?: any;
}

export default function DateInput({
  value,
  onChange,
  mode = "date",
  minimumDate,
  maximumDate,
  label,
  style,
}: DateInputProps) {
  const theme = useTheme();
  const [show, setShow] = useState(false);

  const formattedDate = value.toLocaleDateString();

  const onChangeInternal = (
    event: DateTimePickerEvent,
    selectedDate?: Date
  ) => {
    setShow(Platform.OS === "ios"); // keep open on iOS, close on Android
    if (selectedDate) {
      onChange(selectedDate);
    }
  };

  const borderColor = show ? theme.primary : theme.border;
  const iconColor = show ? theme.primary : theme.text;

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      )}

      <Pressable
        onPress={() => setShow(true)}
        style={[styles.input, { borderColor, backgroundColor: theme.card }]}
      >
        <Text style={{ color: theme.text }}>{formattedDate}</Text>
        <Ionicons name="calendar-outline" size={20} color={iconColor} />
      </Pressable>

      {show && (
        <DateTimePicker
          value={value}
          mode={mode}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onChangeInternal}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%" },
  label: { marginBottom: 6, fontSize: 14, fontWeight: "500" },
  input: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderWidth: 1,
    borderRadius: 12,
  },
});
