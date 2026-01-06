import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { Modalize } from "react-native-modalize";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useTheme } from "@/constants/theme";

export interface CylinderImageModalHandles {
  open: () => void;
  close: () => void;
}

interface Props {
  onPick: (uri: string) => void;
}

const CylinderImageModal = forwardRef<CylinderImageModalHandles, Props>(
  ({ onPick }, ref) => {
    const theme = useTheme();
    const modalRef = useRef<Modalize>(null);

    useImperativeHandle(ref, () => ({
      open: () => modalRef.current?.open(),
      close: () => modalRef.current?.close(),
    }));

    const compress = async (uri: string) => {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      return result.uri;
    };

    const pickFromGallery = async () => {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission required");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });

      if (result.canceled || !result.assets?.length) return;

      const uri = await compress(result.assets[0].uri);
      modalRef.current?.close();
      onPick(uri);
    };

    const pickFromCamera = async () => {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission required");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 1,
      });

      if (result.canceled || !result.assets?.length) return;

      const uri = await compress(result.assets[0].uri);
      modalRef.current?.close();
      onPick(uri);
    };

    return (
      <Modalize
        ref={modalRef}
        adjustToContentHeight
        handlePosition="inside"
        withHandle
        panGestureEnabled
        modalStyle={{
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
        }}
      >
        <View
          style={{
            paddingHorizontal: 20,
            paddingVertical: 50,
            marginBottom: 0,
          }}
        >
          <Text
            style={{
              fontSize: 20,
              fontWeight: "600",
              color: theme.text,
              textAlign: "center",
              marginBottom: 10,
            }}
          >
            Upload Image
          </Text>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "400",
              color: theme.text,
              marginBottom: 25,
              textAlign: "center",
            }}
          >
            Upload clear image of your cylinder
          </Text>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-evenly",
              gap: 20,
            }}
          >
            <TouchableOpacity
              onPress={pickFromCamera}
              style={{
                marginBottom: 20,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                borderWidth: 2,
                borderColor: theme.quinary,
                borderStyle: "dotted",
                borderRadius: 10,
                padding: 20,
              }}
            >
              <Ionicons name="camera-outline" size={45} color={theme.quinary} />
              {/* <Text
                style={{ fontSize: 18, fontWeight: "300", color: theme.text }}
              >
                Take Photo
              </Text> */}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={pickFromGallery}
              style={{
                marginBottom: 20,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                borderWidth: 2,
                borderColor: theme.quinary,
                borderStyle: "dotted",
                borderRadius: 10,
                padding: 20,
              }}
            >
              <Ionicons name="images-outline" size={45} color={theme.quinary} />
              {/* <Text
                style={{ fontSize: 18, fontWeight: "300", color: theme.text }}
              >
                Choose from Gallery
              </Text> */}
            </TouchableOpacity>
          </View>
        </View>
      </Modalize>
    );
  }
);

export default CylinderImageModal;