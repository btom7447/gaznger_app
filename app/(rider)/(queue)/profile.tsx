import React, { useCallback, useState } from "react";
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
import { useFocusEffect, useRouter } from "expo-router";
import { toast } from "sonner-native";
import { useTheme } from "@/constants/theme";
import { useSessionStore } from "@/store/useSessionStore";
import { api } from "@/lib/api";
import Skeleton from "@/components/ui/global/Skeleton";

interface RiderProfileData {
  vehicleType: string;
  vehiclePlate: string;
  isAvailable: boolean;
  isVerified: boolean;
  rating: number;
  totalDeliveries: number;
  bankAccount?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  user?: {
    displayName: string;
    email: string;
    phone?: string;
    profileImage?: string;
  };
}

function Row({
  icon,
  label,
  value,
  onPress,
  danger,
  chevron = true,
  badge,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  chevron?: boolean;
  badge?: React.ReactNode;
}) {
  const theme = useTheme();
  const s = rowStyles(theme);
  return (
    <TouchableOpacity
      style={[
        s.row,
        { backgroundColor: theme.surface, borderColor: theme.ash },
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
      disabled={!onPress}
    >
      <View
        style={[
          s.iconWrap,
          { backgroundColor: danger ? "#FEE2E2" : theme.tertiary },
        ]}
      >
        <Ionicons
          name={icon}
          size={20}
          color={danger ? "#EF4444" : theme.primary}
        />
      </View>
      <View style={s.rowText}>
        <Text style={[s.label, { color: danger ? "#EF4444" : theme.text }]}>
          {label}
        </Text>
        {value ? (
          <Text style={[s.value, { color: theme.icon }]}>{value}</Text>
        ) : null}
      </View>
      {badge}
      {chevron && (
        <Ionicons name="chevron-forward" size={16} color={theme.icon} />
      )}
    </TouchableOpacity>
  );
}

const rowStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      marginBottom: 10,
    },
    iconWrap: {
      width: 38,
      height: 38,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
    },
    rowText: { flex: 1 },
    label: { fontSize: 14, fontWeight: "500", marginBottom: 1 },
    value: { fontSize: 12 },
  });

