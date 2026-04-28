import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform,
  Image, Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { toast } from "sonner-native";
import { useTheme } from "@/constants/theme";
import { useSessionStore } from "@/store/useSessionStore";
import { api } from "@/lib/api";

interface ProfileData {
  displayName: string;
  email: string;
  phone: string;
  profileImage?: string;
  vendorVerification?: { status: "none" | "pending" | "verified" | "rejected" };
  partnerBadge?: { plan: string; active: boolean };
  totalStations?: number;
  avgRating?: number;
  totalReviews?: number;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 12, color: theme.icon, marginBottom: 6, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function StarRow({ rating, total }: { rating: number; total: number }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= Math.round(rating) ? "star" : "star-outline"}
          size={14}
          color={i <= Math.round(rating) ? "#F5C518" : theme.ash}
        />
      ))}
      <Text style={{ fontSize: 12, color: theme.icon, marginLeft: 4 }}>
        {rating > 0 ? `${rating.toFixed(1)} (${total} review${total !== 1 ? "s" : ""})` : "No reviews yet"}
      </Text>
    </View>
  );
}

function CompanyInfoSkeleton({ theme }: { theme: ReturnType<typeof useTheme> }) {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const bg = theme.ash;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.ash }}>
        <Animated.View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: bg, opacity: anim }} />
        <Animated.View style={{ flex: 1, height: 14, borderRadius: 6, backgroundColor: bg, opacity: anim }} />
        <View style={{ width: 36 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }} showsVerticalScrollIndicator={false}>
        {/* Logo section — horizontal layout matching actual screen */}
        <View style={{ flexDirection: "row", gap: 16, alignItems: "flex-start", padding: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.ash, backgroundColor: theme.surface }}>
          <Animated.View style={{ width: 80, height: 80, borderRadius: 16, backgroundColor: bg, opacity: anim }} />
          <View style={{ flex: 1, gap: 8 }}>
            <Animated.View style={{ width: "70%", height: 14, borderRadius: 6, backgroundColor: bg, opacity: anim }} />
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Animated.View style={{ width: 64, height: 22, borderRadius: 8, backgroundColor: bg, opacity: anim }} />
              <Animated.View style={{ width: 56, height: 22, borderRadius: 8, backgroundColor: bg, opacity: anim }} />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 }}>
              <Animated.View style={{ width: 32, height: 32, borderRadius: 6, backgroundColor: bg, opacity: anim }} />
              <Animated.View style={{ width: 1, height: 24, backgroundColor: bg, opacity: anim }} />
              <Animated.View style={{ width: 100, height: 14, borderRadius: 6, backgroundColor: bg, opacity: anim }} />
            </View>
          </View>
        </View>

        {/* BUSINESS DETAILS section — 2 fields */}
        <View style={{ padding: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.ash, backgroundColor: theme.surface, gap: 16 }}>
          <Animated.View style={{ width: 110, height: 11, borderRadius: 5, backgroundColor: bg, opacity: anim }} />
          {[0, 1].map((i) => (
            <View key={i} style={{ gap: 6 }}>
              <Animated.View style={{ width: 90, height: 11, borderRadius: 5, backgroundColor: bg, opacity: anim }} />
              <Animated.View style={{ height: 50, borderRadius: 12, borderWidth: 1, borderColor: theme.ash, backgroundColor: theme.background, opacity: anim }} />
            </View>
          ))}
        </View>

        {/* ACCOUNT section — 1 locked field */}
        <View style={{ padding: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.ash, backgroundColor: theme.surface, gap: 16 }}>
          <Animated.View style={{ width: 70, height: 11, borderRadius: 5, backgroundColor: bg, opacity: anim }} />
          <View style={{ gap: 6 }}>
            <Animated.View style={{ width: 90, height: 11, borderRadius: 5, backgroundColor: bg, opacity: anim }} />
            <Animated.View style={{ height: 50, borderRadius: 12, borderWidth: 1, borderColor: theme.ash, backgroundColor: theme.background, opacity: anim }} />
          </View>
        </View>

        {/* Save button */}
        <Animated.View style={{ height: 52, borderRadius: 14, backgroundColor: bg, opacity: anim }} />
      </ScrollView>
    </SafeAreaView>
  );
}

