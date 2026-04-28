import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/constants/theme";

export default function PlantScreen() {
  const theme = useTheme();
  const s = styles(theme);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Plant</Text>
      </View>

      <View style={s.body}>
        <View style={[s.iconWrap, { backgroundColor: theme.primary + "18" }]}>
          <Ionicons name="leaf" size={48} color={theme.primary} />
        </View>

        <Text style={s.title}>Coming Soon</Text>
        <Text style={s.subtitle}>
          Order fuel directly from plants and refineries — at wholesale prices, delivered to your
          station.
        </Text>

        <View style={[s.pill, { backgroundColor: theme.primary + "18", borderColor: theme.primary + "33" }]}>
          <Ionicons name="time-outline" size={14} color={theme.primary} />
          <Text style={[s.pillText, { color: theme.primary }]}>In Development</Text>
        </View>

        <View style={[s.featureList, { borderColor: theme.ash }]}>
          {FEATURES.map((f) => (
            <View key={f} style={s.featureRow}>
              <Ionicons name="checkmark-circle-outline" size={16} color={theme.primary} />
              <Text style={[s.featureText, { color: theme.icon }]}>{f}</Text>
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const FEATURES = [
  "Direct wholesale pricing from refineries",
  "Bulk order management",
  "Delivery scheduling & tracking",
  "Multi-station supply coordination",
];

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    header: { paddingHorizontal: 20, paddingVertical: 14 },
    headerTitle: { fontSize: 22, fontWeight: "700", color: theme.text },

    body: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
      paddingBottom: 60,
      gap: 16,
    },

    iconWrap: {
      width: 96,
      height: 96,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },

    title: {
      fontSize: 26,
      fontWeight: "700",
      color: theme.text,
    },
    subtitle: {
      fontSize: 14,
      color: theme.icon,
      textAlign: "center",
      lineHeight: 22,
    },

    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
    },
    pillText: { fontSize: 12, fontWeight: "600" },

    featureList: {
      width: "100%",
      borderWidth: 1,
      borderRadius: 16,
      padding: 16,
      gap: 12,
      marginTop: 8,
      backgroundColor: theme.surface,
    },
    featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    featureText: { fontSize: 13, flex: 1 },
  });
