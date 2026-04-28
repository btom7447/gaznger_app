import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/constants/theme";
import { useThemeStore, ColorSchemeOverride } from "@/store/useThemeStore";
import BackButton from "@/components/ui/global/BackButton";
import { toast } from "sonner-native";

interface ToggleSetting {
  id: string;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: boolean;
}

type ThemeOption = { value: ColorSchemeOverride; label: string; icon: keyof typeof Ionicons.glyphMap };

const THEME_OPTIONS: ThemeOption[] = [
  { value: "light", label: "Light", icon: "sunny-outline" },
  { value: "system", label: "Auto", icon: "phone-portrait-outline" },
  { value: "dark", label: "Dark", icon: "moon-outline" },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const { colorScheme, setColorScheme } = useThemeStore();

  const [settings, setSettings] = useState<Record<string, boolean>>({
    pushNotifications: true,
    emailNotifications: false,
    smsNotifications: true,
    locationServices: true,
  });

  const toggle = (key: string) =>
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));

  const ITEMS: ToggleSetting[] = [
    { id: "pushNotifications", label: "Push Notifications", description: "Order updates and alerts", icon: "notifications-outline", value: settings.pushNotifications },
    { id: "emailNotifications", label: "Email Notifications", description: "Receipts and promotions", icon: "mail-outline", value: settings.emailNotifications },
    { id: "smsNotifications", label: "SMS Notifications", description: "Delivery alerts via SMS", icon: "chatbubble-outline", value: settings.smsNotifications },
    { id: "locationServices", label: "Location Services", description: "For finding nearby stations", icon: "location-outline", value: settings.locationServices },
  ];

  const s = styles(theme);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle={theme.mode === "dark" ? "light-content" : "dark-content"} />
      <View style={s.header}>
        <BackButton />
        <Text style={s.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Appearance ─────────────────────────────────────── */}
        <Text style={s.sectionTitle}>Appearance</Text>
        <View style={[s.appearanceCard, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
          <View style={s.appearanceRow}>
            <View style={[s.iconWrap, { backgroundColor: theme.tertiary }]}>
              <Ionicons name="color-palette-outline" size={20} color={theme.primary} />
            </View>
            <View style={s.rowText}>
              <Text style={[s.rowLabel, { color: theme.text }]}>Theme</Text>
              <Text style={[s.rowDesc, { color: theme.icon }]}>
                {colorScheme === "system" ? "Follows device setting" : colorScheme === "dark" ? "Always dark" : "Always light"}
              </Text>
            </View>
          </View>
          <View style={[s.segmentRow, { backgroundColor: theme.background, borderColor: theme.ash }]}>
            {THEME_OPTIONS.map((opt) => {
              const active = colorScheme === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    s.segmentBtn,
                    active && { backgroundColor: theme.primary },
                  ]}
                  onPress={() => setColorScheme(opt.value)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={opt.icon}
                    size={16}
                    color={active ? "#fff" : theme.icon}
                  />
                  <Text style={[s.segmentLabel, { color: active ? "#fff" : theme.icon }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Notifications ──────────────────────────────────── */}
        <Text style={[s.sectionTitle, { marginTop: 24 }]}>Notifications</Text>
        {ITEMS.map((item) => (
          <View key={item.id} style={[s.row, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
            <View style={[s.iconWrap, { backgroundColor: theme.tertiary }]}>
              <Ionicons name={item.icon} size={20} color={theme.primary} />
            </View>
            <View style={s.rowText}>
              <Text style={[s.rowLabel, { color: theme.text }]}>{item.label}</Text>
              <Text style={[s.rowDesc, { color: theme.icon }]}>{item.description}</Text>
            </View>
            <Switch
              value={item.value}
              onValueChange={() => toggle(item.id)}
              trackColor={{ false: theme.ash, true: theme.primary + "99" }}
              thumbColor={item.value ? theme.primary : theme.icon}
            />
          </View>
        ))}

        {/* ── App ────────────────────────────────────────────── */}
        <Text style={[s.sectionTitle, { marginTop: 24 }]}>App</Text>
        <TouchableOpacity
          style={[s.row, { backgroundColor: theme.surface, borderColor: theme.ash }]}
          onPress={() => toast.info("Language", { description: "Multi-language support is coming soon" })}
          activeOpacity={0.75}
        >
          <View style={[s.iconWrap, { backgroundColor: theme.tertiary }]}>
            <Ionicons name="language-outline" size={20} color={theme.primary} />
          </View>
          <View style={s.rowText}>
            <Text style={[s.rowLabel, { color: theme.text }]}>Language</Text>
            <Text style={[s.rowDesc, { color: theme.icon }]}>English (Coming Soon)</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.icon} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.row, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
          <View style={[s.iconWrap, { backgroundColor: theme.tertiary }]}>
            <Ionicons name="star-outline" size={20} color={theme.primary} />
          </View>
          <View style={s.rowText}>
            <Text style={[s.rowLabel, { color: theme.text }]}>Rate the App</Text>
            <Text style={[s.rowDesc, { color: theme.icon }]}>Share your feedback</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.icon} />
        </TouchableOpacity>

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
    headerTitle: { fontSize: 17, fontWeight: "600", color: theme.text },
    scroll: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 },
    sectionTitle: {
      fontSize: 11, fontWeight: "600", color: theme.icon,
      marginBottom: 10, paddingLeft: 2,
      textTransform: "uppercase", letterSpacing: 0.8,
    },

    // Appearance card
    appearanceCard: {
      borderRadius: 16, borderWidth: 1,
      padding: 14, gap: 14, marginBottom: 8,
    },
    appearanceRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    segmentRow: {
      flexDirection: "row",
      borderRadius: 12, borderWidth: 1,
      overflow: "hidden",
      padding: 3, gap: 3,
    },
    segmentBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 5, paddingVertical: 8, borderRadius: 10,
    },
    segmentLabel: { fontSize: 13, fontWeight: "600" },

    // Generic rows
    row: {
      flexDirection: "row", alignItems: "center", gap: 12,
      padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 10,
    },
    iconWrap: { width: 38, height: 38, borderRadius: 10, justifyContent: "center", alignItems: "center" },
    rowText: { flex: 1 },
    rowLabel: { fontSize: 14, fontWeight: "500", marginBottom: 2 },
    rowDesc: { fontSize: 12 },
  });
