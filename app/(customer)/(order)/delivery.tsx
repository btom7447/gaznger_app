import React, { useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { toast } from "sonner-native";

import { useTheme } from "@/constants/theme";
import { useOrderStore } from "@/store/useOrderStore";

import OrderProgressBar from "@/components/ui/global/OrderProgressBar";
import DeliveryLocationSelect from "@/components/ui/order/DeliveryLocationSelect";
import OrderSummaryModal from "./modal/order-summary";

export default function DeliveryScreen() {
  const theme = useTheme();
  const { fuel, quantity, cylinderType, deliveryType, deliveryAddressId } =
    useOrderStore((s) => s.order);

  const [showSummary, setShowSummary] = useState(false);

  const canReview = !!deliveryAddressId;

  const handleReview = () => {
    if (!canReview) {
      toast.error("Select a delivery address", {
        description: "Choose where you'd like the fuel delivered",
      });
      return;
    }
    setShowSummary(true);
  };

  const handleConfirmOrder = () => {
    setShowSummary(false);
    useOrderStore.getState().setProgressStep(2);
    router.push("/(customer)/(order)/stations" as any); // eslint-disable-line @typescript-eslint/no-explicit-any
  };

  const handleBack = () => {
    useOrderStore.getState().setProgressStep(0);
    router.back();
  };

  const s = styles(theme);

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={handleBack} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerSub}>Delivery Details</Text>
          <Text style={s.headerTitle}>{fuel?.name ?? "Order Fuel"}</Text>
        </View>
      </View>

      <OrderProgressBar />

      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Order summary row */}
        <View style={[s.summaryCard, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
          <Text style={[s.summaryTitle, { color: theme.text }]}>Your Order</Text>
          <SummaryRow label="Fuel" value={fuel?.name ?? "—"} theme={theme} />
          <SummaryRow label="Quantity" value={`${quantity} ${fuel?.unit ?? ""}`.trim()} theme={theme} />
          {cylinderType && <SummaryRow label="Cylinder" value={cylinderType} theme={theme} />}
          {deliveryType && (
            <SummaryRow
              label="Delivery"
              value={deliveryType.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")}
              theme={theme}
            />
          )}
        </View>

        <DeliveryLocationSelect />
      </ScrollView>

      {/* Fixed CTA */}
      <View style={s.ctaBar}>
        <TouchableOpacity
          onPress={handleReview}
          style={[
            s.continueBtn,
            {
              backgroundColor: canReview ? theme.primary : theme.ash,
              opacity: canReview ? 1 : 0.7,
            },
          ]}
          activeOpacity={0.85}
        >
          <Text style={s.continueText}>
            {canReview ? "Review Order" : "Select Delivery Address"}
          </Text>
        </TouchableOpacity>
      </View>

      <OrderSummaryModal
        visible={showSummary}
        onClose={() => setShowSummary(false)}
        onConfirm={handleConfirmOrder}
        onCancel={() => {
          setShowSummary(false);
          router.replace("/(customer)/(order)" as any); // eslint-disable-line @typescript-eslint/no-explicit-any
        }}
      />
    </SafeAreaView>
  );
}

function SummaryRow({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
      <Text style={{ fontSize: 13, color: theme.icon, fontWeight: "300" }}>{label}</Text>
      <Text style={{ fontSize: 13, color: theme.text, fontWeight: "400" }}>{value}</Text>
    </View>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 6,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.ash,
      alignItems: "center",
      justifyContent: "center",
    },
    headerSub: { fontSize: 12, fontWeight: "300", color: theme.icon, marginBottom: 1 },
    headerTitle: { fontSize: 20, fontWeight: "500", color: theme.text },
    scrollContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16 },
    summaryCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 16,
      marginBottom: 16,
    },
    summaryTitle: { fontSize: 14, fontWeight: "500", marginBottom: 8 },
    ctaBar: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: theme.ash,
      backgroundColor: theme.background,
    },
    continueBtn: {
      paddingVertical: 16,
      borderRadius: 16,
      alignItems: "center",
    },
    continueText: { color: "#fff", fontWeight: "500", fontSize: 16 },
  });
