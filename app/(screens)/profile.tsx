import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { toast } from "sonner-native";
import * as ImagePicker from "expo-image-picker";
import { useSessionStore } from "@/store/useSessionStore";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";
import BackButton from "@/components/ui/global/BackButton";

const APP_VERSION = "1.2.0";

interface MenuCard {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  iconColor?: string;
}

const MENU_ITEMS: MenuCard[] = [
  { id: "personal", label: "Personal Info", icon: "person-outline", route: "/(screens)/personal-info" },
  { id: "address", label: "Delivery Address", icon: "location-outline", route: "/(screens)/address-book" },
  { id: "notifications", label: "Notifications", icon: "notifications-outline", route: "/(screens)/notification" },
  { id: "settings", label: "Settings", icon: "settings-outline", route: "/(screens)/settings" },
  { id: "payment", label: "Payment Method", icon: "card-outline", route: "/(screens)/payment-method" },
  { id: "orders", label: "Order History", icon: "receipt-outline", route: "/(screens)/order-history" },
  { id: "security", label: "Security & Privacy", icon: "shield-checkmark-outline", route: "/(screens)/security-privacy" },
  { id: "help", label: "Help & Support", icon: "help-circle-outline", route: "/(screens)/help-support" },
];

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, updateUser, logout } = useSessionStore();
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;

    const uri = result.assets[0].uri;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("image", { uri, name: "profile.jpg", type: "image/jpeg" } as any);
      const res = await fetch(`${process.env.EXPO_PUBLIC_BASE_URL}/api/upload/image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${useSessionStore.getState().accessToken}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const uploadData = await res.json();
      await api.put("/auth/me", { profileImage: uploadData.url });
      updateUser({ profileImage: uploadData.url });
      toast.success("Profile photo updated");
    } catch (err: any) {
      toast.error("Upload failed", { description: err.message });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await api.post("/auth/logout").catch(() => {});
    } finally {
      logout();
      router.replace("/(auth)/authentication");
    }
  };

  const s = styles(theme);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar
        barStyle={theme.mode === "dark" ? "light-content" : "dark-content"}
      />

      {/* Header */}
      <View style={s.header}>
        <BackButton />
        <Text style={s.headerTitle}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + Identity */}
        <View style={s.identity}>
          <TouchableOpacity
            style={s.avatarWrap}
            onPress={pickImage}
            activeOpacity={0.8}
          >
            {uploadingImage ? (
              <View style={s.avatarPlaceholder}>
                <ActivityIndicator color={theme.primary} />
              </View>
            ) : user?.profileImage ? (
              <Image source={{ uri: user.profileImage }} style={s.avatar} />
            ) : (
              <View style={s.avatarPlaceholder}>
                <Ionicons name="person" size={42} color={theme.primary} />
              </View>
            )}
            <View style={[s.cameraTag, { backgroundColor: theme.primary }]}>
              <Ionicons name="camera" size={12} color="#fff" />
            </View>
          </TouchableOpacity>

          <Text style={s.name}>{user?.displayName ?? "—"}</Text>
          <Text style={s.userId}>
            {user?.id ? user.id.slice(-8).toUpperCase() : "—"}
          </Text>

          {/* Points pill */}
          <View style={[s.pointsPill, { backgroundColor: theme.accentLight }]}>
            <Ionicons name="star" size={14} color={theme.accent} />
            <Text style={[s.pointsText, { color: theme.text }]}>
              {(user?.points ?? 0).toLocaleString()} pts
            </Text>
          </View>
        </View>

        {/* Grid menu */}
        <View style={s.grid}>
          {MENU_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                s.card,
                { backgroundColor: theme.surface, borderColor: theme.ash },
              ]}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.75}
            >
              <View style={[s.cardIcon, { backgroundColor: theme.tertiary }]}>
                <Ionicons name={item.icon} size={22} color={theme.primary} />
              </View>
              <Text style={[s.cardLabel, { color: theme.text }]}>
                {item.label}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={14}
                color={theme.icon}
                style={{ marginTop: 2 }}
              />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <View style={s.footer}>
        {/* Logout */}
        <TouchableOpacity
          style={[
            s.logoutCard,
            { backgroundColor: theme.surface, borderColor: theme.ash },
          ]}
          onPress={handleLogout}
          disabled={loggingOut}
          activeOpacity={0.75}
        >
          {loggingOut ? (
            <ActivityIndicator size="small" color={theme.error} />
          ) : (
            <>
              <View style={[s.cardIcon, { backgroundColor: "#FFF0F0" }]}>
                <Ionicons
                  name="log-out-outline"
                  size={22}
                  color={theme.error}
                />
              </View>
              <Text style={[s.logoutLabel, { color: theme.error }]}>
                Log Out
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* App version */}
        <Text style={[s.version, { color: theme.icon }]}>
          Version {APP_VERSION}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    headerTitle: { fontSize: 17, fontWeight: "500", color: theme.text },
    scroll: { paddingHorizontal: 16, paddingBottom: 32 },

    // Identity section
    identity: { alignItems: "center", paddingVertical: 24 },
    avatarWrap: { position: "relative", marginBottom: 14 },
    avatar: { width: 96, height: 96, borderRadius: 48 },
    avatarPlaceholder: {
      width: 96, height: 96, borderRadius: 48,
      backgroundColor: theme.tertiary,
      justifyContent: "center", alignItems: "center",
    },
    cameraTag: {
      position: "absolute", bottom: 2, right: 2,
      width: 26, height: 26, borderRadius: 13,
      justifyContent: "center", alignItems: "center",
      borderWidth: 2, borderColor: theme.background,
    },
    name: { fontSize: 20, fontWeight: "500", color: theme.text, marginBottom: 4 },
    userId: { fontSize: 12, fontWeight: "300", color: theme.icon, marginBottom: 12, letterSpacing: 0.5 },
    pointsPill: {
      flexDirection: "row", alignItems: "center", gap: 5,
      paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    },
    pointsText: { fontSize: 13, fontWeight: "500" },

    // Grid
    grid: {
      flexDirection: "row", flexWrap: "wrap",
      gap: 12, marginBottom: 12,
    },
    card: {
      width: "47%",
      flexDirection: "row", alignItems: "center",
      gap: 10,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
    },
    cardIcon: {
      width: 40, height: 40, borderRadius: 12,
      justifyContent: "center", alignItems: "center",
    },
    cardLabel: { flex: 1, fontSize: 13, fontWeight: "400", lineHeight: 18 },
    footer: {
      paddingHorizontal: 10,
    },
    // Logout
    logoutCard: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 10,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      marginBottom: 16,
    },
    logoutLabel: { fontSize: 14, fontWeight: "400" },

    version: { textAlign: "center", fontSize: 12, fontWeight: "300" },
  });
