import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, Switch, Animated, Image, ImageSourcePropType,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useTheme } from "@/constants/theme";
import { useSessionStore } from "@/store/useSessionStore";
import { useOrderStore } from "@/store/useOrderStore";
import { api } from "@/lib/api";
import NotificationButton from "@/components/ui/global/NotificationButton";
import ProfileButton from "@/components/ui/global/ProfileButton";
import FuelPriceTicker from "@/components/ui/home/FuelPriceTicker";
import VendorPromoBanner from "@/components/ui/home/VendorPromoBanner";

/* ── Fuel icon assets (same as delivery.tsx) ── */
const FUEL_LOCAL_ICON: Record<string, ImageSourcePropType> = {
  petrol: require("../../../assets/icons/fuel/petrol-icon.png"),
  diesel: require("../../../assets/icons/fuel/diesel-icon.png"),
  gas:    require("../../../assets/icons/fuel/gas-icon.png"),
  oil:    require("../../../assets/icons/fuel/oil-icon.png"),
};

function fuelAsset(name?: string): ImageSourcePropType {
  const k = name?.toLowerCase() ?? "";
  if (k.includes("diesel") || k.includes("ago")) return FUEL_LOCAL_ICON.diesel;
  if (k.includes("gas") || k.includes("lpg") || k.includes("kerosene")) return FUEL_LOCAL_ICON.gas;
  if (k.includes("oil")) return FUEL_LOCAL_ICON.oil;
  return FUEL_LOCAL_ICON.petrol; // PMS / petrol default
}

interface Station {
  _id: string;
  name: string;
  address: string;
  state: string;
  isActive: boolean;
  verified: boolean;
  autoAcceptOrders?: boolean;
  operatingHours?: { open: string; close: string };
}

interface RecentOrder {
  _id: string;
  user: { displayName: string };
  fuel: { name: string; unit: string };
  quantity: number;
  totalPrice: number;
  status: string;
  createdAt: string;
}

function fmtCurrency(n: number) {
  return "₦" + n.toLocaleString("en-NG", { minimumFractionDigits: 0 });
}

function Skeleton({ width, height, borderRadius = 8, style }: { width: number | string; height: number; borderRadius?: number; style?: object }) {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.65, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);
  return <Animated.View style={[{ width, height, borderRadius, backgroundColor: theme.ash, opacity }, style]} />;
}

function useCountUp(target: number, duration = 1000) {
  const animated = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (target <= 0) { setDisplay(0); return; }
    animated.setValue(0);
    const id = animated.addListener(({ value }) => setDisplay(Math.round(value)));
    Animated.timing(animated, { toValue: target, duration, useNativeDriver: false }).start();
    return () => animated.removeListener(id);
  }, [target]);
  return display;
}

const STATUS_COLOR: Record<string, string> = {
  pending: "#F5C518", confirmed: "#2196F3", assigned: "#9C27B0",
  "in-transit": "#FF9800", delivered: "#4CAF50", cancelled: "#F44336",
};

