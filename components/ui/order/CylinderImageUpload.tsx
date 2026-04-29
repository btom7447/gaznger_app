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
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "@/constants/theme";
import { useOrderStore } from "@/store/useOrderStore";
import { Ionicons } from "@expo/vector-icons";

interface CylinderImageUploadProps {
  openModal: () => void;
  uploading?: boolean;
}

export default function CylinderImageUpload({
  openModal,
  uploading = false,
}: CylinderImageUploadProps) {
  const theme = useTheme();
  const images = useOrderStore((s) => s.order.cylinderImages);
  const removeImage = useOrderStore((s) => s.removeCylinderImage);

  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  const screenWidth = Dimensions.get("window").width;
  const screenHeight = Dimensions.get("window").height;

  return (
    <View>
      <Text style={[s.label, { color: theme.text }]}>
        Upload Cylinder Photos
      </Text>

      {/* <Text style={[s.desc, { color: theme.icon }]}>
        Upload up to 3 photos. First photo will be used as reference.
      </Text> */}

      {/* Preview Row */}
      {images.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.previewContent}
          style={s.previewScroll}
        >
          {images.map((uri, idx) => (
            <View key={uri} style={s.thumbWrap}>
              <TouchableOpacity
                onPress={() => {
                  setPreviewIndex(idx);
                  setPreviewVisible(true);
                }}
              >
                <Image source={{ uri }} style={s.thumb} />
              </TouchableOpacity>

              {/* Cover badge */}
              {idx === 0 && (
                <View
                  style={[s.coverBadge, { backgroundColor: theme.primary }]}
                >
                  <Ionicons name="star" size={10} color="#fff" />
                  <Text style={s.coverText}>Cover</Text>
                </View>
              )}

              {/* Remove */}
              <TouchableOpacity
                style={s.removeBtn}
                onPress={() => removeImage(uri)}
              >
                <Ionicons name="close-circle" size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Upload Button */}
      {images.length < 3 && (
        <TouchableOpacity
          style={[
            s.uploadBtn,
            { borderColor: theme.ash, backgroundColor: theme.surface },
          ]}
          onPress={openModal}
          disabled={uploading}
          activeOpacity={0.8}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <>
              <Ionicons
                name="cloud-upload-outline"
                size={26}
                color={theme.primary}
              />
              <Text style={[s.uploadText, { color: theme.primary }]}>
                {images.length === 0
                  ? "Upload cylinder photos"
                  : "Add another photo"}
              </Text>
              <Text style={[s.uploadHint, { color: theme.icon }]}>
                {images.length}/3 photos
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Fullscreen Preview */}
      <Modal visible={previewVisible} transparent animationType="fade">
        <View style={s.modalBg}>
          <FlatList
            data={images}
            horizontal
            pagingEnabled
            initialScrollIndex={previewIndex}
            keyExtractor={(_, i) => i.toString()}
            getItemLayout={(_, index) => ({
              length: screenWidth,
              offset: screenWidth * index,
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

          <Pressable
            style={s.closeBtn}
            onPress={() => setPreviewVisible(false)}
          >
            <Ionicons name="close" size={30} color="#fff" />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 0.1,
    marginBottom: 10,
  },
  desc: {
    fontSize: 12,
    marginBottom: 12,
  },

  previewScroll: {
    marginBottom: 10,
  },
  previewContent: {
    gap: 10,
  },

  thumbWrap: {
    position: "relative",
  },
  thumb: {
    width: 70,
    height: 70,
    borderRadius: 12,
  },

  coverBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  coverText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "600",
  },

  removeBtn: {
    position: "absolute",
    top: -6,
    right: -6,
  },

  uploadBtn: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  uploadText: {
    fontSize: 13,
    fontWeight: "600",
  },
  uploadHint: {
    fontSize: 11,
  },

  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
  },
  closeBtn: {
    position: "absolute",
    top: 70,
    right: 24,
  },
});