export default function CompanyInfoScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, updateUser } = useSessionStore();

  const [profile, setProfile] = useState<ProfileData>({
    displayName: user?.displayName ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    profileImage: user?.profileImage ?? "",
  });
  const [companyName, setCompanyName] = useState(user?.displayName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<{ user: any; stations: any[] }>("/api/vendor/profile"),
    ]).then(([data]) => {
      const u = data.user;
      const stationCount = (data.stations ?? []).length;

      // Compute aggregate rating from stations if available
      let avgRating = 0;
      let totalReviews = 0;
      if (data.stations) {
        const ratingsData = data.stations.reduce(
          (acc: { sum: number; count: number }, s: any) => {
            if (s.avgRating) { acc.sum += s.avgRating * (s.ratingCount ?? 1); acc.count += s.ratingCount ?? 1; }
            return acc;
          }, { sum: 0, count: 0 }
        );
        if (ratingsData.count > 0) {
          avgRating = Math.round((ratingsData.sum / ratingsData.count) * 10) / 10;
          totalReviews = ratingsData.count;
        }
      }

      setProfile({
        displayName: u.displayName ?? "",
        email: u.email ?? "",
        phone: u.phone ?? "",
        profileImage: u.profileImage ?? "",
        vendorVerification: u.vendorVerification,
        partnerBadge: u.partnerBadge,
        totalStations: stationCount,
        avgRating,
        totalReviews,
      });
      setCompanyName(u.displayName ?? "");
      setPhone(u.phone ?? "");
    })
    .catch(() => {})
    .finally(() => setLoading(false));
  }, []);

  const pickLogo = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      toast.error("Camera roll permission required");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    const uri = result.assets[0].uri;
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("image", {
        uri,
        name: "logo.jpg",
        type: "image/jpeg",
      } as any);
      const res = await api.uploadForm<{ profileImage: string }>("/api/vendor/profile/picture", formData);
      setProfile((p) => ({ ...p, profileImage: res.profileImage }));
      updateUser({ profileImage: res.profileImage });
      toast.success("Logo updated");
    } catch (err: any) {
      toast.error("Upload failed", { description: err.message });
    } finally {
      setUploadingLogo(false);
    }
  }, [updateUser]);

  const save = useCallback(async () => {
    if (!companyName.trim()) {
      toast.error("Company name is required");
      return;
    }
    setSaving(true);
    try {
      await api.patch("/api/vendor/profile", {
        displayName: companyName.trim(),
        phone: phone.trim(),
      });
      updateUser({ displayName: companyName.trim(), phone: phone.trim() });
      toast.success("Company info updated");
      router.back();
    } catch (err: any) {
      toast.error("Save failed", { description: err.message });
    } finally {
      setSaving(false);
    }
  }, [companyName, phone, updateUser, router]);

  const verificationStatus = profile.vendorVerification?.status ?? "none";
  const isVerified = verificationStatus === "verified";
  const isPending = verificationStatus === "pending";
  const isPartner = profile.partnerBadge?.active === true;

  const s = styles(theme);

  if (loading) return <CompanyInfoSkeleton theme={theme} />;

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: theme.ash }]}>
        <TouchableOpacity onPress={() => router.back()} style={[s.backBtn, { borderColor: theme.ash }]} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text }]}>Company Info</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* ── Logo Section ── */}
          <View style={[s.logoSection, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
            <TouchableOpacity style={s.logoWrap} onPress={pickLogo} activeOpacity={0.8} disabled={uploadingLogo}>
              {profile.profileImage ? (
                <Image source={{ uri: profile.profileImage }} style={s.logoImage} />
              ) : (
                <View style={[s.logoPlaceholder, { backgroundColor: theme.tertiary }]}>
                  <Ionicons name="business-outline" size={36} color={theme.primary} />
                </View>
              )}
              <View style={[s.cameraBtn, { backgroundColor: theme.primary }]}>
                {uploadingLogo
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="camera" size={14} color="#fff" />
                }
              </View>
            </TouchableOpacity>

            <View style={s.logoMeta}>
              <Text style={[s.companyDisplayName, { color: theme.text }]}>{profile.displayName || "Your Company"}</Text>

              {/* Badges */}
              <View style={s.badgesRow}>
                {isVerified && (
                  <View style={[s.badge, { backgroundColor: "#22C55E18", borderColor: "#22C55E44" }]}>
                    <MaterialIcons name="verified" size={13} color="#22C55E" />
                    <Text style={[s.badgeText, { color: "#22C55E" }]}>Verified</Text>
                  </View>
                )}
                {isPending && (
                  <View style={[s.badge, { backgroundColor: "#F59E0B18", borderColor: "#F59E0B44" }]}>
                    <Ionicons name="time-outline" size={13} color="#F59E0B" />
                    <Text style={[s.badgeText, { color: "#F59E0B" }]}>Pending Review</Text>
                  </View>
                )}
                {isPartner && (
                  <View style={[s.badge, { backgroundColor: "#3B82F618", borderColor: "#3B82F644" }]}>
                    <Ionicons name="ribbon-outline" size={13} color="#3B82F6" />
                    <Text style={[s.badgeText, { color: "#3B82F6" }]}>{profile.partnerBadge?.plan ?? "Partner"}</Text>
                  </View>
                )}
              </View>

              {/* Stats row */}
              <View style={s.statsRow}>
                <View style={s.statItem}>
                  <Text style={[s.statValue, { color: theme.text }]}>{profile.totalStations ?? 0}</Text>
                  <Text style={[s.statLabel, { color: theme.icon }]}>Station{(profile.totalStations ?? 0) !== 1 ? "s" : ""}</Text>
                </View>
                <View style={[s.statDivider, { backgroundColor: theme.ash }]} />
                <View style={s.statItem}>
                  <StarRow rating={profile.avgRating ?? 0} total={profile.totalReviews ?? 0} />
                </View>
              </View>
            </View>
          </View>

          {/* ── Business Details ── */}
          <View style={[s.section, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
            <Text style={[s.sectionTitle, { color: theme.icon }]}>BUSINESS DETAILS</Text>
            <Field label="Company / Business Name">
              <TextInput
                style={[s.input, { color: theme.text, borderColor: theme.ash, backgroundColor: theme.background }]}
                value={companyName}
                onChangeText={setCompanyName}
                placeholder="Your registered business name"
                placeholderTextColor={theme.icon}
                autoCapitalize="words"
              />
            </Field>
            <Field label="Contact Phone">
              <TextInput
                style={[s.input, { color: theme.text, borderColor: theme.ash, backgroundColor: theme.background }]}
                value={phone}
                onChangeText={setPhone}
                placeholder="e.g. 080 0000 0000"
                placeholderTextColor={theme.icon}
                keyboardType="phone-pad"
              />
            </Field>
          </View>

          {/* ── Account ── */}
          <View style={[s.section, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
            <Text style={[s.sectionTitle, { color: theme.icon }]}>ACCOUNT</Text>
            <Field label="Business Email">
              <View style={[s.inputLocked, { borderColor: theme.ash, backgroundColor: theme.background }]}>
                <Text style={[s.inputLockedText, { color: theme.icon }]}>{profile.email}</Text>
                <Ionicons name="lock-closed-outline" size={14} color={theme.icon} />
              </View>
              <Text style={[s.hint, { color: theme.icon }]}>Email cannot be changed. Contact support if needed.</Text>
            </Field>
          </View>

          {/* ── Verification Status ── */}
          {!isVerified && (
            <TouchableOpacity
              style={[s.section, s.verifyRow, {
                backgroundColor: isPending ? "#F59E0B08" : "#22C55E08",
                borderColor: isPending ? "#F59E0B33" : "#22C55E33",
              }]}
              onPress={() => router.push("/(vendor)/verification" as any)}
              activeOpacity={0.8}
            >
              <View style={[s.verifyIcon, { backgroundColor: isPending ? "#F59E0B18" : "#22C55E18" }]}>
                {isPending
                  ? <Ionicons name="time-outline" size={18} color="#F59E0B" />
                  : <MaterialIcons name="verified" size={18} color="#22C55E" />
                }
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.verifyTitle, { color: theme.text }]}>
                  {isPending ? "Verification Pending" : "Get Verified"}
                </Text>
                <Text style={[s.verifySub, { color: theme.icon }]}>
                  {isPending
                    ? "Your documents are under review"
                    : "Submit documents to verify your business"
                  }
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.icon} />
            </TouchableOpacity>
          )}

          {/* ── Partner Badge ── */}
          {!isPartner && (
            <TouchableOpacity
              style={[s.section, s.verifyRow, { backgroundColor: "#3B82F608", borderColor: "#3B82F633" }]}
              onPress={() => router.push("/(vendor)/(dashboard)/profile" as any)}
              activeOpacity={0.8}
            >
              <View style={[s.verifyIcon, { backgroundColor: "#3B82F618" }]}>
                <MaterialIcons name="workspace-premium" size={18} color="#3B82F6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.verifyTitle, { color: theme.text }]}>Get Partner Badge</Text>
                <Text style={[s.verifySub, { color: theme.icon }]}>
                  Boost visibility — appear first in customer searches
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.icon} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[s.saveBtn, { backgroundColor: theme.primary }]}
            onPress={save}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={s.saveBtnText}>Save Changes</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1,
    },
    backBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontSize: 17, fontWeight: "700" },
    scroll: { padding: 16, paddingBottom: 40, gap: 14 },

    logoSection: {
      borderRadius: 16, borderWidth: 1, padding: 16,
      flexDirection: "row", gap: 16, alignItems: "flex-start",
    },
    logoWrap: { position: "relative" },
    logoImage: { width: 80, height: 80, borderRadius: 16 },
    logoPlaceholder: {
      width: 80, height: 80, borderRadius: 16,
      alignItems: "center", justifyContent: "center",
    },
    cameraBtn: {
      position: "absolute", bottom: -4, right: -4,
      width: 26, height: 26, borderRadius: 13,
      alignItems: "center", justifyContent: "center",
      borderWidth: 2, borderColor: theme.background,
    },
    logoMeta: { flex: 1, gap: 8 },
    companyDisplayName: { fontSize: 16, fontWeight: "700" },

    badgesRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    badge: {
      flexDirection: "row", alignItems: "center", gap: 4,
      paddingHorizontal: 8, paddingVertical: 4,
      borderRadius: 8, borderWidth: 1,
    },
    badgeText: { fontSize: 11, fontWeight: "600" },

    statsRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
    statItem: { alignItems: "flex-start" },
    statValue: { fontSize: 16, fontWeight: "700" },
    statLabel: { fontSize: 11 },
    statDivider: { width: 1, height: 24 },

    section: { borderRadius: 16, borderWidth: 1, padding: 16 },
    sectionTitle: { fontSize: 11, fontWeight: "600", letterSpacing: 0.6, marginBottom: 16 },

    input: {
      borderWidth: 1, borderRadius: 12,
      paddingHorizontal: 14, paddingVertical: 13, fontSize: 14,
    },
    inputLocked: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    },
    inputLockedText: { fontSize: 14 },
    hint: { fontSize: 11, marginTop: 6, lineHeight: 16 },

    verifyRow: {
      flexDirection: "row", alignItems: "center", gap: 12,
    },
    verifyIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    verifyTitle: { fontSize: 13, fontWeight: "600", marginBottom: 2 },
    verifySub: { fontSize: 11 },

    saveBtn: { paddingVertical: 15, borderRadius: 14, alignItems: "center", marginTop: 4 },
    saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  });
