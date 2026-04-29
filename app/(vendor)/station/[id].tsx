import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Image, FlatList,
  KeyboardAvoidingView, Platform, Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import MapView, { Marker, Region, PROVIDER_GOOGLE } from "react-native-maps";
import { toast } from "sonner-native";
import { useTheme } from "@/constants/theme";
import { useSessionStore } from "@/store/useSessionStore";
import { api } from "@/lib/api";

type Tab = "info" | "photos" | "payout" | "verify" | "reviews";

interface StationDetail {
  _id: string;
  name: string;
  address: string;
  state: string;
  lga: string;
  verified: boolean;
  isActive: boolean;
  operatingHours?: { open: string; close: string };
  rating: number;
  totalReviews?: number;
  images?: string[];
  fuels: { fuel: { name: string }; pricePerUnit: number; available: boolean }[];
  location?: { lat: number; lng: number };
  stationType?: string;
  isPartner?: boolean;
}

interface Review {
  _id: string;
  user: { displayName: string; profileImage?: string };
  rating: number;
  comment?: string;
  createdAt: string;
}

const TABS: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "info",    label: "Info",    icon: "information-circle-outline" },
  { key: "photos",  label: "Photos",  icon: "images-outline" },
  { key: "payout",  label: "Payout",  icon: "card-outline" },
  { key: "verify",  label: "Verify",  icon: "shield-checkmark-outline" },
  { key: "reviews", label: "Reviews", icon: "star-outline" },
];

function StarRow({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1,2,3,4,5].map((s) => (
        <Ionicons key={s} name={s <= Math.round(rating) ? "star" : "star-outline"} size={13} color="#F59E0B" />
      ))}
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 12, color: theme.icon, marginBottom: 6, fontWeight: "500" }}>{label}</Text>
      {children}
    </View>
  );
}


function StationDetailSkeleton({ theme }: { theme: ReturnType<typeof useTheme> }) {
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
  const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.ash },
    backBox: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: theme.ash },
    line: { borderRadius: 6 },
    statsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
    statCard: { flex: 1, alignItems: "center", gap: 6, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: theme.ash, backgroundColor: theme.surface },
    tabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: theme.ash, backgroundColor: theme.surface },
    tabItem: { flex: 1, alignItems: "center", paddingVertical: 12 },
    content: { padding: 16, gap: 14 },
    field: { gap: 6 },
    input: { height: 48, borderRadius: 12, borderWidth: 1, borderColor: theme.ash, backgroundColor: theme.surface },
  });

  return (
    <SafeAreaView style={s.safe}>
      {/* Header skeleton */}
      <View style={s.header}>
        <Animated.View style={[s.backBox, { opacity: anim, backgroundColor: bg }]} />
        <View style={{ flex: 1, gap: 6 }}>
          <Animated.View style={[s.line, { height: 14, width: "55%", backgroundColor: bg, opacity: anim }]} />
          <Animated.View style={[s.line, { height: 11, width: "30%", backgroundColor: bg, opacity: anim }]} />
        </View>
      </View>

      {/* Stats row skeleton */}
      <View style={s.statsRow}>
        {[0,1,2].map((i) => (
          <View key={i} style={s.statCard}>
            <Animated.View style={[s.line, { width: 20, height: 20, borderRadius: 10, backgroundColor: bg, opacity: anim }]} />
            <Animated.View style={[s.line, { width: 32, height: 16, backgroundColor: bg, opacity: anim }]} />
            <Animated.View style={[s.line, { width: 40, height: 11, backgroundColor: bg, opacity: anim }]} />
          </View>
        ))}
      </View>

      {/* Tab bar skeleton */}
      <View style={s.tabBar}>
        {[0,1,2,3,4].map((i) => (
          <View key={i} style={s.tabItem}>
            <Animated.View style={[s.line, { width: 18, height: 18, borderRadius: 9, backgroundColor: bg, opacity: anim }]} />
            <Animated.View style={[s.line, { width: 30, height: 10, marginTop: 4, backgroundColor: bg, opacity: anim }]} />
          </View>
        ))}
      </View>

      {/* Content skeleton */}
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {[0,1,2,3].map((i) => (
          <View key={i} style={s.field}>
            <Animated.View style={[s.line, { width: 80, height: 11, backgroundColor: bg, opacity: anim }]} />
            <Animated.View style={[s.input, { opacity: anim }]} />
          </View>
        ))}
        {/* Map placeholder */}
        <Animated.View style={[{ height: 240, borderRadius: 14, backgroundColor: bg, opacity: anim }]} />
      </ScrollView>
    </SafeAreaView>
  );
}

