import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import SkeletonBox from "@/components/ui/skeletons/SkeletonBox";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/constants/theme";
import { useOrderStore } from "@/store/useOrderStore";
import RedeemModal, { RedeemModalHandles } from "@/components/ui/home/RedeemModal";
import { useSessionStore } from "@/store/useSessionStore";

/**
 * Dummy payment screen — Paystack WebView integration pending.
 * Simulates a brief processing state then navigates to receipt.
 */
export default function PaymentScreen() {
  const theme = useTheme();
  const {
    orderId,
    totalPrice,
    fuelCost,
    deliveryFee,
    fuelName,
    quantity,
    unit,
    stationName,
    deliveryLocation,
    cylinderType,
    deliveryType,
  } = useLocalSearchParams<{
    orderId: string;
    totalPrice: string;
    fuelCost: string;
    deliveryFee: string;
    fuelName: string;
    quantity: string;
    unit: string;
    stationName: string;
    deliveryLocation: string;
    cylinderType: string;
    deliveryType: string;
  }>();

  const insets = useSafeAreaInsets();
  const resetOrder = useOrderStore((s) => s.resetOrder);
  const userPoints = useSessionStore((s) => s.user?.points ?? 0);
  const [processing, setProcessing] = useState(true);
  const [currentTotal, setCurrentTotal] = useState(Number(totalPrice ?? 0));
  const redeemModalRef = useRef<RedeemModalHandles>(null);

  useEffect(() => {
    const t = setTimeout(() => setProcessing(false), 2200);
    return () => clearTimeout(t);
  }, []);

  const handleConfirm = () => {
    resetOrder();
    router.replace({
      pathname: "/(customer)/(order)/receipt" as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      params: {
        orderId,
        totalPrice: String(currentTotal),
        fuelCost,
        deliveryFee,
        fuelName,
        quantity,
        unit,
        stationName,
        deliveryLocation,
        cylinderType,
        deliveryType,
      },
    });
  };

  const handleCancel = () => router.back();

  const s = styles(theme);

  if (processing) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.processingWrap}>
          {/* Receipt card skeleton */}
          <View style={[s.processingCard, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
            <SkeletonBox width={56} height={56} borderRadius={28} style={{ alignSelf: "center", marginBottom: 20 }} />
            <SkeletonBox width="60%" height={14} borderRadius={7} style={{ alignSelf: "center", marginBottom: 10 }} />
            <SkeletonBox width="40%" height={36} borderRadius={10} style={{ alignSelf: "center", marginBottom: 24 }} />
            <SkeletonBox width="100%" height={1} borderRadius={0} style={{ marginBottom: 20 }} />
            {[100, 80, 90, 75].map((w, i) => (
              <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 14 }}>
                <SkeletonBox width={`${w * 0.4}%`} height={12} borderRadius={6} />
                <SkeletonBox width={`${w * 0.45}%`} height={12} borderRadius={6} />
              </View>
            ))}
          </View>
          <Text style={[s.processingTitle, { color: theme.icon }]}>Processing Payment…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isGas = fuelName?.toLowerCase().includes("gas");

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={handleCancel} style={s.closeBtn}>
          <Ionicons name="close" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Confirm Payment</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {/* Amount card */}
        <View style={[s.amountCard, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
          <Text style={[s.amountLabel, { color: theme.icon }]}>Total Amount</Text>
          <Text style={[s.amount, { color: theme.primary }]}>
            ₦{currentTotal.toLocaleString()}
          </Text>
        </View>

        {/* Order details card */}
        <View style={[s.detailCard, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
          <Text style={[s.sectionTitle, { color: theme.text }]}>Order Details</Text>

          <DetailRow label="Order ID" value={`#${(orderId ?? "").slice(-6).toUpperCase()}`} theme={theme} />
          <DetailRow label="Fuel Type" value={fuelName ?? "-"} theme={theme} />
          <DetailRow label="Quantity" value={`${quantity} ${unit}`} theme={theme} />
          <DetailRow label="Station" value={stationName ?? "-"} theme={theme} />

          {!!deliveryLocation && (
            <DetailRow label="Delivery To" value={deliveryLocation} theme={theme} />
          )}

          {isGas && !!cylinderType && (
            <DetailRow label="Cylinder Type" value={cylinderType} theme={theme} />
          )}

          {isGas && !!deliveryType && (
            <DetailRow
              label="Delivery Type"
              value={deliveryType === "cylinder_swap" ? "Cylinder Swap" : "Top Up"}
              theme={theme}
            />
          )}

          <View style={[{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.ash, marginTop: 8, paddingTop: 12 }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 7 }}>
              <Text style={{ fontSize: 13, color: theme.icon, fontWeight: "300" }}>Fuel Cost</Text>
              <Text style={{ fontSize: 13, color: theme.text, fontWeight: "400" }}>₦{Number(fuelCost ?? 0).toLocaleString()}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 7 }}>
              <Text style={{ fontSize: 13, color: theme.icon, fontWeight: "300" }}>Delivery Fee</Text>
              <Text style={{ fontSize: 13, color: theme.text, fontWeight: "400" }}>₦{Number(deliveryFee ?? 0).toLocaleString()}</Text>
            </View>
            {currentTotal < Number(totalPrice ?? 0) && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 7 }}>
                <Text style={{ fontSize: 13, color: theme.success, fontWeight: "300" }}>Points Discount</Text>
                <Text style={{ fontSize: 13, color: theme.success, fontWeight: "400" }}>-₦{(Number(totalPrice ?? 0) - currentTotal).toLocaleString()}</Text>
              </View>
            )}
          </View>

          <View style={[s.totalRow, { borderTopColor: theme.ash }]}>
            <Text style={[s.totalLabel, { color: theme.icon }]}>Total</Text>
            <Text style={[s.totalValue, { color: theme.primary }]}>
              ₦{currentTotal.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Redeem points */}
        {userPoints > 0 && (
          <TouchableOpacity
            style={[s.redeemRow, { backgroundColor: theme.surface, borderColor: theme.ash }]}
            onPress={() => redeemModalRef.current?.open()}
            activeOpacity={0.8}
          >
            <View style={[s.redeemIconWrap, { backgroundColor: theme.accentLight }]}>
              <Ionicons name="star" size={16} color={theme.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.redeemTitle, { color: theme.text }]}>Redeem Points</Text>
              <Text style={[s.redeemSub, { color: theme.icon }]}>
                {userPoints.toLocaleString()} pts available · worth ₦{userPoints.toLocaleString()}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.icon} />
          </TouchableOpacity>
        )}
      </ScrollView>

      <RedeemModal
        ref={redeemModalRef}
        orderId={orderId}
        onRedeemed={(newTotal) => setCurrentTotal(newTotal)}
      />

      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) + 62 }]}>
        <TouchableOpacity style={[s.cancelBtn, { borderColor: theme.ash }]} onPress={handleCancel}>
          <Text style={[s.cancelText, { color: theme.text }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.payBtn, { backgroundColor: theme.primary }]} onPress={handleConfirm}>
          <Ionicons name="lock-closed" size={16} color="#fff" style={{ marginRight: 8 }} />
          <Text style={s.payText}>Pay Now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function DetailRow({ label, value, theme }: { label: string; value: string; theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={detailRowStyles.row}>
      <Text style={[detailRowStyles.label, { color: theme.icon }]}>{label}</Text>
      <Text style={[detailRowStyles.value, { color: theme.text }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const detailRowStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 10 },
  label: { fontSize: 13, fontWeight: "300", flex: 1 },
  value: { fontSize: 13, fontWeight: "400", flex: 1.5, textAlign: "right" },
});

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    processingWrap: { flex: 1, justifyContent: "center", padding: 24, gap: 16 },
    processingCard: { borderRadius: 20, borderWidth: 1, padding: 24 },
    processingTitle: { fontSize: 14, fontWeight: "300", textAlign: "center" },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 16, paddingVertical: 14,
    },
    closeBtn: { width: 40, alignItems: "flex-start" },
    headerTitle: { fontSize: 17, fontWeight: "500", color: theme.text },
    body: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
    amountCard: {
      borderRadius: 20, borderWidth: 1, padding: 24,
    },
    amountLabel: { fontSize: 13, fontWeight: "300", marginBottom: 6 },
    amount: { fontSize: 36, fontWeight: "500" },
    detailCard: {
      borderRadius: 20, borderWidth: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
    },
    sectionTitle: { fontSize: 15, fontWeight: "500", marginBottom: 8 },
    totalRow: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      marginTop: 8, paddingTop: 14, paddingBottom: 12, borderTopWidth: 1,
    },
    totalLabel: { fontSize: 14, fontWeight: "300" },
    totalValue: { fontSize: 18, fontWeight: "500" },
    discountNote: { fontSize: 12, fontWeight: "300", marginTop: 4 },
    redeemRow: {
      flexDirection: "row", alignItems: "center", gap: 12,
      padding: 14, borderRadius: 16, borderWidth: 1,
    },
    redeemIconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
    redeemTitle: { fontSize: 14, fontWeight: "400" },
    redeemSub: { fontSize: 12, fontWeight: "300", marginTop: 2 },
    footer: {
      flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingTop: 16,
      borderTopWidth: 1, borderTopColor: theme.ash,
    },
    cancelBtn: {
      flex: 1, paddingVertical: 15, borderRadius: 16, borderWidth: 1,
      alignItems: "center", justifyContent: "center",
    },
    cancelText: { fontSize: 15, fontWeight: "400" },
    payBtn: {
      flex: 2, flexDirection: "row", paddingVertical: 15,
      borderRadius: 16, alignItems: "center", justifyContent: "center",
    },
    payText: { color: "#fff", fontSize: 15, fontWeight: "500" },
  });