export default function VendorOverview() {
  const theme = useTheme();
  const router = useRouter();
  const user = useSessionStore((s) => s.user);

  const [stations, setStations] = useState<Station[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [orderStats, setOrderStats] = useState({ pending: 0, confirmed: 0, todayRevenue: 0 });
  const [dataLoaded, setDataLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingAutoAccept, setTogglingAutoAccept] = useState<string | null>(null);
  const [isVendorPartner, setIsVendorPartner] = useState(false);

  const load = useCallback(async () => {
    useOrderStore.getState().fetchFuelTypes();
    try {
      const [stationsRes, ordersRes, pendingRes, confirmedRes, profileRes] = await Promise.all([
        api.get<{ stations: Station[] }>("/api/vendor/stations"),
        api.get<{ orders: RecentOrder[]; total: number }>("/api/vendor/orders?limit=3"),
        api.get<{ total: number }>("/api/vendor/orders?status=pending&limit=1"),
        api.get<{ total: number }>("/api/vendor/orders?status=confirmed&limit=1"),
        api.get<{ user: { partnerBadge?: { active: boolean } } }>("/api/vendor/profile"),
      ]);
      setStations(stationsRes.stations ?? []);
      setRecentOrders(ordersRes.orders ?? []);
      setIsVendorPartner(profileRes.user?.partnerBadge?.active === true);
      const today = new Date().toDateString();
      const todayRevenue = (ordersRes.orders ?? [])
        .filter((o) => new Date(o.createdAt).toDateString() === today)
        .reduce((sum, o) => sum + o.totalPrice, 0);
      setOrderStats({ pending: pendingRes.total, confirmed: confirmedRes.total, todayRevenue });
    } catch {
      // stale data ok
    } finally {
      setDataLoaded(true);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  const toggleAutoAccept = useCallback(async (stationId: string, value: boolean) => {
    setTogglingAutoAccept(stationId);
    setStations((prev) => prev.map((s) => s._id === stationId ? { ...s, autoAcceptOrders: value } : s));
    try {
      await api.patch("/api/vendor/station", { stationId, autoAcceptOrders: value });
      const fresh = await api.get<{ stations: Station[] }>("/api/vendor/stations");
      if (fresh.stations) setStations(fresh.stations);
    } catch {
      setStations((prev) => prev.map((s) => s._id === stationId ? { ...s, autoAcceptOrders: !value } : s));
    } finally {
      setTogglingAutoAccept(null);
    }
  }, []);

  const anyVerified = stations.some((s) => s.verified);

  const countPending  = useCountUp(orderStats.pending);
  const countConfirmed = useCountUp(orderStats.confirmed);
  const countRevenue  = useCountUp(orderStats.todayRevenue);

  const renderStationCard = (station: Station, compact = false) => (
    <TouchableOpacity
      key={station._id}
      style={[
        s.card,
        compact && s.cardCompact,
        { backgroundColor: theme.surface, borderColor: theme.ash },
      ]}
      activeOpacity={0.9}
      onPress={() => router.push(`/(vendor)/station/${station._id}` as any)}
    >
      <View style={s.stationRow}>
        <View style={[s.stationIconWrap, { backgroundColor: theme.tertiary }]}>
          <MaterialIcons
            name="local-gas-station"
            size={20}
            color={theme.primary}
          />

          {/* Partner badge (LEFT) */}
          {isVendorPartner && (
            <View
              style={[s.dot, s.leftDot, { backgroundColor: theme.surface }]}
            >
              <Ionicons name="ribbon-outline" size={12} color={theme.primary} />
            </View>
          )}

          {/* Verified badge (RIGHT) */}
          {station.verified && (
            <View
              style={[s.dot, s.rightDot, { backgroundColor: theme.surface }]}
            >
              <MaterialIcons name="verified" size={12} color="#22C55E" />
            </View>
          )}
        </View>
        <View style={s.stationInfo}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text
              style={[s.stationName, { color: theme.text }]}
              numberOfLines={1}
            >
              {station.name}
            </Text>
          </View>
          <Text
            style={[s.stationAddr, { color: theme.icon }]}
            numberOfLines={1}
          >
            {station.address}, {station.state}
          </Text>
        </View>
        {/* Status badge — read-only here, manage in station detail */}
        <View
          style={[
            s.statusBadge,
            {
              backgroundColor: station.isActive
                ? "#05966915"
                : theme.ash + "60",
            },
          ]}
        >
          <View
            style={[
              s.statusDot,
              { backgroundColor: station.isActive ? "#059669" : theme.icon },
            ]}
          />
          <Text
            style={[
              s.statusText,
              { color: station.isActive ? "#059669" : theme.icon },
            ]}
          >
            {station.isActive ? "Open" : "Closed"}
          </Text>
        </View>
      </View>

      {/* Auto-accept only */}
      <View
        style={[
          s.metaRow,
          { borderTopColor: theme.ash, justifyContent: "space-between" },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <MaterialIcons name="update" size={13} color={theme.icon} />
          <Text style={[s.metaText, { color: theme.icon }]}>
            Auto-accept orders
          </Text>
        </View>
        <Switch
          value={station.autoAcceptOrders ?? false}
          onValueChange={(v) => toggleAutoAccept(station._id, v)}
          disabled={togglingAutoAccept === station._id}
          trackColor={{ false: theme.ash, true: theme.primary + "66" }}
          thumbColor={station.autoAcceptOrders ? theme.primary : theme.icon}
        />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Text style={[s.greeting, { color: theme.icon }]}>Good day,</Text>
            <Text style={[s.name, { color: theme.text }]}>{user?.displayName ?? "Vendor"}</Text>
          </View>
          <View style={s.headerRight}>
            <NotificationButton onPress={() => router.push("/(screens)/notification" as any)} />
            <ProfileButton
              onPress={() => router.push("/(vendor)/(dashboard)/profile" as any)}
              size={40}
            />
          </View>
        </View>

        {/* ── Verification Banner ── */}
        {stations.length > 0 && !anyVerified && (
          <TouchableOpacity
            style={[s.verifyBanner, { backgroundColor: "#F59E0B11", borderColor: "#F59E0B44" }]}
            activeOpacity={0.85}
            onPress={() => router.push("/(vendor)/verification" as any)}
          >
            <View style={[s.verifyIconWrap, { backgroundColor: "#F59E0B22" }]}>
              <Ionicons name="shield-outline" size={18} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.verifyTitle, { color: theme.text }]}>Get Verified</Text>
              <Text style={[s.verifySub, { color: theme.icon }]}>Submit documents to verify your business</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.icon} />
          </TouchableOpacity>
        )}

        {/* ── Stats Row ── */}
        <View style={s.statsRow}>
          <View style={[s.statCard, { backgroundColor: "#F5C51811", borderColor: "#F5C51833" }]}>
            <Ionicons name="time-outline" size={20} color="#F5C518" />
            {dataLoaded ? <Text style={[s.statValue, { color: theme.text }]}>{countPending}</Text> : <Skeleton width={32} height={20} />}
            <Text style={[s.statLabel, { color: theme.icon }]}>Pending</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: "#2196F311", borderColor: "#2196F333" }]}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#2196F3" />
            {dataLoaded ? <Text style={[s.statValue, { color: theme.text }]}>{countConfirmed}</Text> : <Skeleton width={32} height={20} />}
            <Text style={[s.statLabel, { color: theme.icon }]}>Confirmed</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: theme.accentLight, borderColor: theme.accent + "33" }]}>
            <Ionicons name="cash-outline" size={20} color={theme.accent} />
            {dataLoaded ? <Text style={[s.statValue, { color: theme.text }]}>{fmtCurrency(countRevenue)}</Text> : <Skeleton width={64} height={20} />}
            <Text style={[s.statLabel, { color: theme.icon }]}>Today</Text>
          </View>
        </View>

        {/* ── Vendor Promo Banner ── */}
        <VendorPromoBanner />

        {/* ── Stations ── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: theme.text }]}>My Stations</Text>
            <TouchableOpacity onPress={() => router.push("/(vendor)/onboarding" as any)}>
              <Text style={[s.seeAll, { color: theme.primary }]}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {stations.length === 0 ? (
            <TouchableOpacity
              style={[s.card, s.noStationCard, { backgroundColor: theme.surface, borderColor: theme.ash }]}
              onPress={() => router.push("/(vendor)/onboarding" as any)}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={28} color={theme.primary} />
              <Text style={[s.noStationText, { color: theme.icon }]}>Set up your first station</Text>
            </TouchableOpacity>
          ) : stations.length === 1 ? (
            renderStationCard(stations[0])
          ) : (
            /* 2+ stations: horizontal scroll */
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingRight: 4 }}
              decelerationRate="fast"
              snapToInterval={288}
              snapToAlignment="start"
            >
              {stations.map((st) => renderStationCard(st, true))}
            </ScrollView>
          )}
        </View>

        {/* ── Market Prices ── */}
        <FuelPriceTicker />

        {/* ── Recent Orders ── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: theme.text }]}>Recent Orders</Text>
            <TouchableOpacity onPress={() => router.push("/(vendor)/(dashboard)/orders" as any)}>
              <Text style={[s.seeAll, { color: theme.primary }]}>See all</Text>
            </TouchableOpacity>
          </View>
          {recentOrders.length === 0 ? (
            <View style={[s.emptyCard, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
              <Ionicons name="receipt-outline" size={24} color={theme.ash} />
              <Text style={[s.emptyText, { color: theme.icon }]}>No orders yet</Text>
            </View>
          ) : (
            recentOrders.map((order) => {
              const color = STATUS_COLOR[order.status] ?? theme.icon;
              const statusLabel = order.status.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
              return (
                <TouchableOpacity
                  key={order._id}
                  style={[s.orderRow, { backgroundColor: theme.surface, borderColor: theme.ash }]}
                  onPress={() => router.push("/(vendor)/(dashboard)/orders" as any)}
                  activeOpacity={0.8}
                >
                  <View style={[s.orderIconWrap, { backgroundColor: theme.tertiary }]}>
                    <Image source={fuelAsset(order.fuel?.name)} style={s.fuelImg} resizeMode="contain" />
                  </View>
                  <View style={s.orderLeft}>
                    <Text style={[s.orderCustomer, { color: theme.text }]} numberOfLines={1}>
                      {order.fuel?.name} · {order.quantity} {order.fuel?.unit}
                    </Text>
                    <Text style={[s.orderDetail, { color: theme.icon }]}>
                      {order.user?.displayName ?? "Customer"} · {new Date(order.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                    </Text>
                  </View>
                  <View style={s.orderRight}>
                    <Text style={[s.orderPrice, { color: theme.primary }]}>{fmtCurrency(order.totalPrice)}</Text>
                    <View style={[s.statusPill, { backgroundColor: color + "20" }]}>
                      <Text style={[s.statusPillText, { color }]}>{statusLabel}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  greeting: { fontSize: 13 },
  name: { fontSize: 22, fontWeight: "700", marginTop: 2 },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    overflow: "hidden",
  },
  verifiedDot: {
    position: "absolute",
    bottom: -3,
    right: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  verifyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  verifyIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  verifyTitle: { fontSize: 13, fontWeight: "600", marginBottom: 1 },
  verifySub: { fontSize: 11, fontWeight: "300" },

  statsRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
    gap: 5,
  },
  statValue: { fontSize: 16, fontWeight: "700" },
  statLabel: { fontSize: 11 },

  section: { gap: 10 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  seeAll: { fontSize: 13, fontWeight: "600" },

  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  cardCompact: { width: 280 },
  noStationCard: { alignItems: "center", paddingVertical: 24, gap: 8 },
  noStationText: { fontSize: 14 },

  stationRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stationIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stationInfo: { flex: 1 },
  stationName: { fontSize: 15, fontWeight: "700" },
  stationAddr: { fontSize: 12, marginTop: 2 },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  dot: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  leftDot: {
    left: -3,
    bottom: -3,
  },

  rightDot: {
    right: -3,
    bottom: -3,
  },
  statusText: { fontSize: 11, fontWeight: "600" },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  metaText: { fontSize: 12 },

  emptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 6,
  },
  emptyText: { fontSize: 13 },

  orderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  orderIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  fuelImg: { width: 22, height: 22 },
  orderLeft: { flex: 1 },
  orderCustomer: { fontSize: 14, fontWeight: "600" },
  orderDetail: { fontSize: 12, marginTop: 2 },
  orderRight: { alignItems: "flex-end", gap: 4 },
  orderPrice: { fontSize: 14, fontWeight: "700" },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
  },

  partnerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  partnerBadgeText: { fontSize: 10, fontWeight: "600" },
});