export default function StationDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const accessToken = useSessionStore((s) => s.accessToken);

  const [station, setStation] = useState<StationDetail | null>(null);
  const [isVendorPartner, setIsVendorPartner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("info");

  // Info tab
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [lga, setLga] = useState("");
  const [openTime, setOpenTime] = useState("");
  const [closeTime, setCloseTime] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);

  // Map
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: 6.5244, longitude: 3.3792, latitudeDelta: 0.01, longitudeDelta: 0.01,
  });
  const [locating, setLocating] = useState(false);

  // Photos tab
  const [images, setImages] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savingPhotos, setSavingPhotos] = useState(false);

  // Payout tab
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [savingPayout, setSavingPayout] = useState(false);

  // Reviews tab
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  const fetchStation = useCallback(async () => {
    try {
      const [data, profileData] = await Promise.all([
        api.get<{ station: StationDetail }>(`/api/vendor/stations/${id}`),
        api.get<{ user: { partnerBadge?: { active: boolean } } }>("/api/vendor/profile"),
      ]);
      setIsVendorPartner(profileData.user?.partnerBadge?.active === true);
      const s = data.station;
      setStation(s);
      setName(s.name);
      setAddress(s.address);
      setStateVal(s.state);
      setLga(s.lga ?? "");
      setOpenTime(s.operatingHours?.open ?? "");
      setCloseTime(s.operatingHours?.close ?? "");
      const sLat = s.location?.lat ?? 6.5244;
      const sLng = s.location?.lng ?? 3.3792;
      setLat(String(sLat));
      setLng(String(sLng));
      setMapRegion({ latitude: sLat, longitude: sLng, latitudeDelta: 0.01, longitudeDelta: 0.01 });
      setImages(s.images ?? []);
      setBankName((s as any).bankAccount?.bankName ?? "");
      setAccountNumber((s as any).bankAccount?.accountNumber ?? "");
      setAccountName((s as any).bankAccount?.accountName ?? "");
    } catch {
      toast.error("Could not load station details");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchReviews = useCallback(async () => {
    if (loadingReviews) return;
    setLoadingReviews(true);
    try {
      const data = await api.get<{ reviews: Review[] }>(`/api/vendor/stations/${id}/reviews`);
      setReviews(data.reviews ?? []);
    } catch {
      // non-fatal
    } finally {
      setLoadingReviews(false);
    }
  }, [id]);

  useEffect(() => { fetchStation(); }, [fetchStation]);
  useEffect(() => { if (activeTab === "reviews") fetchReviews(); }, [activeTab]);

  const locateMe = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { toast.info("Location permission denied"); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      setLat(latitude.toFixed(6));
      setLng(longitude.toFixed(6));
      setMapRegion({ latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 });
    } catch {
      toast.error("Could not get location");
    } finally {
      setLocating(false);
    }
  };

  const saveInfo = async () => {
    if (!name.trim() || !address.trim()) {
      toast.error("Name and address are required");
      return;
    }
    setSavingInfo(true);
    try {
      await api.patch("/api/vendor/station", {
        stationId: id,
        name: name.trim(),
        address: address.trim(),
        state: stateVal.trim(),
        lga: lga.trim(),
        operatingHours: openTime && closeTime ? { open: openTime.trim(), close: closeTime.trim() } : undefined,
        location: lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : undefined,
      });
      setStation((p) => p ? { ...p, name: name.trim(), address: address.trim() } : p);
      toast.success("Station info updated");
    } catch (err: any) {
      toast.error("Save failed", { description: err.message });
    } finally {
      setSavingInfo(false);
    }
  };

  const uploadPhoto = async () => {
    if (images.length >= 5) { toast.info("Maximum 5 photos allowed"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [16, 9], quality: 0.8,
    });
    if (result.canceled) return;
    setUploadingPhoto(true);
    try {
      const uri = result.assets[0].uri;
      const formData = new FormData();
      formData.append("image", { uri, name: "station.jpg", type: "image/jpeg" } as any);
      const res = await fetch(`${process.env.EXPO_PUBLIC_BASE_URL}/api/upload/image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setImages((prev) => [...prev, data.url]);
    } catch (err: any) {
      toast.error("Upload failed", { description: err.message });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removePhoto = (url: string) => {
    Alert.alert("Remove Photo", "Remove this photo?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => setImages((p) => p.filter((u) => u !== url)) },
    ]);
  };

  const savePhotos = async () => {
    setSavingPhotos(true);
    try {
      await api.patch("/api/vendor/station", { stationId: id, images });
      toast.success("Photos updated");
    } catch (err: any) {
      toast.error("Save failed", { description: err.message });
    } finally {
      setSavingPhotos(false);
    }
  };

  const savePayout = async () => {
    if (!bankName.trim() || accountNumber.trim().length < 10 || !accountName.trim()) {
      toast.error("Please fill all payout fields correctly");
      return;
    }
    setSavingPayout(true);
    try {
      await api.patch("/api/vendor/station/bank", {
        stationId: id,
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim(),
      });
      toast.success("Payout details updated");
    } catch (err: any) {
      toast.error("Save failed", { description: err.message });
    } finally {
      setSavingPayout(false);
    }
  };

  const s = styles(theme);

  if (loading) {
    return <StationDetailSkeleton theme={theme} />;
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: theme.ash }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[s.backBtn, { borderColor: theme.ash }]}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text
            style={[s.headerTitle, { color: theme.text }]}
            numberOfLines={1}
          >
            {station?.name ?? "Station"}
          </Text>
          <View style={s.headerMeta}>
            {station?.verified ? (
              <View style={s.verifiedRow}>
                <MaterialIcons name="verified" size={13} color="#22C55E" />
                <Text style={[s.verifiedLabel, { color: "#22C55E" }]}>
                  Verified
                </Text>
              </View>
            ) : (
              <Text style={[s.unverifiedLabel, { color: theme.icon }]}>
                Not Verified
              </Text>
            )}
            {isVendorPartner && (
              <View style={s.verifiedRow}>
                <Ionicons name="ribbon-outline" size={13} color={theme.primary} />
                <Text style={[s.verifiedLabel, { color: theme.primary }]}>Partner</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Station stats */}
      <View style={s.statsRow}>
        <View style={[s.statCard, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
          <Ionicons name="star" size={16} color="#F59E0B" />
          <Text style={[s.statVal, { color: theme.text }]}>
            {station?.rating?.toFixed(1) ?? "—"}
          </Text>
          <Text style={[s.statLabel, { color: theme.icon }]}>Rating</Text>
        </View>
        <View style={[s.statCard, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
          <Ionicons name="chatbubble-outline" size={16} color={theme.primary} />
          <Text style={[s.statVal, { color: theme.text }]}>
            {station?.totalReviews ?? reviews.length}
          </Text>
          <Text style={[s.statLabel, { color: theme.icon }]}>Reviews</Text>
        </View>
        <View style={[s.statCard, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
          <Ionicons name="flame-outline" size={16} color={theme.primary} />
          <Text style={[s.statVal, { color: theme.text }]}>
            {station?.fuels?.length ?? 0}
          </Text>
          <Text style={[s.statLabel, { color: theme.icon }]}>Fuels</Text>
        </View>
      </View>

      {/* Tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[
          s.tabBar,
          { backgroundColor: theme.surface, borderBottomColor: theme.ash },
        ]}
        contentContainerStyle={{ paddingHorizontal: 4 }}
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={s.tabItem}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={tab.icon}
                size={18}
                color={active ? theme.primary : theme.icon}
              />
              <Text
                style={[
                  s.tabLabel,
                  {
                    color: active ? theme.primary : theme.icon,
                    fontWeight: active ? "600" : "400",
                  },
                ]}
              >
                {tab.label}
              </Text>
              {active && (
                <View
                  style={[s.tabIndicator, { backgroundColor: theme.primary }]}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── INFO TAB ── */}
      {activeTab === "info" && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={s.tabContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Field label="Station Name">
              <TextInput
                style={[
                  s.input,
                  {
                    color: theme.text,
                    borderColor: theme.ash,
                    backgroundColor: theme.surface,
                  },
                ]}
                value={name}
                onChangeText={setName}
                placeholderTextColor={theme.icon}
              />
            </Field>
            <Field label="Street Address">
              <TextInput
                style={[
                  s.input,
                  {
                    color: theme.text,
                    borderColor: theme.ash,
                    backgroundColor: theme.surface,
                  },
                ]}
                value={address}
                onChangeText={setAddress}
                placeholderTextColor={theme.icon}
              />
            </Field>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Field label="State">
                  <TextInput
                    style={[
                      s.input,
                      {
                        color: theme.text,
                        borderColor: theme.ash,
                        backgroundColor: theme.surface,
                      },
                    ]}
                    value={stateVal}
                    onChangeText={setStateVal}
                    placeholderTextColor={theme.icon}
                  />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="LGA">
                  <TextInput
                    style={[
                      s.input,
                      {
                        color: theme.text,
                        borderColor: theme.ash,
                        backgroundColor: theme.surface,
                      },
                    ]}
                    value={lga}
                    onChangeText={setLga}
                    placeholderTextColor={theme.icon}
                  />
                </Field>
              </View>
            </View>

            <Text style={[s.sectionLabel, { color: theme.icon }]}>
              OPERATING HOURS
            </Text>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Field label="Opens">
                  <TextInput
                    style={[
                      s.input,
                      {
                        color: theme.text,
                        borderColor: theme.ash,
                        backgroundColor: theme.surface,
                      },
                    ]}
                    value={openTime}
                    onChangeText={setOpenTime}
                    placeholder="e.g. 7:00 AM"
                    placeholderTextColor={theme.icon}
                  />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Closes">
                  <TextInput
                    style={[
                      s.input,
                      {
                        color: theme.text,
                        borderColor: theme.ash,
                        backgroundColor: theme.surface,
                      },
                    ]}
                    value={closeTime}
                    onChangeText={setCloseTime}
                    placeholder="e.g. 10:00 PM"
                    placeholderTextColor={theme.icon}
                  />
                </Field>
              </View>
            </View>

            {/* Location */}
            <Text style={[s.sectionLabel, { color: theme.icon }]}>
              LOCATION COORDINATES
            </Text>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Field label="Latitude">
                  <TextInput
                    style={[
                      s.input,
                      {
                        color: theme.text,
                        borderColor: theme.ash,
                        backgroundColor: theme.surface,
                      },
                    ]}
                    value={lat}
                    onChangeText={(v) => {
                      setLat(v);
                      const parsed = parseFloat(v);
                      if (!isNaN(parsed))
                        setMapRegion((r) => ({ ...r, latitude: parsed }));
                    }}
                    placeholder="e.g. 6.5244"
                    placeholderTextColor={theme.icon}
                    keyboardType="decimal-pad"
                  />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Longitude">
                  <TextInput
                    style={[
                      s.input,
                      {
                        color: theme.text,
                        borderColor: theme.ash,
                        backgroundColor: theme.surface,
                      },
                    ]}
                    value={lng}
                    onChangeText={(v) => {
                      setLng(v);
                      const parsed = parseFloat(v);
                      if (!isNaN(parsed))
                        setMapRegion((r) => ({ ...r, longitude: parsed }));
                    }}
                    placeholder="e.g. 3.3792"
                    placeholderTextColor={theme.icon}
                    keyboardType="decimal-pad"
                  />
                </Field>
              </View>
            </View>

            {/* Map picker */}
            <View style={[s.mapWrap, { borderColor: theme.ash }]}>
              <MapView
                provider={PROVIDER_GOOGLE}
                style={s.map}
                region={mapRegion}
                onRegionChangeComplete={(r) => setMapRegion(r)}
                onPress={(e) => {
                  const { latitude, longitude } = e.nativeEvent.coordinate;
                  setLat(latitude.toFixed(6));
                  setLng(longitude.toFixed(6));
                  setMapRegion((r) => ({ ...r, latitude, longitude }));
                }}
                showsUserLocation
                showsMyLocationButton={false}
              >
                <Marker
                  coordinate={{ latitude: mapRegion.latitude, longitude: mapRegion.longitude }}
                  draggable
                  onDragEnd={(e) => {
                    const { latitude, longitude } = e.nativeEvent.coordinate;
                    setLat(latitude.toFixed(6));
                    setLng(longitude.toFixed(6));
                    setMapRegion((r) => ({ ...r, latitude, longitude }));
                  }}
                >
                  <View style={{ alignItems: "center" }}>
                    <View style={[s.pinBubble, { backgroundColor: theme.primary }]}>
                      <Ionicons name="location" size={16} color="#fff" />
                    </View>
                    <View style={[s.pinTail, { borderTopColor: theme.primary }]} />
                  </View>
                </Marker>
              </MapView>

              {/* Tooltip */}
              <View style={[s.mapTooltip, { backgroundColor: theme.background + "EE" }]} pointerEvents="none">
                <Ionicons name="finger-print-outline" size={13} color={theme.icon} />
                <Text style={[s.mapTooltipText, { color: theme.icon }]}>Tap map or drag the pin</Text>
              </View>

              {/* Coordinates overlay */}
              <View
                style={[s.mapOverlay, { backgroundColor: theme.background + "EE" }]}
                pointerEvents="none"
              >
                <Text style={[s.mapOverlayText, { color: theme.text }]}>
                  {parseFloat(lat || "0").toFixed(5)}, {parseFloat(lng || "0").toFixed(5)}
                </Text>
              </View>

              {/* Locate me */}
              <TouchableOpacity
                style={[s.locateBtn, { backgroundColor: theme.surface, borderColor: theme.ash }]}
                onPress={locateMe}
                disabled={locating}
                activeOpacity={0.8}
              >
                {locating
                  ? <ActivityIndicator size="small" color={theme.primary} />
                  : <Ionicons name="locate-outline" size={18} color={theme.primary} />
                }
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: theme.primary }]}
              onPress={saveInfo}
              disabled={savingInfo}
              activeOpacity={0.85}
            >
              {savingInfo ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.saveBtnText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* ── PHOTOS TAB ── */}
      {activeTab === "photos" && (
        <ScrollView contentContainerStyle={s.tabContent} showsVerticalScrollIndicator={false}>
          <Text style={[s.tabDesc, { color: theme.icon }]}>
            Upload up to 5 photos. The first photo is used as the cover on map and search results.
          </Text>

          {/* Scrollable preview row */}
          {images.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.photoPreviewScroll}
              contentContainerStyle={s.photoPreviewContent}
            >
              {images.map((uri, idx) => (
                <View key={uri} style={s.photoThumbWrap}>
                  <Image source={{ uri }} style={s.photoThumb} resizeMode="cover" />
                  {idx === 0 && (
                    <View style={[s.photoCoverBadge, { backgroundColor: theme.primary }]}>
                      <Ionicons name="star" size={10} color="#fff" />
                      <Text style={s.photoCoverText}>Cover</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={s.photoRemoveBtn}
                    onPress={() => removePhoto(uri)}
                    activeOpacity={0.8}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="close-circle" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Cover hint */}
          {images.length > 0 && (
            <View style={[s.photoCoverHint, { backgroundColor: theme.tertiary }]}>
              <Ionicons name="information-circle-outline" size={14} color={theme.primary} />
              <Text style={[s.photoCoverHintText, { color: theme.icon }]}>
                The first photo is your cover image. Drag to reorder (coming soon).
              </Text>
            </View>
          )}

          {/* Upload button */}
          {images.length < 5 && (
            <TouchableOpacity
              style={[s.photoUploadBtn, { borderColor: theme.ash }]}
              onPress={uploadPhoto}
              disabled={uploadingPhoto}
              activeOpacity={0.8}
            >
              {uploadingPhoto
                ? <ActivityIndicator size="small" color={theme.primary} />
                : <>
                    <Ionicons name="cloud-upload-outline" size={26} color={theme.primary} />
                    <Text style={[s.photoUploadBtnText, { color: theme.primary }]}>
                      {images.length === 0 ? "Upload station photos" : "Add another photo"}
                    </Text>
                    <Text style={[s.photoUploadHint, { color: theme.icon }]}>
                      {images.length}/5 photos · JPG or PNG, max 10MB
                    </Text>
                  </>
              }
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[s.saveBtn, { backgroundColor: theme.primary, marginTop: 16 }]}
            onPress={savePhotos}
            disabled={savingPhotos}
            activeOpacity={0.85}
          >
            {savingPhotos
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={s.saveBtnText}>Save Photos</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── PAYOUT TAB ── */}
      {activeTab === "payout" && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={s.tabContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[s.noticeBanner, { backgroundColor: theme.tertiary }]}>
              <Ionicons
                name="lock-closed-outline"
                size={14}
                color={theme.primary}
              />
              <Text style={[s.noticeText, { color: theme.icon }]}>
                Earnings are paid to this account. Your bank details are
                encrypted and used only for payouts.
              </Text>
            </View>
            <Field label="Bank Name">
              <TextInput
                style={[
                  s.input,
                  {
                    color: theme.text,
                    borderColor: theme.ash,
                    backgroundColor: theme.surface,
                  },
                ]}
                value={bankName}
                onChangeText={setBankName}
                placeholder="e.g. First Bank, GTBank"
                placeholderTextColor={theme.icon}
              />
            </Field>
            <Field label="Account Number">
              <TextInput
                style={[
                  s.input,
                  {
                    color: theme.text,
                    borderColor: theme.ash,
                    backgroundColor: theme.surface,
                  },
                ]}
                value={accountNumber}
                onChangeText={setAccountNumber}
                keyboardType="numeric"
                maxLength={10}
                placeholder="10-digit account number"
                placeholderTextColor={theme.icon}
              />
            </Field>
            <Field label="Account Name">
              <TextInput
                style={[
                  s.input,
                  {
                    color: theme.text,
                    borderColor: theme.ash,
                    backgroundColor: theme.surface,
                  },
                ]}
                value={accountName}
                onChangeText={setAccountName}
                placeholder="Name on account"
                placeholderTextColor={theme.icon}
                autoCapitalize="words"
              />
            </Field>
            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: theme.primary }]}
              onPress={savePayout}
              disabled={savingPayout}
              activeOpacity={0.85}
            >
              {savingPayout ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.saveBtnText}>Save Payout Details</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* ── VERIFY TAB ── */}
      {activeTab === "verify" && (
        <ScrollView
          contentContainerStyle={s.tabContent}
          showsVerticalScrollIndicator={false}
        >
          {station?.verified ? (
            <View style={s.verifyCenter}>
              <View style={[s.verifyHero, { backgroundColor: "#22C55E18" }]}>
                <MaterialIcons name="verified" size={52} color="#22C55E" />
              </View>
              <Text style={[s.verifyTitle, { color: theme.text }]}>
                Station Verified
              </Text>
              <Text style={[s.verifySub, { color: theme.icon }]}>
                This station has been verified by Gaznger and displays the
                verified badge to customers.
              </Text>
              <View
                style={[
                  s.verifyBenefits,
                  { backgroundColor: theme.surface, borderColor: theme.ash },
                ]}
              >
                {[
                  "Verified badge on station map pin",
                  "Higher ranking in customer search",
                  "Eligible for Gaznger Partner status",
                  "Priority customer notifications",
                ].map((b, i) => (
                  <View key={i} style={s.benefitRow}>
                    <View
                      style={[s.benefitDot, { backgroundColor: "#22C55E18" }]}
                    >
                      <MaterialIcons
                        name="check-circle"
                        size={14}
                        color="#22C55E"
                      />
                    </View>
                    <Text style={[s.benefitText, { color: theme.text }]}>
                      {b}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={s.verifyCenter}>
              <View style={[s.verifyHero, { backgroundColor: "#F59E0B18" }]}>
                <Ionicons name="shield-outline" size={48} color="#F59E0B" />
              </View>
              <Text style={[s.verifyTitle, { color: theme.text }]}>
                Verify This Station
              </Text>
              <Text style={[s.verifySub, { color: theme.icon }]}>
                Verified stations earn customer trust, appear higher in search
                results, and unlock platform features.
              </Text>
              <View
                style={[
                  s.verifyBenefits,
                  { backgroundColor: theme.surface, borderColor: theme.ash },
                ]}
              >
                <Text style={[s.benefitsTitle, { color: theme.text }]}>
                  What you'll need
                </Text>
                {[
                  {
                    icon: "document-text-outline" as const,
                    text: "CAC Certificate of incorporation",
                  },
                  {
                    icon: "receipt-outline" as const,
                    text: "Tax Identification Number (TIN) document",
                  },
                  {
                    icon: "card-outline" as const,
                    text: "Director's government-issued ID",
                  },
                ].map((item, i) => (
                  <View key={i} style={s.benefitRow}>
                    <View
                      style={[
                        s.benefitDot,
                        { backgroundColor: theme.tertiary },
                      ]}
                    >
                      <Ionicons
                        name={item.icon}
                        size={14}
                        color={theme.primary}
                      />
                    </View>
                    <Text style={[s.benefitText, { color: theme.text }]}>
                      {item.text}
                    </Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: theme.primary }]}
                onPress={() => router.push("/(vendor)/verification" as any)}
                activeOpacity={0.85}
              >
                <Text style={s.saveBtnText}>Start Verification</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── REVIEWS TAB ── */}
      {activeTab === "reviews" && (
        <ScrollView
          contentContainerStyle={s.tabContent}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              s.reviewSummary,
              { backgroundColor: theme.surface, borderColor: theme.ash },
            ]}
          >
            <Text style={[s.reviewAvgNum, { color: theme.text }]}>
              {station?.rating?.toFixed(1) ?? "—"}
            </Text>
            <StarRow rating={station?.rating ?? 0} />
            <Text style={[s.reviewCount, { color: theme.icon }]}>
              {station?.totalReviews ?? reviews.length} review
              {(station?.totalReviews ?? reviews.length) !== 1 ? "s" : ""}
            </Text>
          </View>
          {loadingReviews ? (
            <ActivityIndicator
              size="small"
              color={theme.primary}
              style={{ marginTop: 24 }}
            />
          ) : reviews.length === 0 ? (
            <View style={s.emptyReviews}>
              <Ionicons name="star-outline" size={40} color={theme.ash} />
              <Text style={[s.emptyText, { color: theme.icon }]}>
                No reviews yet
              </Text>
              <Text style={[s.emptySub, { color: theme.icon }]}>
                Reviews from customers will appear here
              </Text>
            </View>
          ) : (
            reviews.map((r) => (
              <View
                key={r._id}
                style={[
                  s.reviewCard,
                  { backgroundColor: theme.surface, borderColor: theme.ash },
                ]}
              >
                <View style={s.reviewTop}>
                  <View
                    style={[
                      s.reviewAvatar,
                      { backgroundColor: theme.tertiary },
                    ]}
                  >
                    <Text
                      style={[s.reviewAvatarText, { color: theme.primary }]}
                    >
                      {r.user?.displayName?.charAt(0).toUpperCase() ?? "?"}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.reviewerName, { color: theme.text }]}>
                      {r.user?.displayName ?? "Customer"}
                    </Text>
                    <StarRow rating={r.rating} />
                  </View>
                  <Text style={[s.reviewDate, { color: theme.icon }]}>
                    {new Date(r.createdAt).toLocaleDateString("en-NG", {
                      day: "numeric",
                      month: "short",
                    })}
                  </Text>
                </View>
                {r.comment ? (
                  <Text style={[s.reviewComment, { color: theme.text }]}>
                    {r.comment}
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },

    header: {
      flexDirection: "row", alignItems: "center", gap: 10,
      paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1,
    },
    backBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontSize: 17, fontWeight: "700" },
    headerMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 },
    verifiedRow: { flexDirection: "row", alignItems: "center", gap: 3 },
    verifiedLabel: { fontSize: 11, fontWeight: "600" },
    unverifiedLabel: { fontSize: 11 },

    tabBar: { borderBottomWidth: 1, flexGrow: 0 },
    tabItem: { alignItems: "center", paddingVertical: 10, paddingHorizontal: 14, gap: 3, position: "relative" },
    tabLabel: { fontSize: 11 },
    tabIndicator: { position: "absolute", bottom: 0, left: "15%", right: "15%", height: 2, borderRadius: 2 },

    tabContent: { padding: 16, paddingBottom: 40 },
    tabDesc: { fontSize: 13, lineHeight: 20, marginBottom: 16 },
    sectionLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10, marginTop: 4 },
    input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
    row: { flexDirection: "row", gap: 10 },

    // Map
    mapWrap: { borderRadius: 14, borderWidth: 1, overflow: "hidden", height: 240, marginBottom: 20, position: "relative" },
    map: { width: "100%", height: "100%" },
    locateBtn: {
      position: "absolute", top: 10, right: 10,
      width: 36, height: 36, borderRadius: 10, borderWidth: 1,
      alignItems: "center", justifyContent: "center",
    },
    pinBubble: {
      width: 36, height: 36, borderRadius: 10,
      justifyContent: "center", alignItems: "center",
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25, shadowRadius: 4, elevation: 4,
    },
    pinTail: {
      width: 0, height: 0,
      borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8,
      borderLeftColor: "transparent", borderRightColor: "transparent",
    },
    mapTooltip: {
      position: "absolute", top: 10, alignSelf: "center",
      flexDirection: "row", alignItems: "center", gap: 6,
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12,
    },
    mapTooltipText: { fontSize: 11, fontWeight: "400" },
    mapOverlay: {
      position: "absolute", bottom: 10, alignSelf: "center",
      flexDirection: "row", alignItems: "center", gap: 6,
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12,
    },
    mapOverlayText: { fontSize: 11, fontWeight: "400" },

    statsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
    statCard: {
      flex: 1, alignItems: "center", gap: 4,
      paddingVertical: 12, borderRadius: 14, borderWidth: 1,
    },
    statVal: { fontSize: 16, fontWeight: "700" },
    statLabel: { fontSize: 11 },

    noticeBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 12, marginBottom: 16 },
    noticeText: { fontSize: 12, lineHeight: 18, flex: 1 },

    saveBtn: { paddingVertical: 15, borderRadius: 14, alignItems: "center", marginTop: 8 },
    saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },

    // Verify tab
    verifyCenter: { alignItems: "center", paddingTop: 12, gap: 12 },
    verifyHero: { width: 96, height: 96, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 4 },
    verifyTitle: { fontSize: 20, fontWeight: "700", textAlign: "center" },
    verifySub: { fontSize: 14, lineHeight: 22, textAlign: "center" },
    verifyBenefits: { width: "100%", borderRadius: 16, borderWidth: 1, padding: 16, gap: 10, marginTop: 4 },
    benefitsTitle: { fontSize: 13, fontWeight: "700", marginBottom: 4 },
    benefitRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    benefitDot: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    benefitText: { fontSize: 13, flex: 1 },

    reviewSummary: { alignItems: "center", gap: 6, padding: 20, borderRadius: 16, borderWidth: 1, marginBottom: 16 },
    reviewAvgNum: { fontSize: 36, fontWeight: "700" },
    reviewCount: { fontSize: 12 },
    emptyReviews: { alignItems: "center", gap: 8, paddingTop: 48 },
    emptyText: { fontSize: 15, fontWeight: "600" },
    emptySub: { fontSize: 13, textAlign: "center" },
    reviewCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10, gap: 8 },
    reviewTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    reviewAvatar: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    reviewAvatarText: { fontSize: 15, fontWeight: "700" },
    reviewerName: { fontSize: 13, fontWeight: "600", marginBottom: 2 },
    reviewDate: { fontSize: 11 },
    reviewComment: { fontSize: 13, lineHeight: 19 },

    // Photos tab
    photoPreviewScroll: { marginBottom: 12 },
    photoPreviewContent: { gap: 10, paddingRight: 4 },
    photoThumbWrap: { width: 110, height: 84, borderRadius: 12, overflow: "hidden", position: "relative" },
    photoThumb: { width: "100%", height: "100%" },
    photoCoverBadge: {
      position: "absolute", bottom: 6, left: 6,
      flexDirection: "row", alignItems: "center", gap: 3,
      paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6,
    },
    photoCoverText: { fontSize: 10, fontWeight: "700", color: "#fff" },
    photoRemoveBtn: { position: "absolute", top: 4, right: 4 },
    photoCoverHint: {
      flexDirection: "row", alignItems: "flex-start", gap: 8,
      padding: 12, borderRadius: 12, marginBottom: 14,
    },
    photoCoverHintText: { flex: 1, fontSize: 12, lineHeight: 17 },
    photoUploadBtn: { borderWidth: 1.5, borderStyle: "dashed", borderRadius: 16, paddingVertical: 32, alignItems: "center", gap: 8 },
    photoUploadBtnText: { fontSize: 15, fontWeight: "600" },
    photoUploadHint: { fontSize: 12 },
  });
