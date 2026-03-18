import React, { useRef, useCallback } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { toast } from "sonner-native";
import { router, useFocusEffect } from "expo-router";

import { useTheme } from "@/constants/theme";
import { useOrderStore } from "@/store/useOrderStore";
import { useSessionStore } from "@/store/useSessionStore";
import { MIN_QUANTITY } from "@/constants/orderOptions";

import NotificationButton from "@/components/ui/global/NotificationButton";
import ProfileCard from "@/components/ui/global/ProfileCard";
import OrderProgressBar from "@/components/ui/global/OrderProgressBar";
import SelectService from "@/components/ui/order/SelectService";
import QuantitySelect from "@/components/ui/order/QuantitySelect";
import CylinderTypeSelect from "@/components/ui/order/CylinderTypeSelect";
import DeliveryTypeSelect from "@/components/ui/order/DeliveryTypeSelect";
import CylinderImageModal, { CylinderImageModalHandles } from "@/components/ui/order/CylinderImageModa";
import CylinderImageUpload from "@/components/ui/order/CylinderImageUpload";

const isGasFuel = (fuel: any) => !!fuel && fuel.name.toLowerCase().includes("gas");

export default function OrderScreen() {
  const theme = useTheme();
  const user = useSessionStore((s) => s.user);

  const { fuel, quantity, deliveryType } = useOrderStore((s) => s.order);
  const canContinue = useOrderStore((s) => s.canContinue);

  const modalRef = useRef<CylinderImageModalHandles>(null);
  const addImage = useOrderStore((s) => s.addCylinderImage);

  // Guard: if user left mid-flow (tab-switch) and returns, restore their position
  useFocusEffect(useCallback(() => {
    const step = useOrderStore.getState().progressStep;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (step === 1) router.replace("/(customer)/(order)/delivery" as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    else if (step === 2) router.replace("/(customer)/(order)/stations" as any);
  }, []));

  const handleContinue = () => {
    const orderState = useOrderStore.getState();
    if (!orderState.canContinue()) {
      const { fuel, quantity } = orderState.order;
      const minQty = MIN_QUANTITY[fuel?.name.toLowerCase() || ""] || 0;
      toast.error("Cannot continue", {
        description:
          quantity < minQty
            ? `Minimum order for ${fuel?.name} is ${minQty} ${fuel?.unit}`
            : "Please complete all required fields",
      });
      return;
    }
    useOrderStore.getState().setProgressStep(1);
    router.push("/(customer)/(order)/delivery" as any); // eslint-disable-line @typescript-eslint/no-explicit-any
  };

  const s = styles(theme);

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerSub}>New Order</Text>
          <Text style={s.headerTitle}>{fuel ? fuel.name : "Order Fuel"}</Text>
        </View>
        <View style={s.headerRight}>
          <NotificationButton onPress={() => router.push("/(screens)/notification")} />
          <ProfileCard
            image={user?.profileImage}
            onPress={() => router.push("/(screens)/profile")}
          />
        </View>
      </View>

      <OrderProgressBar />

      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
      </ScrollView>

      {/* Fixed CTA */}
      <View style={s.ctaBar}>
        <TouchableOpacity
          onPress={handleContinue}
          style={[
            s.continueBtn,
            {
              backgroundColor: canContinue() ? theme.primary : theme.ash,
              opacity: canContinue() ? 1 : 0.7,
            },
          ]}
          activeOpacity={0.85}
        >
          <Text style={s.continueText}>
            {canContinue() ? "Next" : "Complete All Fields"}
          </Text>
        </TouchableOpacity>
      </View>

      <CylinderImageModal ref={modalRef} onPick={(uri) => addImage(uri)} />
    </SafeAreaView>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6,
    },
    headerSub: { fontSize: 12, fontWeight: "300", color: theme.icon, marginBottom: 2 },
    headerTitle: { fontSize: 22, fontWeight: "500", color: theme.text },
    headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
    scrollContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16 },
    ctaBar: {
      paddingHorizontal: 16, paddingVertical: 12,
      borderTopWidth: 1, borderTopColor: theme.ash,
      backgroundColor: theme.background,
    },
    continueBtn: {
      paddingVertical: 16, borderRadius: 16, alignItems: "center",
    },
    continueText: { color: "#fff", fontWeight: "500", fontSize: 16 },
  });
