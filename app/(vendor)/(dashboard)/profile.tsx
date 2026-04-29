import React, { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
} from "react-native";
import Avatar from "@/components/ui/global/Avatar";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import BackButton from "@/components/ui/global/BackButton";
import * as ImagePicker from "expo-image-picker";
import { toast } from "sonner-native";
import { useTheme } from "@/constants/theme";
import { useSessionStore } from "@/store/useSessionStore";
import { api } from "@/lib/api";

type VerificationStatus = "none" | "pending" | "verified" | "rejected";
type PartnerStatus = "none" | "active";

interface VendorProfileResponse {
  user: {
    displayName: string;
    email: string;
    phone?: string;
    vendorVerification?: { status: VerificationStatus };
    partnerBadge?: { plan: string; active: boolean };
  };
  stations: { _id: string }[];
}

/* ─── Shared row styles ─────────────────────────────────────────────────── */
const rowStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    row: {
      flexDirection: "row", alignItems: "center", gap: 12,
      padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 10,
    },
    iconWrap: { width: 38, height: 38, borderRadius: 10, justifyContent: "center", alignItems: "center" },
    rowText: { flex: 1 },
    label: { fontSize: 14, fontWeight: "500", marginBottom: 1 },
    value: { fontSize: 12 },
  });