export default function RiderProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, logout, updateUser } = useSessionStore();
  const [profile, setProfile] = useState<RiderProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const initials = (user?.displayName ?? "R")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const fetchProfile = useCallback(async () => {
    try {
      const data = await api.get<RiderProfileData>("/api/rider/profile");
      setProfile(data);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [fetchProfile]),
  );

  const handleChangeAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadingAvatar(true);
    try {
      const uri = result.assets[0].uri;
      const formData = new FormData();
      formData.append("image", {
        uri,
        name: "profile.jpg",
        type: "image/jpeg",
      } as any);
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_BASE_URL}/api/rider/profile/picture`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${useSessionStore.getState().accessToken}`,
          },
          body: formData,
        },
      );
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      updateUser({ profileImage: data.profileImage });
      toast.success("Profile photo updated");
    } catch (err: any) {
      toast.error("Upload failed", { description: err.message });
    } finally {
      setUploadingAvatar(false);
    }
  };

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
        {/* Avatar card */}
        <View
          style={[
            s.avatarCard,
            { backgroundColor: theme.surface, borderColor: theme.ash },
          ]}
        >
          <TouchableOpacity
            onPress={handleChangeAvatar}
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
              {uploadingAvatar ? (
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
            {user?.displayName ?? "Rider"}
          </Text>
          <Text style={[s.email, { color: theme.icon }]}>
            {user?.email ?? ""}
          </Text>

          <View style={s.badgeContainer}>
            {profile?.isVerified && (
              <View style={[s.badge, { backgroundColor: "#22C55E18" }]}>
                <MaterialIcons name="verified" size={13} color="#22C55E" />
                <Text style={[s.badgeText, { color: "#22C55E" }]}>
                  Verified
                </Text>
              </View>
            )}

            <View style={[s.badge, { backgroundColor: "#22C55E18" }]}>
              <View
                style={[
                  s.onlineDot,
                  {
                    backgroundColor: profile?.isAvailable
                      ? "#10B981"
                      : theme.icon,
                  },
                ]}
              />
              <Text
                style={[
                  s.onlinePillText,
                  { color: profile?.isAvailable ? "#10B981" : theme.icon },
                ]}
              >
                {profile?.isAvailable ? "Online" : "Offline"}
              </Text>
            </View>
          </View>
        </View>

        {loading && (
          <ActivityIndicator
            size="small"
            color={theme.primary}
            style={{ marginVertical: 8 }}
          />
        )}

        {/* Vehicle */}
        <Text style={s.sectionTitle}>Vehicle</Text>
        <Row
          icon="bicycle-outline"
          label={
            profile
              ? profile.vehicleType.charAt(0).toUpperCase() +
                profile.vehicleType.slice(1)
              : "Vehicle"
          }
          value={profile?.vehiclePlate ?? "Tap to view details"}
          onPress={() => router.push("/(rider)/(screens)/vehicle" as any)}
          badge={
            profile?.isVerified ? (
              <View style={[s.verifiedBadge, { backgroundColor: "#D1FAE5" }]}>
                <Ionicons name="checkmark-circle" size={12} color="#059669" />
                <Text style={s.verifiedBadgeText}>Verified</Text>
              </View>
            ) : null
          }
        />

        {/* Bank Account */}
        <Text style={s.sectionTitle}>Bank Account</Text>
        {profile?.bankAccount ? (
          <Row
            icon="card-outline"
            label={profile.bankAccount.bankName}
            value={`${profile.bankAccount.accountName} · ••••${profile.bankAccount.accountNumber.slice(-4)}`}
            onPress={() =>
              router.push("/(rider)/(screens)/bank-account" as any)
            }
          />
        ) : (
          <Row
            icon="card-outline"
            label="Add Bank Account"
            value="Required for payouts"
            onPress={() =>
              router.push("/(rider)/(screens)/bank-account" as any)
            }
          />
        )}

        {/* Ratings */}
        <Text style={s.sectionTitle}>Ratings</Text>
        <Row
          icon="star-outline"
          label="My Ratings"
          value={
            (profile?.rating ?? 0) > 0
              ? `${profile!.rating.toFixed(1)} average from customers`
              : "No ratings yet"
          }
          onPress={() => router.push("/(rider)/(screens)/ratings" as any)}
        />

        {/* Account */}
        <Text style={s.sectionTitle}>Account</Text>
        <Row
          icon="person-outline"
          label="Personal Info"
          value={user?.phone ?? "Edit your details"}
          onPress={() => router.push("/(screens)/personal-info" as any)}
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

        {/* Session */}
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
      alignItems: "center",
      padding: 20,
      borderRadius: 20,
      borderWidth: 1,
      marginBottom: 24,
    },
    avatarTouchable: {
      position: "relative",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    avatarWrap: {
      width: 92,
      height: 92,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
    },
    editBadge: {
      position: "absolute",
      bottom: -4,
      right: -4,
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: "#fff",
    },
    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 20,
    },
    badgeText: { fontSize: 12, fontWeight: "600" },
    badgeContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    verifiedOverlay: {
      position: "absolute",
      bottom: -4,
      right: -4,
      backgroundColor: "#fff",
      borderRadius: 10,
      padding: 1,
    },
    name: { fontSize: 18, fontWeight: "700", marginBottom: 3 },
    email: { fontSize: 13, marginBottom: 10 },

    inlineStats: {
      flexDirection: "row",
      alignItems: "center",
      borderTopWidth: 1,
      paddingTop: 14,
      gap: 0,
      width: "100%",
    },
    inlineStat: { flex: 1, alignItems: "center", gap: 4 },
    inlineStatVal: { fontSize: 16, fontWeight: "700" },
    inlineStatLbl: { fontSize: 11 },
    inlineStatDivider: { width: 1, height: 32, marginHorizontal: 4 },
    ratingInline: { flexDirection: "row", alignItems: "center", gap: 3 },

    onlinePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 16,
    },
    onlineDot: { width: 6, height: 6, borderRadius: 3 },
    onlinePillText: { fontSize: 11, fontWeight: "700" },

    sectionTitle: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.icon,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 10,
      marginTop: 4,
      paddingLeft: 2,
    },

    verifiedBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    verifiedBadgeText: { fontSize: 11, fontWeight: "600", color: "#059669" },

    version: { textAlign: "center", fontSize: 12, marginTop: 16 },
  });
