import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTheme } from "@/constants/theme";
import BackButton from "@/components/ui/global/BackButton";

const PAYMENT_METHODS = [
  { id: "paystack", label: "Card / Bank Transfer", description: "Pay securely via Paystack", icon: "card-outline" as const },
];

export default function PaymentMethodScreen() {
  const theme = useTheme();
  const s = styles(theme);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <BackButton />
        <Text style={s.headerTitle}>Payment Method</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.body}>
        {PAYMENT_METHODS.map((method) => (
          <View key={method.id} style={[s.methodCard, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
            <View style={[s.iconWrap, { backgroundColor: theme.tertiary }]}>
              <Ionicons name={method.icon} size={24} color={theme.primary} />
            </View>
            <View style={s.methodText}>
              <Text style={[s.methodLabel, { color: theme.text }]}>{method.label}</Text>
              <Text style={[s.methodDesc, { color: theme.icon }]}>{method.description}</Text>
            </View>
            <View style={[s.activeBadge, { backgroundColor: theme.primary + "20" }]}>
              <Text style={[s.activeBadgeText, { color: theme.primary }]}>Active</Text>
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={[s.orderBtn, { backgroundColor: theme.primary }]}
          onPress={() => router.push("/(customer)/(order)" as any)} // eslint-disable-line @typescript-eslint/no-explicit-any
          activeOpacity={0.8}
        >
          <Ionicons name="flash-outline" size={18} color="#fff" />
          <Text style={s.orderBtnText}>Place a New Order</Text>
        </TouchableOpacity>

        <Text style={[s.note, { color: theme.icon }]}>
          Payment is processed securely via Paystack during checkout.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 16, paddingVertical: 12,
    },
    headerTitle: { fontSize: 17, fontWeight: "500", color: theme.text },
    body: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
    methodCard: {
      flexDirection: "row", alignItems: "center", gap: 12,
      padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12,
    },
    iconWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
    methodText: { flex: 1 },
    methodLabel: { fontSize: 14, fontWeight: "500", marginBottom: 2 },
    methodDesc: { fontSize: 12, fontWeight: "300" },
    activeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    activeBadgeText: { fontSize: 11, fontWeight: "500" },
    orderBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 8, paddingVertical: 15, borderRadius: 16, marginTop: 12, marginBottom: 16,
    },
    orderBtnText: { color: "#fff", fontSize: 15, fontWeight: "500" },
    note: { fontSize: 12, fontWeight: "300", textAlign: "center", lineHeight: 18 },
  });
