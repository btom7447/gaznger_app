import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/constants/theme";
import BackButton from "@/components/ui/global/BackButton";

const FAQS = [
  { q: "How do I place a fuel order?", a: "Tap a fuel type on the home screen, fill in quantity and delivery details, then confirm your order." },
  { q: "How long does delivery take?", a: "Typical delivery is 30–60 minutes depending on your location and station distance." },
  { q: "Can I cancel an order?", a: "Yes — go to Order History and tap Cancel on any pending order before it is confirmed." },
  { q: "How do Gaznger Points work?", a: "You earn points on every successful delivery. Points can be redeemed for discounts on future orders." },
  { q: "What payment methods are accepted?", a: "We currently support card payments via Paystack. More options coming soon." },
];

export default function HelpSupportScreen() {
  const theme = useTheme();
  const [expanded, setExpanded] = useState<number | null>(null);
  const s = styles(theme);

  const CONTACT = [
    { id: "email", label: "Email Support", value: "support@gaznger.com", icon: "mail-outline" as const, onPress: () => Linking.openURL("mailto:support@gaznger.com") },
    { id: "chat", label: "Live Chat", value: "Chat with an agent", icon: "chatbubbles-outline" as const, onPress: () => {} },
    { id: "call", label: "Call Us", value: "+234 800 000 0000", icon: "call-outline" as const, onPress: () => Linking.openURL("tel:+2348000000000") },
  ];

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle={theme.mode === "dark" ? "light-content" : "dark-content"} />
      <View style={s.header}>
        <BackButton />
        <Text style={s.headerTitle}>Help & Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Contact options */}
        <Text style={s.sectionTitle}>Contact Us</Text>
        {CONTACT.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[s.row, { backgroundColor: theme.surface, borderColor: theme.ash }]}
            onPress={item.onPress}
            activeOpacity={0.75}
          >
            <View style={[s.iconWrap, { backgroundColor: theme.tertiary }]}>
              <Ionicons name={item.icon} size={20} color={theme.primary} />
            </View>
            <View style={s.rowText}>
              <Text style={[s.rowLabel, { color: theme.text }]}>{item.label}</Text>
              <Text style={[s.rowDesc, { color: theme.icon }]}>{item.value}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.icon} />
          </TouchableOpacity>
        ))}

        {/* FAQs */}
        <Text style={[s.sectionTitle, { marginTop: 24 }]}>FAQs</Text>
        {FAQS.map((faq, i) => (
          <TouchableOpacity
            key={i}
            style={[s.faqCard, { backgroundColor: theme.surface, borderColor: theme.ash }]}
            onPress={() => setExpanded(expanded === i ? null : i)}
            activeOpacity={0.75}
          >
            <View style={s.faqHeader}>
              <Text style={[s.faqQ, { color: theme.text, flex: 1 }]}>{faq.q}</Text>
              <Ionicons
                name={expanded === i ? "chevron-up" : "chevron-down"}
                size={16}
                color={theme.icon}
              />
            </View>
            {expanded === i && (
              <Text style={[s.faqA, { color: theme.icon }]}>{faq.a}</Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
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
    scroll: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32 },
    sectionTitle: {
      fontSize: 12, fontWeight: "400", color: theme.icon,
      marginBottom: 10, paddingLeft: 2,
      textTransform: "uppercase", letterSpacing: 0.8,
    },
    row: {
      flexDirection: "row", alignItems: "center", gap: 12,
      padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 10,
    },
    iconWrap: { width: 38, height: 38, borderRadius: 10, justifyContent: "center", alignItems: "center" },
    rowText: { flex: 1 },
    rowLabel: { fontSize: 14, fontWeight: "400", marginBottom: 2 },
    rowDesc: { fontSize: 12, fontWeight: "300" },
    faqCard: {
      padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 10,
    },
    faqHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    faqQ: { fontSize: 14, fontWeight: "400", lineHeight: 20 },
    faqA: { fontSize: 13, fontWeight: "300", lineHeight: 20, marginTop: 10 },
  });
