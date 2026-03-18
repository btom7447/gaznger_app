import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/constants/theme";
import { useSessionStore } from "@/store/useSessionStore";
import { api } from "@/lib/api";

interface StationFuel {
  _id: string;
  fuel: { _id: string; name: string; unit: string };
  pricePerUnit: number;
  available: boolean;
}

interface Station {
  _id: string;
  name: string;
  address: string;
  state: string;
  isActive: boolean;
  verified: boolean;
  operatingHours?: { open: string; close: string };
  fuels: StationFuel[];
}

interface OrderStats {
  pending: number;
  confirmed: number;
  todayRevenue: number;
}

interface ProfileResponse {
  user: { displayName: string };
  station: Station | null;
}

interface OrdersResponse {
  orders: { totalPrice: number; createdAt: string }[];
  total: number;
}

export default function VendorOverview() {
  const theme = useTheme();
  const user = useSessionStore((s) => s.user);

  const [station, setStation] = useState<Station | null>(null);
  const [stats, setStats] = useState<OrderStats>({ pending: 0, confirmed: 0, todayRevenue: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingStation, setTogglingStation] = useState(false);

  const load = useCallback(async () => {
    try {
      const [profileRes, pendingRes, confirmedRes, todayRes] = await Promise.all([
        api.get<ProfileResponse>("/api/vendor/profile"),
        api.get<OrdersResponse>("/api/vendor/orders?status=pending&limit=1"),
        api.get<OrdersResponse>("/api/vendor/orders?status=confirmed&limit=1"),
        api.get<OrdersResponse>("/api/vendor/orders?limit=50"),
      ]);

      setStation(profileRes.station);

      const today = new Date().toDateString();
      const todayRevenue = todayRes.orders
        .filter((o) => new Date(o.createdAt).toDateString() === today)
        .reduce((sum, o) => sum + o.totalPrice, 0);

      setStats({
        pending: pendingRes.total,
        confirmed: confirmedRes.total,
        todayRevenue,
      });
    } catch {
      // silently fail — stale data shown
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const toggleStation = useCallback(async (value: boolean) => {
    if (!station) return;
    setTogglingStation(true);
    try {
      await api.patch("/api/vendor/station", { isActive: value });
      setStation((prev) => prev ? { ...prev, isActive: value } : prev);
    } catch {
      // revert optimistic UI
      setStation((prev) => prev ? { ...prev, isActive: !value } : prev);
    } finally {
      setTogglingStation(false);
    }
  }, [station]);

  if (loading) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const fmtCurrency = (n: number) =>
    "₦" + n.toLocaleString("en-NG", { minimumFractionDigits: 0 });

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={[s.greeting, { color: theme.icon }]}>Good day,</Text>
            <Text style={[s.name, { color: theme.text }]}>{user?.displayName ?? "Vendor"}</Text>
          </View>
          {station?.verified && (
            <View style={[s.badge, { backgroundColor: theme.tertiary }]}>
              <Ionicons name="checkmark-circle" size={14} color={theme.secondary} />
              <Text style={[s.badgeText, { color: theme.secondary }]}>Verified</Text>
            </View>
          )}
        </View>

        {/* Station Card */}
        {station ? (
          <View style={[s.stationCard, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
            <View style={s.stationRow}>
              <View style={s.stationInfo}>
                <Text style={[s.stationName, { color: theme.text }]}>{station.name}</Text>
                <Text style={[s.stationAddr, { color: theme.icon }]} numberOfLines={1}>
                  {station.address}, {station.state}
                </Text>
              </View>
              <View style={s.toggleWrap}>
                <Text style={[s.toggleLabel, { color: station.isActive ? theme.secondary : theme.icon }]}>
                  {station.isActive ? "Open" : "Closed"}
                </Text>
                <Switch
                  value={station.isActive}
                  onValueChange={toggleStation}
                  disabled={togglingStation}
                  trackColor={{ false: theme.ash, true: theme.secondary + "66" }}
                  thumbColor={station.isActive ? theme.secondary : theme.icon}
                />
              </View>
            </View>
            {station.operatingHours?.open && (
              <View style={s.hoursRow}>
                <Ionicons name="time-outline" size={13} color={theme.icon} />
                <Text style={[s.hoursText, { color: theme.icon }]}>
                  {station.operatingHours.open} – {station.operatingHours.close}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={[s.stationCard, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
            <Text style={[s.noStation, { color: theme.icon }]}>Station not set up yet.</Text>
          </View>
        )}

        {/* Stats Row */}
        <View style={s.statsRow}>
          <View style={[s.statCard, { backgroundColor: theme.tertiary }]}>
            <Ionicons name="time-outline" size={22} color={theme.primary} />
            <Text style={[s.statValue, { color: theme.text }]}>{stats.pending}</Text>
            <Text style={[s.statLabel, { color: theme.icon }]}>Pending</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: theme.tertiary }]}>
            <Ionicons name="checkmark-circle-outline" size={22} color={theme.secondary} />
            <Text style={[s.statValue, { color: theme.text }]}>{stats.confirmed}</Text>
            <Text style={[s.statLabel, { color: theme.icon }]}>Confirmed</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: theme.accentLight }]}>
            <Ionicons name="cash-outline" size={22} color={theme.accent} />
            <Text style={[s.statValue, { color: theme.text }]}>{fmtCurrency(stats.todayRevenue)}</Text>
            <Text style={[s.statLabel, { color: theme.icon }]}>Today</Text>
          </View>
        </View>

        {/* Fuel Offerings */}
        {station && station.fuels.length > 0 && (
          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: theme.text }]}>Fuel Offerings</Text>
            {station.fuels.map((f) => (
              <View key={f._id} style={[s.fuelRow, { borderColor: theme.ash }]}>
                <View>
                  <Text style={[s.fuelName, { color: theme.text }]}>{f.fuel?.name ?? "—"}</Text>
                  <Text style={[s.fuelUnit, { color: theme.icon }]}>per {f.fuel?.unit ?? "unit"}</Text>
                </View>
                <View style={s.fuelRight}>
                  <Text style={[s.fuelPrice, { color: theme.primary }]}>
                    {fmtCurrency(f.pricePerUnit)}
                  </Text>
                  <View
                    style={[
                      s.availDot,
                      { backgroundColor: f.available ? theme.success : theme.error },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  greeting: { fontSize: 13 },
  name: { fontSize: 22, fontWeight: "700", marginTop: 2 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: "600" },
  stationCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 8 },
  stationRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stationInfo: { flex: 1, marginRight: 12 },
  stationName: { fontSize: 16, fontWeight: "700" },
  stationAddr: { fontSize: 13, marginTop: 2 },
  toggleWrap: { alignItems: "center", gap: 2 },
  toggleLabel: { fontSize: 12, fontWeight: "600" },
  hoursRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  hoursText: { fontSize: 12 },
  noStation: { fontSize: 14, textAlign: "center", paddingVertical: 8 },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, borderRadius: 12, padding: 14, alignItems: "center", gap: 6 },
  statValue: { fontSize: 16, fontWeight: "700" },
  statLabel: { fontSize: 11 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  fuelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1 },
  fuelName: { fontSize: 14, fontWeight: "600" },
  fuelUnit: { fontSize: 12, marginTop: 2 },
  fuelRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  fuelPrice: { fontSize: 15, fontWeight: "700" },
  availDot: { width: 8, height: 8, borderRadius: 4 },
});
