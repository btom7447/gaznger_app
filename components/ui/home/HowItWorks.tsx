import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/constants/theme";

const STEPS = [
  { icon: "flame-outline" as const, title: "Pick a fuel", desc: "Select the type and quantity you need" },
  { icon: "location-outline" as const, title: "Set delivery", desc: "Choose your delivery address" },
  { icon: "bicycle-outline" as const, title: "Track in real time", desc: "Rider brings fuel to your door" },
];

export default function HowItWorks() {
  const theme = useTheme();
  const s = styles(theme);

  return (
    <View style={s.container}>
      <Text style={[s.title, { color: theme.text }]}>How it works</Text>
      <View style={s.steps}>
        {STEPS.map((step, i) => (
          <View key={i} style={s.step}>
            <View style={[s.iconWrap, { backgroundColor: theme.tertiary }]}>
              <Ionicons name={step.icon} size={22} color={theme.primary} />
            </View>
            {i < STEPS.length - 1 && (
              <View style={[s.connector, { backgroundColor: theme.ash }]} />
            )}
            <Text style={[s.stepTitle, { color: theme.text }]}>{step.title}</Text>
            <Text style={[s.stepDesc, { color: theme.icon }]}>{step.desc}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: { marginBottom: 24 },
    title: { fontSize: 15, fontWeight: "500", marginBottom: 16 },
    steps: { flexDirection: "row", justifyContent: "space-between" },
    step: { flex: 1, alignItems: "center", position: "relative" },
    iconWrap: {
      width: 52, height: 52, borderRadius: 26,
      justifyContent: "center", alignItems: "center", marginBottom: 10,
    },
    connector: {
      position: "absolute", top: 26, left: "55%",
      width: "90%", height: 2,
    },
    stepTitle: { fontSize: 12, fontWeight: "400", textAlign: "center", marginBottom: 4 },
    stepDesc: { fontSize: 11, fontWeight: "300", textAlign: "center", lineHeight: 16, paddingHorizontal: 4 },
  });
