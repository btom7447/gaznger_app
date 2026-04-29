import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  StatusBar,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { toast } from "sonner-native";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";
import BackButton from "@/components/ui/global/BackButton";

interface Station {
  _id: string;
  name: string;
  address: string;
  state: string;
  lga: string;
  verified: boolean;
  isActive: boolean;
  operatingHours?: { open: string; close: string };
  rating: number;
  fuels: { fuel: { name: string }; pricePerUnit: number; available: boolean }[];
}

/* ─── Skeleton ───────────────────────────────────────────────────────────── */
function SkeletonCard({ theme }: { theme: ReturnType<typeof useTheme> }) {
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
    <Animated.View
      style={[s_skel.card, { backgroundColor: theme.surface, borderColor: theme.ash, opacity: anim }]}
    >
      {/* Top */}
      <View style={s_skel.cardTop}>
        <View style={{ flex: 1, gap: 8 }}>
          <View style={[s_skel.line, { width: "60%", backgroundColor: bg }]} />
          <View style={[s_skel.line, { width: "80%", height: 11, backgroundColor: bg }]} />
        </View>
        <View style={[s_skel.badge, { backgroundColor: bg }]} />
      </View>
      {/* Meta */}
      <View style={[s_skel.meta, { borderTopColor: theme.ash }]}>
        <View style={[s_skel.line, { width: "40%", backgroundColor: bg }]} />
        <View style={[s_skel.starRow, { gap: 3 }]}>
          {[0,1,2,3,4].map((i) => (
            <View key={i} style={[s_skel.starDot, { backgroundColor: bg }]} />
          ))}
        </View>
      </View>
      {/* Fuels */}
      <View style={[s_skel.fuels, { borderTopColor: theme.ash }]}>
        {[0,1,2].map((i) => (
          <View key={i} style={[s_skel.chip, { backgroundColor: bg }]} />
        ))}
      </View>
    </Animated.View>
  );
}

const s_skel = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, marginBottom: 14, overflow: "hidden" },
  cardTop: { flexDirection: "row", alignItems: "flex-start", padding: 14, gap: 12 },
  line: { height: 13, borderRadius: 6 },
  badge: { width: 64, height: 26, borderRadius: 13 },
  meta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  starRow: { flexDirection: "row", alignItems: "center" },
  starDot: { width: 13, height: 13, borderRadius: 7 },
  fuels: { flexDirection: "row", gap: 6, borderTopWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  chip: { width: 52, height: 22, borderRadius: 10 },
});

