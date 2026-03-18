import React from "react";
import { ImageBackground, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "@/constants/theme";

interface ProfileCardProps {
  image?: string;
  onPress: () => void;
}

export default function ProfileCard({ image, onPress }: ProfileCardProps) {
  const theme = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.wrapper}
    >
      <ImageBackground
        source={{
          uri: image ?? "https://avatar.iran.liara.run/public/19",
        }}
        style={styles.image}
        imageStyle={styles.imageStyle}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageStyle: {
    borderRadius: 12,
  },
});
