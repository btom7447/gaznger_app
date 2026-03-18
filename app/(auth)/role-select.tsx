import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/constants/theme";
import type { UserRole } from "@/store/useSessionStore";

type SelectableRole = Exclude<UserRole, "admin">;

interface RoleCard {
  role: SelectableRole;
  title: string;
  subtitle: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const ROLES: RoleCard[] = [
  {
    role: "customer",
    title: "Buying Fuel",
    subtitle: "I need fuel delivered",
    description: "Order petrol, diesel, LPG and more — delivered to your home or business.",
    icon: "flame-outline",
  },
  {
    role: "vendor",
    title: "I Own a Station",
    subtitle: "I sell and supply fuel",
    description: "List your station, manage orders, track inventory and receive payouts.",
    icon: "storefront-outline",
  },
  {
    role: "rider",
    title: "Delivery Rider",
    subtitle: "I deliver fuel orders",
    description: "Accept delivery jobs near you, earn per delivery and track your income.",
    icon: "bicycle-outline",
  },
];

export default function RoleSelectScreen() {
  const theme = useTheme();
  const s = styles(theme);

  const handleSelect = (role: SelectableRole) => {
    router.push({
      pathname: "/(auth)/authentication",
      params: { mode: "signup", role },
    });
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle={theme.mode === "dark" ? "light-content" : "dark-content"} />
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <View style={[s.logoMark, { backgroundColor: theme.primary }]}>
            <Ionicons name="flame" size={28} color="#fff" />
          </View>
          <Text style={[s.title, { color: theme.text }]}>Welcome to Gaznger</Text>
          <Text style={[s.subtitle, { color: theme.icon }]}>
            How will you be using the app?
          </Text>
        </View>

        {/* Role cards */}
        <View style={s.cards}>
          {ROLES.map((item) => (
            <TouchableOpacity
              key={item.role}
              style={[s.card, { backgroundColor: theme.surface, borderColor: theme.ash }]}
              onPress={() => handleSelect(item.role)}
              activeOpacity={0.85}
            >
              <View style={[s.iconWrap, { backgroundColor: theme.tertiary }]}>
                <Ionicons name={item.icon} size={28} color={theme.primary} />
              </View>
              <View style={s.cardBody}>
                <Text style={[s.cardTitle, { color: theme.text }]}>{item.title}</Text>
                <Text style={[s.cardSub, { color: theme.primary }]}>{item.subtitle}</Text>
                <Text style={[s.cardDesc, { color: theme.icon }]}>{item.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.icon} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Login link */}
        <View style={s.loginRow}>
          <Text style={[s.loginText, { color: theme.icon }]}>Already have an account? </Text>
          <TouchableOpacity
            onPress={() =>
              router.push({ pathname: "/(auth)/authentication", params: { mode: "login" } })
            }
          >
            <Text style={[s.loginLink, { color: theme.primary }]}>Log in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    scroll: { paddingHorizontal: 24, paddingBottom: 40 },

    header: { alignItems: "center", paddingTop: 40, paddingBottom: 36 },
    logoMark: {
      width: 60, height: 60, borderRadius: 18,
      justifyContent: "center", alignItems: "center", marginBottom: 20,
    },
    title: { fontSize: 26, fontWeight: "700", marginBottom: 8, textAlign: "center" },
    subtitle: { fontSize: 15, fontWeight: "400", textAlign: "center", lineHeight: 22 },

    cards: { gap: 14 },
    card: {
      flexDirection: "row", alignItems: "center", gap: 14,
      borderRadius: 18, borderWidth: 1, padding: 18,
    },
    iconWrap: {
      width: 52, height: 52, borderRadius: 14,
      justifyContent: "center", alignItems: "center", flexShrink: 0,
    },
    cardBody: { flex: 1 },
    cardTitle: { fontSize: 16, fontWeight: "600", marginBottom: 2 },
    cardSub: { fontSize: 12, fontWeight: "500", marginBottom: 4 },
    cardDesc: { fontSize: 13, fontWeight: "300", lineHeight: 18 },

    loginRow: {
      flexDirection: "row", justifyContent: "center", alignItems: "center",
      marginTop: 36,
    },
    loginText: { fontSize: 14 },
    loginLink: { fontSize: 14, fontWeight: "600" },
  });
