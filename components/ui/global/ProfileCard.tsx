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
    width: 42,
    height: 42,
    borderRadius: 10,
    overflow: "hidden",
    shadowColor: "#a0a0a0ff",
    shadowOffset: {
      width: 0,
      height: 0.5,
    },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 5,
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover"
  },
  imageStyle: {
    borderRadius: 10,
  },
});
