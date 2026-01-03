import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";

interface NotificationButtonProps {
  count?: number;
  onPress: () => void;
}

export default function NotificationButton({
  count = 0,
  onPress,
}: NotificationButtonProps) {
  const theme = useTheme();

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: theme.background }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons name="notifications-outline" size={22} color={theme.text} />

      {count > 0 && (
        <View style={[styles.badge, { backgroundColor: theme.error }]}>
          {/* <Text style={styles.badgeText}>{count > 9 ? "9+" : count}</Text> */}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 42,
    height: 42,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    shadowColor: "#a0a0a0ff",
    shadowOffset: {
      width: 0,
      height: 0.5,
    },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 5,
  },
  badge: {
    position: "absolute",
    top: 10,
    right: 10,
    // minWidth: 18,
    // height: 18,
    width: 8, 
    height: 8,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "700",
  },
});
