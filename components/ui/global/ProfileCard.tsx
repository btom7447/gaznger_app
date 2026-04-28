import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "@/constants/theme";
import Avatar from "./Avatar";

interface ProfileCardProps {
  image?: string | null;
  initials?: string;
  onPress: () => void;
}

export default function ProfileCard({ image, initials, onPress }: ProfileCardProps) {
  const theme = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.wrapper, { backgroundColor: theme.surface }]}
    >
      <Avatar uri={image} initials={initials} size={40} radius={12} icon="person-circle-outline" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: 40, height: 40, borderRadius: 12, overflow: "hidden" },
});
