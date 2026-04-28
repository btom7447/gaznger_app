import React, { useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ImageSourcePropType,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { toast } from "sonner-native";
import NotificationButton from "@/components/ui/global/NotificationButton";
import ProfileCard from "@/components/ui/global/ProfileCard";
import { useSessionStore } from "@/store/useSessionStore";

import { useTheme } from "@/constants/theme";
import { useOrderStore } from "@/store/useOrderStore";

import OrderProgressBar from "@/components/ui/global/OrderProgressBar";
import DeliveryLocationSelect from "@/components/ui/order/DeliveryLocationSelect";
import OrderSummaryModal from "./modal/order-summary";

const FUEL_LOCAL_ICON: Record<string, ImageSourcePropType> = {
  petrol: require("../../../assets/icons/fuel/petrol-icon.png"),
  diesel: require("../../../assets/icons/fuel/diesel-icon.png"),
  gas:    require("../../../assets/icons/fuel/gas-icon.png"),
  oil:    require("../../../assets/icons/fuel/oil-icon.png"),
};

export default function DeliveryScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const user = useSessionStore((s) => s.user);
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
  const fuelKey = fuel?.name?.toLowerCase() ?? "";
  const localIcon = FUEL_LOCAL_ICON[fuelKey] ?? FUEL_LOCAL_ICON.petrol;

  // Build order recap chips
  const recapChips: string[] = [];
  if (fuel?.name) recapChips.push(fuel.name);
  if (quantity && fuel?.unit) recapChips.push(`${quantity} ${fuel.unit}`);
  if (cylinderType) recapChips.push(cylinderType);
  if (deliveryType) recapChips.push(deliveryType === "cylinder_swap" ? "Swap" : "Top Up");

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={[s.backBtn, { borderColor: theme.ash }]}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerSub, { color: theme.icon }]}>Step 2 of 3</Text>
          <Text style={[s.headerTitle, { color: theme.text }]}>
            Delivery Details
          </Text>
        </View>
        <View style={s.headerRight}>
          <NotificationButton onPress={() => router.push("/(screens)/notification" as any)} />
          <ProfileCard
            image={user?.profileImage}
            initials={user?.displayName?.split(" ").map((w) => w[0]).join("").slice(0, 2)}
            onPress={() => router.push("/(screens)/profile" as any)}
          />
        </View>
      </View>

      <OrderProgressBar />

      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Compact order recap row */}
        <View
          style={[
            s.recapRow,
            { backgroundColor: theme.surface, borderColor: theme.ash },
          ]}
        >
          <View style={[s.recapIconWrap, { backgroundColor: theme.tertiary }]}>
            <Image
              source={fuel?.icon ? { uri: fuel.icon } : localIcon}
              style={s.recapIcon}
              resizeMode="contain"
            />
          </View>
          <View style={s.recapChips}>
            {recapChips.map((chip, i) => (
              <React.Fragment key={chip}>
                <Text style={[s.recapChipText, { color: theme.text }]}>
                  {chip}
                </Text>
                {i < recapChips.length - 1 && (
                  <Text style={[s.recapDot, { color: theme.ash }]}>·</Text>
                )}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Divider */}
        <View style={[s.divider, { backgroundColor: theme.ash }]} />

        {/* Delivery address section */}
        <DeliveryLocationSelect />
      </ScrollView>

      {/* Fixed CTA — paddingBottom clears floating pill tab bar */}
      <View
        style={[
          s.ctaBar,
          { borderTopColor: theme.ash, backgroundColor: theme.background, paddingBottom: Math.max(insets.bottom, 12) + 62 },
        ]}
      >
        <TouchableOpacity
          onPress={handleReview}
          style={[
            s.continueBtn,
            { backgroundColor: theme.primary, opacity: canReview ? 1 : 0.4 },
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
      alignItems: "center",
      justifyContent: "center",
    },
    headerSub: { fontSize: 11, fontWeight: "300", marginBottom: 1 },
    headerTitle: { fontSize: 20, fontWeight: "600" },
    headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
    scrollContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 },
    title: {
      fontSize: 13,
      fontWeight: "500",
      marginBottom: 12,
      letterSpacing: 0.1,
    },
    // Recap row
    recapRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      marginBottom: 20,
    },
    recapIconWrap: {
      width: 52,
      height: 52,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    recapIcon: { width: 38, height: 38 },
    recapChips: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 4,
    },
    recapChipText: { fontSize: 13, fontWeight: "500" },
    recapDot: { fontSize: 14, fontWeight: "300" },
    payBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 },
    payBadgeText: { fontSize: 11, fontWeight: "600", color: "#22C55E" },

    divider: { height: StyleSheet.hairlineWidth, marginBottom: 20 },

    sectionLabel: {
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 0.9,
      textTransform: "uppercase",
      marginBottom: 12,
    },

    ctaBar: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: 1,
    },
    continueBtn: {
      paddingVertical: 16,
      borderRadius: 16,
      alignItems: "center",
    },
    continueText: { color: "#fff", fontWeight: "500", fontSize: 16 },
  });