/* ─── Generic Row ────────────────────────────────────────────────────────── */
function Row({
  icon,
  iconType = "ionicons",
  label,
  value,
  onPress,
  danger,
  chevron = true,
}: {
  icon: string;
  iconType?: "ionicons" | "material";
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  chevron?: boolean;
}) {
  const theme = useTheme();
  const s = rowStyles(theme);

  const iconColor = danger ? "#EF4444" : theme.primary;

  return (
    <TouchableOpacity
      style={[s.row, { backgroundColor: theme.surface, borderColor: theme.ash }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
      disabled={!onPress}
    >
      <View style={[s.iconWrap, { backgroundColor: danger ? "#FEE2E2" : theme.tertiary }]}>
        {iconType === "material" ? (
          <MaterialIcons name={icon as any} size={20} color={iconColor} />
        ) : (
          <Ionicons name={icon as any} size={20} color={iconColor} />
        )}
      </View>

      <View style={s.rowText}>
        <Text style={[s.label, { color: danger ? "#EF4444" : theme.text }]}>
          {label}
        </Text>
        {value ? <Text style={[s.value, { color: theme.icon }]}>{value}</Text> : null}
      </View>

      {chevron && <Ionicons name="chevron-forward" size={16} color={theme.icon} />}
    </TouchableOpacity>
  );
}


/* ─── Verification Row ───────────────────────────────────────────────────── */
function VerificationRow({ status, onPress }: { status: VerificationStatus; onPress?: () => void }) {
  const theme = useTheme();
  const s = rowStyles(theme);
  const isVerified = status === "verified";
  const isPending = status === "pending";
  const iconColor = isVerified ? "#22C55E" : isPending ? "#F59E0B" : theme.primary;
  const iconBg = isVerified ? "#22C55E18" : isPending ? "#F59E0B18" : theme.tertiary;
  const label = isVerified ? "Verified Business" : isPending ? "Verification Pending" : "Get Verified";
  const value = isVerified
    ? "Your business is verified on Gaznger"
    : isPending
    ? "Documents under review — 2–5 business days"
    : "Submit documents to verify your business";

  return (
    <TouchableOpacity
      style={[s.row, { backgroundColor: theme.surface, borderColor: theme.ash }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
      disabled={!onPress}
    >
      <View style={[s.iconWrap, { backgroundColor: iconBg }]}>
        <MaterialIcons name="verified" size={20} color={iconColor} />
      </View>
      <View style={s.rowText}>
        <Text style={[s.label, { color: theme.text }]}>{label}</Text>
        <Text style={[s.value, { color: theme.icon }]}>{value}</Text>
      </View>
      {!isVerified && !isPending && (
        <Ionicons name="chevron-forward" size={16} color={theme.icon} />
      )}
    </TouchableOpacity>
  );
}

/* ─── Partner Badge Row ─────────────────────────────────────────────────── */
function PartnerBadgeRow({ status, onPress }: { status: PartnerStatus; onPress?: () => void }) {
  const theme = useTheme();
  const s = rowStyles(theme);
  const isActive = status === "active";
  const label = isActive ? "Gaznger Partner" : "Gaznger Partner Badge";
  const value = isActive
    ? "You are a verified Gaznger Partner"
    : 'Get prioritised in "Let Gaznger Decide"';

  return (
    <TouchableOpacity
      style={[s.row, { backgroundColor: theme.surface, borderColor: theme.ash }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
      disabled={!onPress}
    >
      <View style={[s.iconWrap, { backgroundColor: theme.primary + "18" }]}>
        <Ionicons name="ribbon" size={20} color={theme.primary} />
      </View>
      <View style={s.rowText}>
        <Text style={[s.label, { color: theme.text }]}>{label}</Text>
        <Text style={[s.value, { color: theme.icon }]}>{value}</Text>
      </View>
      {!isActive && (
        <Ionicons name="chevron-forward" size={16} color={theme.icon} />
      )}
    </TouchableOpacity>
  );
}

/* ─── Screen ─────────────────────────────────────────────────────────────── */
export default function VendorProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, logout, updateUser } = useSessionStore();
  const [stationCount, setStationCount] = useState(0);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>("none");
  const [partnerStatus, setPartnerStatus] = useState<PartnerStatus>("none");
  const [loading, setLoading] = useState(true);
  const [uploadingPicture, setUploadingPicture] = useState(false);

  const initials = (user?.displayName ?? "V")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const fetchProfile = useCallback(async () => {
    try {
      const data = await api.get<VendorProfileResponse>("/api/vendor/profile");
      console.log("[VendorProfile] raw user:", JSON.stringify(data?.user, null, 2));
      console.log("[VendorProfile] vendorVerification:", data?.user?.vendorVerification);
      console.log("[VendorProfile] partnerBadge:", data?.user?.partnerBadge);
      setStationCount(data.stations?.length ?? 0);
      setVerificationStatus(data.user?.vendorVerification?.status ?? "none");
      setPartnerStatus(data.user?.partnerBadge?.active === true ? "active" : "none");
    } catch (err: any) {
      console.warn("[VendorProfile] fetchProfile error:", err?.message ?? err);
    } finally {
      setLoading(false);
    }
  }, []);

  const pickProfilePicture = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (result.canceled) return;
    setUploadingPicture(true);
    try {
      const uri = result.assets[0].uri;
      const formData = new FormData();
      formData.append("image", { uri, name: "profile.jpg", type: "image/jpeg" } as any);
      const res = await fetch(`${process.env.EXPO_PUBLIC_BASE_URL}/api/vendor/profile/picture`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${useSessionStore.getState().accessToken}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      updateUser({ profileImage: data.profileImage });
      toast.success("Company logo updated");
    } catch (err: any) {
      toast.error("Upload failed", { description: err.message });
    } finally {
      setUploadingPicture(false);
    }
  }, [updateUser]);

  useFocusEffect(useCallback(() => { fetchProfile(); }, [fetchProfile]));

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: () => {
          logout();
          router.replace("/(auth)/authentication" as any);
        },
      },
    ]);
  };

  const s = styles(theme);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar
        barStyle={theme.mode === "dark" ? "light-content" : "dark-content"}
      />

      <View style={s.header}>
        <BackButton />
        <Text style={s.headerTitle}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Company card */}
        <View
          style={[
            s.avatarCard,
            { backgroundColor: theme.surface, borderColor: theme.ash },
          ]}
        >
          <TouchableOpacity
            onPress={pickProfilePicture}
            activeOpacity={0.8}
            style={s.avatarTouchable}
          >
            <View
              style={[
                s.avatarWrap,
                {
                  backgroundColor: theme.tertiary,
                  borderColor: theme.primary + "33",
                },
              ]}
            >
              {uploadingPicture ? (
                <ActivityIndicator size="large" color={theme.primary} />
              ) : (
                <Avatar
                  uri={user?.profileImage}
                  initials={initials}
                  size={84}
                  radius={22}
                />
              )}
            </View>
            <View style={[s.editBadge, { backgroundColor: theme.primary }]}>
              <Ionicons name="camera" size={12} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={[s.name, { color: theme.text }]}>
            {user?.displayName ?? "Company"}
          </Text>
          <Text style={[s.email, { color: theme.icon }]}>
            {user?.email ?? ""}
          </Text>
          <View style={s.badgeRow}>
            <View style={[s.badge, { backgroundColor: theme.primary + "18" }]}>
              <Ionicons
                name="business-outline"
                size={13}
                color={theme.primary}
              />
              <Text style={[s.badgeText, { color: theme.primary }]}>
                Vendor Organisation
              </Text>
            </View>
            {verificationStatus === "verified" && (
              <View style={[s.badge, { backgroundColor: "#22C55E18" }]}>
                <MaterialIcons name="verified" size={13} color="#22C55E" />
                <Text style={[s.badgeText, { color: "#22C55E" }]}>
                  Verified
                </Text>
              </View>
            )}
            {partnerStatus === "active" && (
              <View
                style={[s.badge, { backgroundColor: theme.primary + "18" }]}
              >
                <Ionicons name="ribbon" size={13} color={theme.primary} />
                <Text style={[s.badgeText, { color: theme.primary }]}>
                  Partner
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Stations */}
        <Text style={s.sectionTitle}>Stations</Text>
        <Row
          icon="local-gas-station"
          iconType="material"
          label="My Stations"
          value={
            loading
              ? "Loading…"
              : `${stationCount} station${stationCount !== 1 ? "s" : ""}`
          }
          onPress={() => router.push("/(vendor)/stations" as any)}
        />

        {/* Organisation */}
        <Text style={s.sectionTitle}>Organisation</Text>
        <Row
          icon="business-outline"
          label="Company Info"
          value="Name, contact & legal details"
          onPress={() => router.push("/(vendor)/company-info" as any)}
        />
        <VerificationRow
          status={verificationStatus}
          onPress={
            verificationStatus === "none" || verificationStatus === "rejected"
              ? () => router.push("/(vendor)/verification" as any)
              : undefined
          }
        />
        <PartnerBadgeRow
          status={partnerStatus}
          onPress={
            partnerStatus === "none"
              ? () => router.push("/(vendor)/partner-badge" as any)
              : undefined
          }
        />
        <Row
          icon="settings-outline"
          label="Settings"
          value="Theme, notifications"
          onPress={() => router.push("/(screens)/settings" as any)}
        />

        {/* Support */}
        <Text style={s.sectionTitle}>Support</Text>
        <Row
          icon="help-circle-outline"
          label="Help & Support"
          value="FAQs and live chat"
          onPress={() => router.push("/(screens)/help-support" as any)}
        />

        {/* Logout */}
        <Text style={s.sectionTitle}>Session</Text>
        <Row
          icon="log-out-outline"
          label="Log Out"
          onPress={handleLogout}
          danger
          chevron={false}
        />

        <Text style={[s.version, { color: theme.icon }]}>Gaznger v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
    headerTitle: { fontSize: 17, fontWeight: "500", color: theme.text },
    scroll: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 4 },

    avatarCard: {
      alignItems: "center", padding: 24,
      borderRadius: 20, borderWidth: 1, marginBottom: 20,
    },
    avatarTouchable: { alignItems: "center", marginBottom: 12 },
    avatarWrap: {
      width: 88, height: 88, borderRadius: 24,
      alignItems: "center", justifyContent: "center", borderWidth: 2,
    },
    editBadge: {
      width: 24, height: 24, borderRadius: 12,
      alignItems: "center", justifyContent: "center",
      position: "absolute", bottom: -4, right: -4,
    },
    name: { fontSize: 18, fontWeight: "700", marginBottom: 3 },
    email: { fontSize: 13, marginBottom: 10 },
    badgeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" },
    badge: {
      flexDirection: "row", alignItems: "center", gap: 5,
      paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
    },
    badgeText: { fontSize: 12, fontWeight: "600" },

    sectionTitle: {
      fontSize: 11, fontWeight: "600", color: theme.icon,
      textTransform: "uppercase", letterSpacing: 0.8,
      marginBottom: 10, marginTop: 4, paddingLeft: 2,
    },

    version: { textAlign: "center", fontSize: 12, marginTop: 16 },
  });
