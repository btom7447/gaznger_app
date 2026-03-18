import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { toast } from "sonner-native";
import { useTheme } from "@/constants/theme";
import { useSessionStore } from "@/store/useSessionStore";
import { api } from "@/lib/api";

const LOCATION_POLL_MS = 30_000; // 30 seconds

type DeliveryStatus = "pending" | "accepted" | "picked_up" | "delivered" | "failed";

interface ActiveDelivery {
  _id: string;
  status: DeliveryStatus;
  riderEarnings: number;
  pickupTime?: string;
  station: { name: string; address: string };
  order: {
    _id: string;
    totalPrice: number;
    deliveryFee: number;
    fuelCost: number;
    fuel: { name: string; unit: string };
    quantity: number;
    user: { displayName: string; phone?: string };
    deliveryAddress: {
      street: string;
      city: string;
      state: string;
    };
  };
}

interface RiderProfile {
  vehicleType: string;
  vehiclePlate: string;
  isAvailable: boolean;
  isVerified: boolean;
  rating: number;
  totalDeliveries: number;
}

function fmtCurrency(n: number) {
  return "₦" + n.toLocaleString("en-NG");
}

const VEHICLE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  motorcycle: "bicycle",
  tricycle: "bicycle",
  van: "car",
};

export default function RiderQueue() {
  const theme = useTheme();
  const user = useSessionStore((s) => s.user);

  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [activeDelivery, setActiveDelivery] = useState<ActiveDelivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingAvail, setTogglingAvail] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const [profileRes, activeRes] = await Promise.all([
        api.get<RiderProfile>("/api/rider/profile"),
        api.get<{ delivery: ActiveDelivery | null }>("/api/rider/active"),
      ]);
      setProfile(profileRes);
      setActiveDelivery(activeRes.delivery);
    } catch {
      // silently fail — stale data
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Location polling ────────────────────────────────────────────────────
  // Poll every 30 s while rider is online or has an active delivery.
  useEffect(() => {
    const shouldPoll = profile?.isAvailable || !!activeDelivery;

    const startPolling = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const sendLocation = async () => {
        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          await api.patch("/api/rider/location", {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          });
        } catch {
          // location update is best-effort — never block the UI
        }
      };

      // Send once immediately, then on interval
      sendLocation();
      locationIntervalRef.current = setInterval(sendLocation, LOCATION_POLL_MS);
    };

    if (shouldPoll) {
      startPolling();
    }

    return () => {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
    };
  }, [profile?.isAvailable, activeDelivery]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const toggleAvailability = useCallback(async (value: boolean) => {
    if (!profile) return;
    setTogglingAvail(true);
    // Optimistic update
    setProfile((p) => p ? { ...p, isAvailable: value } : p);
    try {
      await api.patch("/api/rider/availability", { isAvailable: value });
    } catch (err: any) {
      setProfile((p) => p ? { ...p, isAvailable: !value } : p);
      toast.error("Could not update availability", { description: err.message });
    } finally {
      setTogglingAvail(false);
    }
  }, [profile]);

  const handlePickup = useCallback(async () => {
    if (!activeDelivery) return;
    Alert.alert("Confirm Pickup", "Confirm you have collected the fuel from the station.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm Pickup",
        onPress: async () => {
          setActionLoading(true);
          try {
            await api.patch(`/api/rider/deliveries/${activeDelivery._id}/pickup`);
            setActiveDelivery((d) => d ? { ...d, status: "picked_up", pickupTime: new Date().toISOString() } : d);
            toast.success("Pickup confirmed", { description: "Head to the delivery address." });
          } catch (err: any) {
            toast.error("Failed to confirm pickup", { description: err.message });
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  }, [activeDelivery]);

  const handleComplete = useCallback(async () => {
    if (!activeDelivery) return;
    Alert.alert("Complete Delivery", "Confirm the fuel has been delivered to the customer.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Complete",
        onPress: async () => {
          setActionLoading(true);
          try {
            await api.patch(`/api/rider/deliveries/${activeDelivery._id}/complete`);
            setActiveDelivery(null);
            // Refresh profile to update totalDeliveries
            const updated = await api.get<RiderProfile>("/api/rider/profile");
            setProfile(updated);
            toast.success("Delivery complete!", { description: "Earnings have been recorded." });
          } catch (err: any) {
            toast.error("Failed to complete delivery", { description: err.message });
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  }, [activeDelivery]);

  if (loading) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const isAvailable = profile?.isAvailable ?? false;

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
            <Text style={[s.greeting, { color: theme.icon }]}>Rider</Text>
            <Text style={[s.name, { color: theme.text }]}>{user?.displayName ?? "Rider"}</Text>
          </View>
          {profile?.isVerified && (
            <View style={[s.badge, { backgroundColor: theme.tertiary }]}>
              <Ionicons name="shield-checkmark" size={14} color={theme.secondary} />
              <Text style={[s.badgeText, { color: theme.secondary }]}>Verified</Text>
            </View>
          )}
        </View>

        {/* Profile Card */}
        {profile && (
          <View style={[s.profileCard, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
            <View style={s.profileRow}>
              <View style={[s.vehicleIcon, { backgroundColor: theme.tertiary }]}>
                <Ionicons
                  name={VEHICLE_ICON[profile.vehicleType] ?? "bicycle"}
                  size={24}
                  color={theme.primary}
                />
              </View>
              <View style={s.profileInfo}>
                <Text style={[s.vehicleType, { color: theme.text }]}>
                  {profile.vehicleType.charAt(0).toUpperCase() + profile.vehicleType.slice(1)}
                </Text>
                <Text style={[s.vehiclePlate, { color: theme.icon }]}>{profile.vehiclePlate}</Text>
              </View>
              <View style={s.statsGroup}>
                <View style={s.statItem}>
                  <Text style={[s.statVal, { color: theme.text }]}>{profile.totalDeliveries}</Text>
                  <Text style={[s.statLbl, { color: theme.icon }]}>Trips</Text>
                </View>
                <View style={s.statItem}>
                  <Text style={[s.statVal, { color: theme.text }]}>
                    {profile.rating > 0 ? profile.rating.toFixed(1) : "—"}
                  </Text>
                  <Text style={[s.statLbl, { color: theme.icon }]}>Rating</Text>
                </View>
              </View>
            </View>

            {/* Availability Toggle */}
            <View style={[s.availRow, { borderTopColor: theme.ash }]}>
              <View style={s.availLeft}>
                <View
                  style={[
                    s.availDot,
                    { backgroundColor: isAvailable ? theme.success : theme.error },
                  ]}
                />
                <Text style={[s.availText, { color: theme.text }]}>
                  {isAvailable ? "Online — accepting deliveries" : "Offline"}
                </Text>
              </View>
              <Switch
                value={isAvailable}
                onValueChange={toggleAvailability}
                disabled={togglingAvail || !!activeDelivery}
                trackColor={{ false: theme.ash, true: theme.secondary + "66" }}
                thumbColor={isAvailable ? theme.secondary : theme.icon}
              />
            </View>
          </View>
        )}

        {/* Active Delivery */}
        {activeDelivery ? (
          <View style={[s.deliveryCard, { backgroundColor: theme.surface, borderColor: theme.primary }]}>
            <View style={s.deliveryHeader}>
              <View style={[s.deliveryBadge, { backgroundColor: theme.primary + "22" }]}>
                <Text style={[s.deliveryBadgeText, { color: theme.primary }]}>
                  {activeDelivery.status === "picked_up" ? "In Transit" : "Active"}
                </Text>
              </View>
              <Text style={[s.earning, { color: theme.primary }]}>
                +{fmtCurrency(activeDelivery.riderEarnings)}
              </Text>
            </View>

            <View style={s.deliveryBody}>
              {/* Station pickup */}
              <View style={s.locationRow}>
                <Ionicons name="location" size={16} color={theme.secondary} />
                <View style={s.locationText}>
                  <Text style={[s.locationLabel, { color: theme.icon }]}>Pickup from</Text>
                  <Text style={[s.locationName, { color: theme.text }]} numberOfLines={1}>
                    {activeDelivery.station?.name}
                  </Text>
                  <Text style={[s.locationAddr, { color: theme.icon }]} numberOfLines={1}>
                    {activeDelivery.station?.address}
                  </Text>
                </View>
              </View>

              {/* Customer drop-off */}
              <View style={s.locationRow}>
                <Ionicons name="navigate" size={16} color={theme.error} />
                <View style={s.locationText}>
                  <Text style={[s.locationLabel, { color: theme.icon }]}>Deliver to</Text>
                  <Text style={[s.locationName, { color: theme.text }]}>
                    {activeDelivery.order?.user?.displayName}
                  </Text>
                  <Text style={[s.locationAddr, { color: theme.icon }]} numberOfLines={2}>
                    {activeDelivery.order?.deliveryAddress?.street},{" "}
                    {activeDelivery.order?.deliveryAddress?.city}
                  </Text>
                </View>
              </View>

              {/* Order info */}
              <View style={[s.orderInfo, { backgroundColor: theme.tertiary }]}>
                <Ionicons name="water-outline" size={15} color={theme.primary} />
                <Text style={[s.orderInfoText, { color: theme.text }]}>
                  {activeDelivery.order?.quantity} {activeDelivery.order?.fuel?.unit} ·{" "}
                  {activeDelivery.order?.fuel?.name}
                </Text>
                <Text style={[s.orderTotal, { color: theme.primary }]}>
                  {fmtCurrency(activeDelivery.order?.totalPrice)}
                </Text>
              </View>
            </View>

            {/* Action buttons */}
            {activeDelivery.status === "accepted" && (
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: theme.primary }]}
                onPress={handlePickup}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                    <Text style={s.actionBtnText}>Confirm Pickup</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {activeDelivery.status === "picked_up" && (
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: theme.success }]}
                onPress={handleComplete}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="flag-outline" size={20} color="#fff" />
                    <Text style={s.actionBtnText}>Mark as Delivered</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        ) : isAvailable ? (
          <View style={[s.waitCard, { backgroundColor: theme.tertiary }]}>
            <Ionicons name="radio-outline" size={32} color={theme.primary} />
            <Text style={[s.waitTitle, { color: theme.text }]}>Waiting for orders</Text>
            <Text style={[s.waitSub, { color: theme.icon }]}>
              You're online. Orders will appear here when dispatched to you.
            </Text>
          </View>
        ) : (
          <View style={[s.waitCard, { backgroundColor: theme.surface, borderColor: theme.ash, borderWidth: 1 }]}>
            <Ionicons name="moon-outline" size={32} color={theme.icon} />
            <Text style={[s.waitTitle, { color: theme.text }]}>You're offline</Text>
            <Text style={[s.waitSub, { color: theme.icon }]}>
              Toggle the switch above to go online and start receiving delivery requests.
            </Text>
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
  profileCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  profileRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  vehicleIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  profileInfo: { flex: 1 },
  vehicleType: { fontSize: 15, fontWeight: "700" },
  vehiclePlate: { fontSize: 13, marginTop: 2 },
  statsGroup: { flexDirection: "row", gap: 16 },
  statItem: { alignItems: "center" },
  statVal: { fontSize: 16, fontWeight: "700" },
  statLbl: { fontSize: 11 },
  availRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1 },
  availLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  availDot: { width: 8, height: 8, borderRadius: 4 },
  availText: { fontSize: 13 },
  deliveryCard: { borderRadius: 14, borderWidth: 1.5, overflow: "hidden" },
  deliveryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10 },
  deliveryBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  deliveryBadgeText: { fontSize: 12, fontWeight: "700" },
  earning: { fontSize: 16, fontWeight: "700" },
  deliveryBody: { paddingHorizontal: 14, gap: 12, paddingBottom: 14 },
  locationRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  locationText: { flex: 1 },
  locationLabel: { fontSize: 11 },
  locationName: { fontSize: 14, fontWeight: "600", marginTop: 1 },
  locationAddr: { fontSize: 12, marginTop: 1 },
  orderInfo: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10 },
  orderInfoText: { flex: 1, fontSize: 13 },
  orderTotal: { fontSize: 13, fontWeight: "700" },
  actionBtn: { margin: 14, marginTop: 4, height: 48, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  actionBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  waitCard: { borderRadius: 14, padding: 32, alignItems: "center", gap: 10 },
  waitTitle: { fontSize: 16, fontWeight: "700" },
  waitSub: { fontSize: 13, lineHeight: 20, textAlign: "center" },
});
