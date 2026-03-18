import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Modal,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { toast } from "sonner-native";
import { useTheme } from "@/constants/theme";
export default function ReceiptScreen() {
  const theme = useTheme();
  const { orderId, totalPrice, fuelName, quantity, unit } = useLocalSearchParams<{
    orderId: string;
    totalPrice: string;
    fuelName: string;
    quantity: string;
    unit: string;
  }>();
  const s = styles(theme);

  const receiptDate = new Date().toLocaleDateString("en-NG", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const handleShare = async () => {
    try {
      await Share.share({
        message:
          `Gaznger Receipt\n` +
          `Order: #${(orderId ?? "").slice(-6).toUpperCase()}\n` +
          `Fuel: ${fuelName} × ${quantity} ${unit}\n` +
          `Total: ₦${Number(totalPrice ?? 0).toLocaleString()}\n` +
          `Date: ${receiptDate}`,
      });
    } catch {}
  };

  const handleDownload = () => {
    toast.success("Receipt saved", { description: "PDF export coming soon" });
  };

  const handleTrackOrder = () => {
    router.replace("/(customer)/(track)" as any); // eslint-disable-line @typescript-eslint/no-explicit-any
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Success icon */}
        <View style={s.successWrap}>
          <View style={[s.successCircle, { backgroundColor: theme.tertiary }]}>
            <Ionicons name="checkmark" size={44} color={theme.primary} />
          </View>
          <Text style={[s.successTitle, { color: theme.text }]}>Order Placed!</Text>
          <Text style={[s.successSub, { color: theme.icon }]}>
            Your fuel delivery is being processed
          </Text>
        </View>

        {/* Receipt card */}
        <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
          {/* Header */}
          <View style={s.cardHeader}>
            <Text style={[s.cardTitle, { color: theme.text }]}>Receipt</Text>
            <View style={[s.paidBadge, { backgroundColor: theme.success + "20" }]}>
              <Text style={[s.paidText, { color: theme.success }]}>Paid</Text>
            </View>
          </View>

          <View style={[s.divider, { backgroundColor: theme.ash }]} />

          <Row label="Order ID" value={`#${(orderId ?? "").slice(-6).toUpperCase()}`} theme={theme} />
          <Row label="Fuel Type" value={fuelName ?? "—"} theme={theme} />
          <Row label="Quantity" value={`${quantity} ${unit}`} theme={theme} />
          <Row label="Date" value={receiptDate} theme={theme} />

          <View style={[s.divider, { backgroundColor: theme.ash }]} />

          <View style={s.totalRow}>
            <Text style={[s.totalLabel, { color: theme.text }]}>Total Paid</Text>
            <Text style={[s.totalValue, { color: theme.primary }]}>
              ₦{Number(totalPrice ?? 0).toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={s.actions}>
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: theme.surface, borderColor: theme.ash }]}
            onPress={handleDownload}
            activeOpacity={0.75}
          >
            <Ionicons name="download-outline" size={20} color={theme.primary} />
            <Text style={[s.actionText, { color: theme.text }]}>Download</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: theme.surface, borderColor: theme.ash }]}
            onPress={handleShare}
            activeOpacity={0.75}
          >
            <Ionicons name="share-outline" size={20} color={theme.primary} />
            <Text style={[s.actionText, { color: theme.text }]}>Share</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Track Order button */}
      <View style={s.footer}>
        <TouchableOpacity style={[s.doneBtn, { backgroundColor: theme.primary }]} onPress={handleTrackOrder}>
          <Ionicons name="navigate-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={s.doneBtnText}>Track Order</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value, theme }: { label: string; value: string; theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10 }}>
      <Text style={{ fontSize: 13, fontWeight: "300", color: theme.icon }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: "400", color: theme.text, flexShrink: 1, textAlign: "right", marginLeft: 16 }}>{value}</Text>
    </View>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20 },
    successWrap: { alignItems: "center", paddingVertical: 24 },
    successCircle: {
      width: 88, height: 88, borderRadius: 44,
      justifyContent: "center", alignItems: "center", marginBottom: 16,
    },
    successTitle: { fontSize: 22, fontWeight: "500", marginBottom: 6 },
    successSub: { fontSize: 14, fontWeight: "300", textAlign: "center", lineHeight: 20 },
    card: {
      borderRadius: 20, borderWidth: 1, padding: 20, marginBottom: 16,
    },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
    cardTitle: { fontSize: 16, fontWeight: "500" },
    paidBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    paidText: { fontSize: 12, fontWeight: "500" },
    divider: { height: 1, marginVertical: 8 },
    totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 4 },
    totalLabel: { fontSize: 15, fontWeight: "400" },
    totalValue: { fontSize: 22, fontWeight: "500" },
    actions: { flexDirection: "row", gap: 12, marginBottom: 12 },
    actionBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 8, paddingVertical: 14, borderRadius: 16, borderWidth: 1,
    },
    actionText: { fontSize: 14, fontWeight: "400" },
    rateBtn: {
      flexDirection: "row", alignItems: "center", gap: 10,
      padding: 16, borderRadius: 16, borderWidth: 1,
    },
    rateBtnText: { flex: 1, fontSize: 14, fontWeight: "400" },
    footer: { padding: 16, paddingBottom: 28 },
    doneBtn: { paddingVertical: 16, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", },
    doneBtnText: { color: "#fff", fontSize: 15, fontWeight: "500" },
  });
