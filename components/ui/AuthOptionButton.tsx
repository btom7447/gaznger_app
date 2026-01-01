import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/constants/theme";

type OptionType = "sms" | "email";

interface AuthOptionButtonProps {
  type: OptionType;
  maskedValue: string;
  selected: boolean;
  onPress: () => void;
}

export default function AuthOptionButton({
  type,
  maskedValue,
  selected,
  onPress,
}: AuthOptionButtonProps) {
  const theme = useTheme();
  const iconName = type === "sms" ? "chatbubble-ellipses" : "mail";

  const baseBorder = selected ? theme.primary + "33" : theme.border;
  const baseBG = selected ? theme.secondary + "0D" : theme.card;
  const baseText = selected ? theme.primary : theme.text;
  const baseIcon = selected ? theme.primary : theme.inactive;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        ...styles.optionButton,
        borderColor: baseBorder,
        backgroundColor: pressed ? theme.primary + "0D" : baseBG,
      })}
    >
      {/* ICON COVER */}
      <View
        style={[
          styles.iconCover,
          {
            backgroundColor: baseBorder,
          },
        ]}
      >
        <Ionicons name={iconName as any} size={22} color={baseIcon} />
      </View>

      {/* TEXT */}
      <View>
        <Text style={[styles.labelText, { color: baseText }]}>
          {type === "sms" ? "Via SMS:" : "Via Email:"}
        </Text>
        <Text style={[styles.authButtonText, { color: baseText }]}>
          {maskedValue}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderRadius: 20,
  },
  iconCover: {
    borderRadius: 50,
    padding: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  authButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  labelText: {
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 5,
  },
});
