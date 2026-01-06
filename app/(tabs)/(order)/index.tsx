import React, { useRef } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { useTheme } from "@/constants/theme";
import { useOrderStore } from "@/store/useOrderStore";
import { useSessionStore } from "@/store/useSessionStore";
import { MIN_QUANTITY } from "@/constants/orderOptions";

import HomeHeader from "@/components/ui/home/HomeHeader";
import OrderProgressBar from "@/components/ui/global/OrderProgressBar";
import SelectService from "@/components/ui/order/SelectService";
import QuantitySelect from "@/components/ui/order/QuantitySelect";
import CylinderTypeSelect from "@/components/ui/order/CylinderTypeSelect";
import DeliveryTypeSelect from "@/components/ui/order/DeliveryTypeSelect";
import DeliveryLocationSelect from "@/components/ui/order/DeliveryLocationSelect";
import OrderSummaryModal from "./modal/order-summary";

import CylinderImageModal, {
  CylinderImageModalHandles,
} from "@/components/ui/order/CylinderImageModa";
import CylinderImageUpload from "@/components/ui/order/CylinderImageUpload";
import { router } from "expo-router";

const isGasFuel = (fuel: any) =>
  !!fuel && fuel.name.toLowerCase().includes("gas");

export default function OrderScreen() {
  const theme = useTheme();
  const user = useSessionStore((s) => s.user);

  const {
    fuel,
    quantity,
    cylinderType,
    deliveryType,
    cylinderImages,
    deliveryAddressId,
  } = useOrderStore((s) => s.order);

  const canContinue = useOrderStore((s) => s.canContinue);
  const canEditOrder = useOrderStore((s) => s.canEditOrder());

  const modalRef = useRef<CylinderImageModalHandles>(null);
  const addImage = useOrderStore((s) => s.addCylinderImage);

  const [showSummary, setShowSummary] = React.useState(false);

  const handlePick = (uri: string) => {
    addImage(uri);
  };

  const handleContinue = () => {
    const orderState = useOrderStore.getState();
    if (!orderState.canContinue()) {
      const { fuel, quantity } = orderState.order;
      const minQty = MIN_QUANTITY[fuel?.name.toLowerCase() || ""] || 0;

      Toast.show({
        type: "error",
        text1: "Cannot continue",
        text2:
          quantity < minQty
            ? `Minimum order for ${fuel?.name} is ${minQty} ${fuel?.unit}`
            : "Please complete all required fields",
      });
      return;
    }

    // ✅ valid → show summary modal
    setShowSummary(true);
  };


  const handleConfirmOrder = () => {
    setShowSummary(false);
    useOrderStore.getState().setProgressStep(1); // move to payment
    router.push("/(tabs)/(order)/stations")
  };

  // console.log("User Data", user)
  console.log("ORDER STATE", useOrderStore.getState().order);
  // console.log("canContinue", canContinue());

  return (
    <SafeAreaView style={styles(theme).safeArea}>
      <HomeHeader variant="order" user={user} />
      <OrderProgressBar />

      <ScrollView
        contentContainerStyle={styles(theme).scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SelectService />
        <QuantitySelect />

        {isGasFuel(fuel) && (
          <>
            <CylinderTypeSelect />
            <DeliveryTypeSelect />

            {deliveryType === "cylinder_swap" && (
              <CylinderImageUpload openModal={() => modalRef.current?.open()} />
            )}
          </>
        )}

        <DeliveryLocationSelect />

        <TouchableOpacity
          onPress={handleContinue}
          style={[
            styles(theme).continueBtn,
            {
              backgroundColor: canContinue() ? theme.quaternary : theme.icon,
              opacity: canContinue() ? 1 : 0.5,
            },
          ]}
        >
          <Text style={styles(theme).continueText}>Continue</Text>
        </TouchableOpacity>
      </ScrollView>

      <CylinderImageModal ref={modalRef} onPick={handlePick} />

      <OrderSummaryModal
        visible={showSummary}
        onClose={() => setShowSummary(false)}
        onConfirm={handleConfirmOrder}
      />
    </SafeAreaView>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      paddingHorizontal: 10,
      paddingTop: 10,
      backgroundColor: theme.background,
    },
    scrollContent: {
      paddingTop: 10,
      paddingBottom: 20,
    },
    continueBtn: {
      marginTop: "auto",
      padding: 18,
      borderRadius: 10,
      alignItems: "center",
    },
    continueText: {
      color: "#FFF",
      fontWeight: "600",
      fontSize: 18,
    },
  });