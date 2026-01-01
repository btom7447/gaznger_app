// components/ui/ImgUploader.tsx
import React, { useState } from "react";
import { View, Image, Pressable, StyleSheet, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/constants/theme";

interface ImgUploaderProps {
  imageUri?: string;
  onImageSelected: (uri: string) => void;
  style?: any;
  placeholderImage?: string; // placeholder image URL
}

export default function ImgUploader({
  imageUri,
  onImageSelected,
  style,
  placeholderImage = "https://placehold.net/avatar.png", // default avatar
}: ImgUploaderProps) {
  const theme = useTheme();
  const [localUri, setLocalUri] = useState(imageUri || "");

  const pickImage = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted)
      return alert("Permission required to access photos");

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setLocalUri(uri);
      onImageSelected(uri);
    }
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted)
      return alert("Permission required to use camera");

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: true,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setLocalUri(uri);
      onImageSelected(uri);
    }
  };

  const handlePress = () => {
    Alert.alert(
      "Upload Image",
      "Choose an option",
      [
        { text: "Choose from Gallery", onPress: pickImage },
        { text: "Take a Photo", onPress: takePhoto },
        { text: "Cancel", style: "cancel" },
      ],
      { cancelable: true }
    );
  };

  return (
    <View style={styles.uploadContainer}>
      <Pressable onPress={handlePress} style={[styles.container, style]}>
        <Image
          source={{ uri: localUri || placeholderImage }}
          style={styles.image}
        />

        {/* Camera Icon overlay */}
        <View style={[styles.iconWrapper, { backgroundColor: theme.primary }]}>
          <Ionicons name="camera" size={20} color={"#FFF"} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  uploadContainer: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    width: 150,
    height: 150,
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 100,
    objectFit: "cover",
    overflow: "hidden",
  },
  iconWrapper: {
    position: "absolute",
    bottom: 5,
    right: 5,
    width: 35,
    height: 35,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
});
