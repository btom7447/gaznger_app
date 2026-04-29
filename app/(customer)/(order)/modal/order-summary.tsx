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
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/constants/theme";
import { useOrderStore } from "@/store/useOrderStore";

export default function OrderSummaryModal({
  visible,
  onClose,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onCancel?: () => void;
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
    <View style={[styles(theme).row, isTotal && { borderBottomWidth: 0, paddingBottom: 0 }]}>
      <Text style={[styles(theme).rowLabel, isTotal && styles(theme).totalText]} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[
          styles(theme).rowValue,
          isTotal && styles(theme).totalText,
          valueColor && { color: valueColor },
        ]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles(theme).overlay}>
        <View style={[styles(theme).card, { backgroundColor: theme.background }]}>
          <View style={styles(theme).handle} />
          <Text style={styles(theme).title}>Order Summary</Text>

          <Row label="Service" value={fuel?.name || "Not selected"} />
          <Row label="Quantity" value={`${quantity} ${fuel?.unit ?? ""}`.trim() || "Not selected"} />

          {fuel?._id === "695688c9be5951e9f5a3fe5f" && (
            <>
              <Row label="Cylinder Type" value={cylinderType || "Not selected"} />
              <Row
                label="Delivery Type"
                value={
                  deliveryType
                    ? deliveryType.split("_").map((w: string) => w[0].toUpperCase() + w.slice(1)).join(" ")
                    : "Not selected"
                }
              />
            </>
          )}

          <Row label="Delivery Location" value={deliveryLabel || "Not selected"} />

          {isCylinderSwap && images.length > 0 && (
            <View style={{ marginTop: 14 }}>
              <Text style={[styles(theme).rowLabel, { marginBottom: 8 }]}>Cylinder Images</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {images.map((img, idx) => (
                  <TouchableOpacity key={idx} onPress={() => openPreview(idx)}>
                    <Image source={{ uri: img }} style={{ width: 72, height: 72, borderRadius: 10 }} />
                  </TouchableOpacity>
                ))}
              </View>

              <Modal visible={previewVisible} transparent animationType="fade">
                <View style={styles(theme).modalBackground}>
                  <FlatList
                    data={images}
                    horizontal
                    pagingEnabled
                    initialScrollIndex={previewIndex}
                    keyExtractor={(_, index) => index.toString()}
                    getItemLayout={(_, index) => ({ length: screenWidth, offset: screenWidth * index, index })}
                    renderItem={({ item }) => (
                      <Image source={{ uri: item }} style={{ width: screenWidth, height: screenHeight }} resizeMode="contain" />
                    )}
                  />
                  <Pressable style={styles(theme).closeBtn} onPress={closePreview}>
                    <Ionicons name="close" size={22} color="#fff" />
                  </Pressable>
                </View>
              </Modal>
            </View>
          )}

          <View style={styles(theme).actions}>
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  "Cancel Order",
                  "Are you sure you want to cancel this order? Your selections will be cleared.",
                  [
                    { text: "Keep Order", style: "cancel" },
                    {
                      text: "Cancel Order",
                      style: "destructive",
                      onPress: () => {
                        useOrderStore.getState().resetOrder();
                        if (onCancel) onCancel();
                        else onClose();
                      },
                    },
                  ]
                );
              }}
              style={styles(theme).cancelBtn}
            >
              <Text style={styles(theme).cancelBtnText}>Cancel Order</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onConfirm} style={styles(theme).confirmBtn}>
              <Text style={styles(theme).confirmBtnText}>Confirm Order</Text>
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
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    card: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: 36,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.ash,
      alignSelf: "center",
      marginBottom: 20,
    },
    title: {
      fontSize: 18,
      fontWeight: "500",
      marginBottom: 8,
      color: theme.text,
      textAlign: "center",
      letterSpacing: -0.2,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 13,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.ash,
    },
    rowLabel: {
      fontSize: 14,
      fontWeight: "300",
      color: theme.icon,
      flex: 1,
    },
    rowValue: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.text,
      flexShrink: 1,
      textAlign: "right",
      marginLeft: 24,
      maxWidth: "55%",
    },
    totalText: {
      fontWeight: "500",
      fontSize: 16,
      color: theme.text,
    },
    actions: {
      flexDirection: "row",
      gap: 12,
      marginTop: 24,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: theme.ash,
      alignItems: "center",
    },
    cancelBtnText: { color: theme.text, fontWeight: "400", fontSize: 14 },
    confirmBtn: {
      flex: 2,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: theme.primary,
      alignItems: "center",
    },
    confirmBtnText: { color: "#fff", fontWeight: "500", fontSize: 14 },
    modalBackground: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.95)",
      justifyContent: "center",
      alignItems: "center",
    },
    closeBtn: {
      position: "absolute",
      top: 56,
      right: 24,
      backgroundColor: "rgba(0,0,0,0.5)",
      borderRadius: 20,
      padding: 8,
    },
  });
