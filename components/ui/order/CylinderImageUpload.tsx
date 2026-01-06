import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Modal,
  Pressable,
  FlatList,
  Dimensions,
} from "react-native";
import { useTheme } from "@/constants/theme";
import { useOrderStore } from "@/store/useOrderStore";
import { Ionicons } from "@expo/vector-icons";

interface CylinderImageUploadProps {
  openModal: () => void; // now expects a callback
}

export default function CylinderImageUpload({
  openModal,
}: CylinderImageUploadProps) {
  const theme = useTheme();
  const images = useOrderStore((s) => s.order.cylinderImages);
  const removeImage = useOrderStore((s) => s.removeCylinderImage);

  // Fullscreen preview state
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  const openPreview = (index: number) => {
    setPreviewIndex(index);
    setPreviewVisible(true);
  };

  const closePreview = () => {
    setPreviewVisible(false);
  };

  const screenWidth = Dimensions.get("window").width;
  const screenHeight = Dimensions.get("window").height;

  return (
    <View>
      <Text style={styles(theme).label}>Upload Image of Cylinder</Text>
      <View style={{ flexDirection: "row" }}>
        {images.map((img, idx) => (
          <View key={idx} style={styles(theme).imageWrapper}>
            <TouchableOpacity onPress={() => openPreview(idx)}>
              <Image source={{ uri: img }} style={styles(theme).image} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles(theme).removeBtn}
              onPress={() => removeImage(img)}
            >
              <Ionicons name="close-circle" size={20} color={theme.error} />
            </TouchableOpacity>
          </View>
        ))}

        {images.length < 3 && (
          <TouchableOpacity
            style={styles(theme).addImageBtn}
            onPress={openModal}
          >
            <Ionicons name="add-outline" size={40} color={theme.quinary} />
          </TouchableOpacity>
        )}

        {/* Fullscreen Swipe Modal */}
        <Modal visible={previewVisible} transparent={true} animationType="fade">
          <View style={styles(theme).modalBackground}>
            <FlatList
              data={images}
              horizontal
              pagingEnabled
              initialScrollIndex={previewIndex}
              keyExtractor={(_, index) => index.toString()}
              getItemLayout={(_, index) => ({
                length: screenWidth, // width of each item
                offset: screenWidth * index, // position of the item
                index,
              })}
              renderItem={({ item }) => (
                <Image
                  source={{ uri: item }}
                  style={{ width: screenWidth, height: screenHeight }}
                  resizeMode="contain"
                />
              )}
            />
            <Pressable style={styles(theme).closeBtn} onPress={closePreview}>
              <Ionicons name="close" size={30} color={theme.text} />
            </Pressable>
          </View>
        </Modal>
      </View>
    </View>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    label: { fontSize: 20, fontWeight: "600", marginBottom: 10 },
    imageWrapper: {
      position: "relative",
      marginRight: 12,
      borderRadius: 10,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: "#ddd",
    },
    image: { width: 80, height: 80, borderRadius: 10 },
    removeBtn: {
      position: "absolute",
      top: -1,
      right: -1,
      width: 24,
      height: 24,
      alignItems: "center",
      justifyContent: "center",
    },
    addImageBtn: {
      width: 80,
      height: 80,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: theme.quaternary,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.quinest,
    },
    modalBackground: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.95)",
      justifyContent: "center",
      alignItems: "center",
    },
    closeBtn: {
      position: "absolute",
      top: 70,
      right: 30,
      backgroundColor: theme.background,
      borderRadius: 40,
      padding: 1,
    },
  });