/* ─── Screen ─────────────────────────────────────────────────────────────── */
export default function StationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingStation, setTogglingStation] = useState<string | null>(null);
  const [isVendorPartner, setIsVendorPartner] = useState(false);

  const fetchStations = useCallback(async () => {
    try {
      const [stationsData, profileData] = await Promise.all([
        api.get<{ stations: Station[] }>("/api/vendor/stations"),
        api.get<{ user: { partnerBadge?: { active: boolean } } }>("/api/vendor/profile"),
      ]);
      setStations(stationsData.stations ?? []);
      setIsVendorPartner(profileData.user?.partnerBadge?.active === true);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStations(); }, [fetchStations]);

  const toggleStation = async (stationId: string, current: boolean) => {
    setTogglingStation(stationId);
    setStations((prev) => prev.map((s) => s._id === stationId ? { ...s, isActive: !current } : s));
    try {
      await api.patch("/api/vendor/station", { stationId, isActive: !current });
    } catch {
      setStations((prev) => prev.map((s) => s._id === stationId ? { ...s, isActive: current } : s));
      toast.error("Could not update station status");
    } finally {
      setTogglingStation(null);
    }
  };

  const s = styles(theme);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle={theme.mode === "dark" ? "light-content" : "dark-content"} />

      {/* Header */}
      <View style={s.header}>
        <BackButton />
        <Text style={s.headerTitle}>My Stations</Text>
        <TouchableOpacity
          style={[s.addBtn, { backgroundColor: theme.primary }]}
          onPress={() => router.push("/(vendor)/onboarding" as any)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={16} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {loading ? (
          <>
            <SkeletonCard theme={theme} />
            <SkeletonCard theme={theme} />
            <SkeletonCard theme={theme} />
          </>
        ) : stations.length === 0 ? (
          <TouchableOpacity
            style={[s.empty, { backgroundColor: theme.surface, borderColor: theme.ash }]}
            onPress={() => router.push("/(vendor)/onboarding" as any)}
            activeOpacity={0.8}
          >
            <Ionicons name="business-outline" size={32} color={theme.icon} />
            <Text style={[s.emptyTitle, { color: theme.text }]}>No stations yet</Text>
            <Text style={[s.emptyText, { color: theme.icon }]}>Tap to set up your first station</Text>
          </TouchableOpacity>
        ) : (
          stations.map((station) => (
            <TouchableOpacity
              key={station._id}
              style={[s.card, { backgroundColor: theme.surface, borderColor: theme.ash }]}
              onPress={() => router.push(`/(vendor)/station/${station._id}` as any)}
              activeOpacity={0.88}
            >
              {/* Top row */}
              <View style={s.cardTop}>
                <View style={{ flex: 1 }}>
                  <View style={s.nameRow}>
                    <Text style={[s.stationName, { color: theme.text }]}>{station.name}</Text>
                    {station.verified && (
                      <View style={[s.verifiedBadge, { backgroundColor: "#D1FAE5" }]}>
                        <MaterialIcons name="verified" size={11} color="#059669" />
                        <Text style={s.verifiedText}>Verified</Text>
                      </View>
                    )}
                    {isVendorPartner && (
                      <View style={[s.partnerBadge, { backgroundColor: theme.primary + "18" }]}>
                        <Ionicons name="ribbon-outline" size={11} color={theme.primary} />
                        <Text style={[s.partnerBadgeText, { color: theme.primary }]}>Partner</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[s.stationAddr, { color: theme.icon }]}>
                    {station.address}, {station.state}
                  </Text>
                </View>

                {/* Open/Close Switch */}
                <View style={s.toggleWrap}>
                  <Switch
                    value={station.isActive}
                    onValueChange={() => toggleStation(station._id, station.isActive)}
                    disabled={togglingStation === station._id}
                  />
                  <Text style={[s.toggleLabel, { color: station.isActive ? "#22C55E" : theme.icon }]}>
                    {station.isActive ? "Open" : "Closed"}
                  </Text>
                </View>
              </View>

              {/* Meta row: hours + star rating */}
              <View style={[s.metaRow, { borderTopColor: theme.ash }]}>
                <View style={s.metaItem}>
                  <Ionicons name="time-outline" size={13} color={theme.icon} />
                  <Text style={[s.metaText, { color: theme.icon }]}>
                    {station.operatingHours
                      ? `${station.operatingHours.open} – ${station.operatingHours.close}`
                      : "Hours not set"}
                  </Text>
                </View>
                {/* Full star row */}
                <View style={s.starRow}>
                  {[1,2,3,4,5].map((i) => (
                    <Ionicons
                      key={i}
                      name={i <= Math.round(station.rating ?? 0) ? "star" : "star-outline"}
                      size={13}
                      color="#FBBF24"
                    />
                  ))}
                  <Text style={[s.ratingNum, { color: theme.icon }]}>
                    {(station.rating ?? 0).toFixed(1)}
                  </Text>
                </View>
              </View>

              {/* Fuels */}
              {station.fuels?.length > 0 && (
                <View style={[s.fuelsRow, { borderTopColor: theme.ash }]}>
                  {station.fuels.map((f, idx) => (
                    <View
                      key={idx}
                      style={[s.fuelChip, { backgroundColor: f.available ? theme.primary + "18" : theme.ash }]}
                    >
                      <Text style={[s.fuelChipText, { color: f.available ? theme.primary : theme.icon }]}>
                        {f.fuel?.name}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Footer */}
              <View style={[s.footer, { borderTopColor: theme.ash }]}>
                <Ionicons name="create-outline" size={13} color={theme.primary} />
                <Text style={[s.footerText, { color: theme.primary }]}>Tap to manage</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row", alignItems: "center", gap: 12,
      paddingHorizontal: 16, paddingVertical: 14,
    },
    headerTitle: { flex: 1, fontSize: 20, fontWeight: "700", color: theme.text },
    addBtn: {
      width: 34, height: 34, borderRadius: 10,
      alignItems: "center", justifyContent: "center",
    },
    scroll: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 4 },

    empty: {
      borderRadius: 20, borderWidth: 1, borderStyle: "dashed",
      padding: 40, alignItems: "center", gap: 8, marginTop: 20,
    },
    emptyTitle: { fontSize: 16, fontWeight: "600", marginTop: 4 },
    emptyText: { fontSize: 13, textAlign: "center" },

    card: { borderRadius: 16, borderWidth: 1, marginBottom: 14, overflow: "hidden" },
    cardTop: { flexDirection: "row", alignItems: "flex-start", padding: 14, gap: 12 },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    stationName: { fontSize: 14, fontWeight: "700" },
    stationAddr: { fontSize: 12, marginTop: 2 },

    toggleWrap: { alignItems: "center", gap: 2 },
    toggleLabel: { fontSize: 10, fontWeight: "600" },

    verifiedBadge: {
      flexDirection: "row", alignItems: "center", gap: 3,
      paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
    },
    verifiedText: { fontSize: 10, fontWeight: "600", color: "#059669" },

    partnerBadge: {
      flexDirection: "row", alignItems: "center", gap: 3,
      paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
    },
    partnerBadgeText: { fontSize: 10, fontWeight: "600" },

    metaRow: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      borderTopWidth: 1, paddingHorizontal: 14, paddingVertical: 10,
    },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    metaText: { fontSize: 12 },

    starRow: { flexDirection: "row", alignItems: "center", gap: 2 },
    ratingNum: { fontSize: 12, marginLeft: 4 },

    fuelsRow: {
      flexDirection: "row", flexWrap: "wrap", gap: 6,
      borderTopWidth: 1, paddingHorizontal: 14, paddingVertical: 10,
    },
    fuelChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    fuelChipText: { fontSize: 11, fontWeight: "600" },

    footer: {
      flexDirection: "row", alignItems: "center", gap: 5,
      borderTopWidth: 1, paddingHorizontal: 14, paddingVertical: 10,
    },
    footerText: { fontSize: 12, fontWeight: "500" },
  });
