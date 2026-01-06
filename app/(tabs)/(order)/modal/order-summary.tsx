import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  FlatList,
  Dimensions,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/constants/theme";
import { useOrderStore } from "@/store/useOrderStore";

export default function OrderSummaryModal({
  visible,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const theme = useTheme();
  const { order } = useOrderStore();
  const { fuel, quantity, cylinderType, deliveryType, deliveryLabel } = order;
  const images = useOrderStore((s) => s.order.cylinderImages);

  const isCylinderSwap = deliveryType === "cylinder_swap";

  // Fullscreen preview state
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const screenWidth = Dimensions.get("window").width;
  const screenHeight = Dimensions.get("window").height;

  const openPreview = (index: number) => {
    setPreviewIndex(index);
    setPreviewVisible(true);
  };
  const closePreview = () => setPreviewVisible(false);

  const Row = ({ label, value, isTotal, valueColor }: any) => (
    <View style={[styles(theme).row, isTotal && { marginTop: 10 }]}>
      <Text style={[styles(theme).label, isTotal && styles(theme).totalText]}>
        {label}
      </Text>
      <Text
        style={[
          styles(theme).rowValue,
          isTotal && styles(theme).totalText,
          valueColor && { color: valueColor },
        ]}
      >
        {value}
      </Text>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles(theme).overlay}>
        <View
          style={[styles(theme).card, { backgroundColor: theme.background }]}
        >
          <Text style={styles(theme).title}>Order Summary</Text>

          <Row
            style={[styles(theme).row, {}]}
            label="Service"
            value={fuel?.name || "Not selected"}
          />
          <Row
            style={[styles(theme).row, {}]}
            label="Quantity"
            value={`${quantity} ${fuel?.unit} `|| "Not selected"}
          />

          {fuel?._id === "695688c9be5951e9f5a3fe5f" && (
            <>
              <Row
                label="Cylinder Type"
                value={cylinderType || "Not selected"}
              />
              <Row
                label="Delivery Type"
                value={
                  deliveryType
                    ? deliveryType
                        .split("_")
                        .map((w) => w[0].toUpperCase() + w.slice(1))
                        .join(" ")
                    : "Not selected"
                }
              />
            </>
          )}

          <Row
            label="Delivery Location"
            value={deliveryLabel || "Not selected"}
          />

          {/* Cylinder Image Preview for cylinder_swap */}
          {isCylinderSwap && images.length > 0 && (
            <View style={{ marginTop: 15 }}>
              <Text style={[styles(theme).label, { marginBottom: 8 }]}>
                Cylinder Images
              </Text>
              <View style={{ flexDirection: "row" }}>
                {images.map((img, idx) => (
                  <TouchableOpacity key={idx} onPress={() => openPreview(idx)}>
                    <Image
                      source={{ uri: img }}
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: 8,
                        marginRight: 10,
                      }}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Fullscreen swipe preview */}
              <Modal visible={previewVisible} transparent animationType="fade">
                <View style={styles(theme).modalBackground}>
                  <FlatList
                    data={images}
                    horizontal
                    pagingEnabled
                    initialScrollIndex={previewIndex}
                    keyExtractor={(_, index) => index.toString()}
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
                    style={styles(theme).closeBtn}
                    onPress={closePreview}
                  >
                    <Ionicons name="close" size={30} color={theme.text} />
                  </Pressable>
                </View>
              </Modal>
            </View>
          )}

          <View style={styles(theme).actions}>
            <TouchableOpacity onPress={onClose} style={styles(theme).cancelBtn}>
              <Text style={{ color: theme.text }}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onConfirm}
              style={styles(theme).confirmBtn}
            >
              <Text style={{ color: "#fff" }}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      padding: 20,
    },
    card: {
      borderRadius: 20,
      padding: 20,
    },
    title: {
      fontSize: 18,
      fontWeight: "600",
      marginBottom: 8,
      color: theme.text,
      textAlign: "center",
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 0,
      paddingVertical: 15,
      borderBottomWidth: 1, 
      borderBottomColor: theme.ash,
    },
    label: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.text,
    },
    rowValue: {
      fontSize: 16,
      fontWeight: "400",
      color: theme.text,
    },
    totalText: {
      fontWeight: "700",
      fontSize: 18,
    },
    actions: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 25,
    },
    cancelBtn: {
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.quaternary,
      backgroundColor: theme.quinest,
    },
    confirmBtn: {
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 10,
      backgroundColor: theme.quaternary,
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
      backgroundColor: "#fff",
      borderRadius: 40,
      padding: 1,
    },
  });
