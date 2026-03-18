import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { toast } from "sonner-native";
import { useTheme } from "@/constants/theme";
import BackButton from "@/components/ui/global/BackButton";

export default function SecurityPrivacyScreen() {
  const theme = useTheme();
  const s = styles(theme);

  const ITEMS = [
    {
      id: "password",
      label: "Change Password",
      description: "Update your account password",
      icon: "lock-closed-outline" as const,
      onPress: () => toast.info("Coming soon"),
    },
    {
      id: "biometric",
      label: "Biometric Login",
      description: "Use Face ID or fingerprint",
      icon: "finger-print-outline" as const,
      onPress: () => toast.info("Coming soon"),
    },
    {
      id: "twofa",
      label: "Two-Factor Authentication",
      description: "Extra layer of security",
      icon: "shield-outline" as const,
      onPress: () => toast.info("Coming soon"),
    },
    {
      id: "sessions",
      label: "Active Sessions",
      description: "View and manage device sessions",
      icon: "phone-portrait-outline" as const,
      onPress: () => toast.info("Coming soon"),
    },
    {
      id: "data",
      label: "Data & Privacy",
      description: "Manage your personal data",
      icon: "document-text-outline" as const,
      onPress: () => toast.info("Coming soon"),
    },
    {
      id: "delete",
      label: "Delete Account",
      description: "Permanently remove your account",
      icon: "trash-outline" as const,
      onPress: () => toast.error("This action is irreversible", { description: "Contact support to proceed." }),
      danger: true,
    },
  ];

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle={theme.mode === "dark" ? "light-content" : "dark-content"} />
      <View style={s.header}>
        <BackButton />
        <Text style={s.headerTitle}>Security & Privacy</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {ITEMS.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[s.row, { backgroundColor: theme.surface, borderColor: item.danger ? theme.error + "30" : theme.ash }]}
            onPress={item.onPress}
            activeOpacity={0.75}
          >
            <View style={[s.iconWrap, { backgroundColor: item.danger ? "#FFF0F0" : theme.tertiary }]}>
              <Ionicons name={item.icon} size={20} color={item.danger ? theme.error : theme.primary} />
            </View>
            <View style={s.rowText}>
              <Text style={[s.rowLabel, { color: item.danger ? theme.error : theme.text }]}>{item.label}</Text>
              <Text style={[s.rowDesc, { color: theme.icon }]}>{item.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={item.danger ? theme.error : theme.icon} />
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
    row: {
      flexDirection: "row", alignItems: "center", gap: 12,
      padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 10,
    },
    iconWrap: { width: 38, height: 38, borderRadius: 10, justifyContent: "center", alignItems: "center" },
    rowText: { flex: 1 },
    rowLabel: { fontSize: 14, fontWeight: "400", marginBottom: 2 },
    rowDesc: { fontSize: 12, fontWeight: "300" },
  });
