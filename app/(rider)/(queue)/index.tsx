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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as Location from "expo-location";
import { toast } from "sonner-native";
import { useTheme } from "@/constants/theme";
import { useSessionStore } from "@/store/useSessionStore";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useNotificationStore } from "@/store/useNotificationStore";
import NotificationButton from "@/components/ui/global/NotificationButton";
import ProfileButton from "@/components/ui/global/ProfileButton";
import RiderPromoBanner from "@/components/ui/home/RiderPromoBanner";

const LOCATION_POLL_MS = 30_000;

type DeliveryStatus = "pending" | "accepted" | "picked_up" | "awaiting_confirmation" | "delivered" | "dropped" | "failed";

interface DispatchOffer {
  deliveryId: string;
  orderId: string;
  stationName: string;
  stationAddress?: string;
  fuelName: string;
  quantity: number;
  unit: string;
  riderEarnings: number;
}

interface ActiveDelivery {
  _id: string;
  status: DeliveryStatus;
  riderEarnings: number;
  station: { name: string; address: string };
  order: {
    _id: string;
    fuel: { name: string; unit: string };
    quantity: number;
    user: { displayName: string };
    deliveryAddress: { street: string; city: string };
  };
}

interface RiderProfile {
  vehicleType: string;
  vehiclePlate: string;
  isAvailable: boolean;
  isVerified: boolean;
  rating: number;
  totalDeliveries: number;
  todaysEarnings: number;
  user?: { displayName: string; email: string; phone?: string; profileImage?: string };
}

function fmtCurrency(n: number) {
  return "₦" + n.toLocaleString("en-NG");
}

const VEHICLE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  motorcycle: "bicycle",
  car: "car",
  truck: "car",
};

export default function RiderQueue() {
  const theme = useTheme();
  const router = useRouter();
  const user = useSessionStore((s) => s.user);
  const { increment: incrementBadge } = useNotificationStore();

  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [activeDelivery, setActiveDelivery] = useState<ActiveDelivery | null>(null);
  const [dispatchOffer, setDispatchOffer] = useState<DispatchOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingAvail, setTogglingAvail] = useState(false);
  const [offerLoading, setOfferLoading] = useState<"accept" | "reject" | null>(null);
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const [profileRes, activeRes] = await Promise.all([
        api.get<RiderProfile>("/api/rider/profile"),
        api.get<{ delivery: ActiveDelivery | null }>("/api/rider/active"),
      ]);
      setProfile(profileRes);

      const delivery = activeRes.delivery;
      if (delivery?.status === "pending") {
        // Rider missed the socket dispatch event — surface it as an offer card
        setDispatchOffer({
          deliveryId: delivery._id,
          orderId: delivery.order._id,
          stationName: delivery.station?.name,
          stationAddress: delivery.station?.address,
          fuelName: delivery.order?.fuel?.name,
          quantity: delivery.order?.quantity,
          unit: delivery.order?.fuel?.unit,
          riderEarnings: delivery.riderEarnings,
        });
        setActiveDelivery(null);
      } else {
        setActiveDelivery(delivery);
        // Clear any stale offer if we now have an active delivery
        if (delivery) setDispatchOffer(null);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    // Poll every 30 s while on screen — catches missed socket events
    const poll = setInterval(load, 30_000);
    return () => clearInterval(poll);
  }, [load]));

  // ── Socket listeners ───────────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onDispatch = (data: DispatchOffer) => setDispatchOffer(data);

    const onOrderUpdate = ({ orderId, status }: { orderId: string; status: string }) => {
      setActiveDelivery((prev) => {
        if (!prev || prev.order._id !== orderId) return prev;
        if (status === "cancelled") { return null; }
        return prev;
      });
    };

    // Wire notification badge increment for riders
    const onNotification = () => incrementBadge();

    socket.on("delivery:dispatch", onDispatch);
    socket.on("order:update", onOrderUpdate);
    socket.on("notification:new", onNotification);
    return () => {
      socket.off("delivery:dispatch", onDispatch);
      socket.off("order:update", onOrderUpdate);
      socket.off("notification:new", onNotification);
    };
  }, [incrementBadge]);

  // ── Location polling + socket emit ────────────────────────────────────────
  useEffect(() => {
    const shouldPoll = profile?.isAvailable || !!activeDelivery;

    const startPolling = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const sendLocation = async () => {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const lat = loc.coords.latitude;
          const lng = loc.coords.longitude;
          await api.patch("/api/rider/location", { lat, lng });
          // Emit real-time location to customer tracking screen
          const socket = getSocket();
          socket?.emit("rider:location", { lat, lng });
        } catch {
          // best-effort
        }
      };

      sendLocation();
      locationIntervalRef.current = setInterval(sendLocation, LOCATION_POLL_MS);
    };

    if (shouldPoll) startPolling();

    return () => {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
    };
  }, [profile?.isAvailable, activeDelivery]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  const toggleAvailability = useCallback(async (value: boolean) => {
    if (!profile) return;
    setTogglingAvail(true);
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

  const handleAcceptOffer = useCallback(async () => {
    if (!dispatchOffer) return;
    setOfferLoading("accept");
    try {
      await api.patch(`/api/rider/deliveries/${dispatchOffer.deliveryId}/accept`);
      setDispatchOffer(null);
      toast.success("Delivery accepted!", { description: "Head to the pickup station." });
      await load();
    } catch (err: any) {
      toast.error("Failed to accept", { description: err.message });
      setDispatchOffer(null);
    } finally {
      setOfferLoading(null);
    }
  }, [dispatchOffer, load]);

  const handleRejectOffer = useCallback(async () => {
    if (!dispatchOffer) return;
    setOfferLoading("reject");
    try {
      await api.patch(`/api/rider/deliveries/${dispatchOffer.deliveryId}/reject`);
    } catch {
      // silently ignore
    } finally {
      setDispatchOffer(null);
      setOfferLoading(null);
    }
  }, [dispatchOffer]);


  const isAvailable = profile?.isAvailable ?? false;
  const s = styles(theme);

  if (loading) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
        <View style={s.center}><ActivityIndicator size="large" color={theme.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Text style={[s.greeting, { color: theme.icon }]}>Good day,</Text>
            <View
              style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}
            >
              <Text style={[s.name, { color: theme.text }]}>
                {user?.displayName ?? "Rider"}
              </Text>
              <View
                style={[
                  s.statusDotIndicator,
                  { backgroundColor: isAvailable ? "#10B981" : "#888888" },
                ]}
              />
            </View>
          </View>

          <View style={s.headerRight}>
            <NotificationButton
              onPress={() => router.push("/(screens)/notification" as any)}
            />
            <ProfileButton
              onPress={() => router.push("/(rider)/(queue)/profile" as any)}
              size={40}
            />
          </View>
        </View>

        {/* ── Stat Row ── */}
        <View style={s.statsRow}>
          {/* Trips / Completed Deliveries */}
          <View
            style={[
              s.statCard,
              { backgroundColor: "#2196F311", borderColor: "#2196F333" },
            ]}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={20}
              color="#2196F3"
            />
            <Text style={[s.statValue, { color: theme.text }]}>
              {profile?.totalDeliveries ?? 0}
            </Text>
            <Text style={[s.statLabel, { color: theme.icon }]}>Trips</Text>
          </View>

          {/* Rating */}
          <View
            style={[
              s.statCard,
              { backgroundColor: "#F59E0B11", borderColor: "#F59E0B33" },
            ]}
          >
            <Ionicons name="star-outline" size={20} color="#F59E0B" />
            <Text style={[s.statValue, { color: theme.text }]}>
              {profile?.rating?.toFixed(1) ?? 0}
            </Text>
            <Text style={[s.statLabel, { color: theme.icon }]}>Rating</Text>
          </View>

          {/* Earnings Today */}
          <View
            style={[
              s.statCard,
              {
                backgroundColor: theme.accentLight,
                borderColor: theme.accent + "33",
              },
            ]}
          >
            <Ionicons name="cash-outline" size={20} color={theme.accent} />
            <Text style={[s.statValue, { color: theme.text }]}>
              {fmtCurrency(profile?.todaysEarnings ?? 0)}
            </Text>
            <Text style={[s.statLabel, { color: theme.icon }]}>Today</Text>
          </View>
        </View>

        {/* ── Availability toggle ── */}
        {profile && !activeDelivery && (
          <View
            style={[
              s.toggleCard,
              { backgroundColor: theme.surface, borderColor: theme.borderMid },
            ]}
          >
            <View style={s.toggleLeft}>
              <View
                style={[
                  s.toggleIcon,
                  {
                    backgroundColor: isAvailable
                      ? "#10B981" + "18"
                      : theme.tertiary,
                  },
                ]}
              >
                <MaterialIcons
                  name={isAvailable ? "sensors" : "wifi-off"}
                  size={20}
                  color={isAvailable ? "#10B981" : theme.icon}
                />
              </View>
              <View>
                <Text style={[s.toggleTitle, { color: theme.text }]}>
                  {isAvailable ? "You're Online" : "You're Offline"}
                </Text>
                <Text style={[s.toggleSub, { color: theme.icon }]}>
                  {isAvailable
                    ? "Accepting delivery requests"
                    : "Toggle to start receiving orders"}
                </Text>
              </View>
            </View>
            <Switch
              value={isAvailable}
              onValueChange={toggleAvailability}
              disabled={togglingAvail}
              trackColor={{ false: theme.ash, true: "#10B981" + "66" }}
              thumbColor={isAvailable ? "#10B981" : theme.icon}
            />
          </View>
        )}

        {/* ── Incoming dispatch offer ── */}
        {dispatchOffer && (
          <View
            style={[
              s.offerCard,
              { backgroundColor: theme.surface, borderColor: theme.primary },
            ]}
          >
            {/* Colored top strip */}
            <View style={[s.offerStrip, { backgroundColor: theme.primary }]}>
              <View style={s.offerStripLeft}>
                <Ionicons name="flash" size={14} color="#fff" />
                <Text style={s.offerStripText}>New Delivery Request</Text>
              </View>
              <Text style={s.offerStripEarning}>
                +{fmtCurrency(dispatchOffer.riderEarnings)}
              </Text>
            </View>

            <View style={s.offerBody}>
              {/* Pickup station */}
              <View style={s.offerRow}>
                <View
                  style={[s.offerDot, { backgroundColor: theme.primary }]}
                />
                <View style={s.offerLocText}>
                  <Text style={[s.offerLocLabel, { color: theme.icon }]}>
                    Pickup from
                  </Text>
                  <Text style={[s.offerLocName, { color: theme.text }]}>
                    {dispatchOffer.stationName}
                  </Text>
                  {dispatchOffer.stationAddress ? (
                    <Text
                      style={[s.offerLocAddr, { color: theme.icon }]}
                      numberOfLines={1}
                    >
                      {dispatchOffer.stationAddress}
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* Connector line */}
              <View style={[s.offerConnector, { borderColor: theme.ash }]} />

              {/* Fuel info chip */}
              <View
                style={[s.offerFuelChip, { backgroundColor: theme.tertiary }]}
              >
                <Ionicons
                  name="water-outline"
                  size={13}
                  color={theme.primary}
                />
                <Text style={[s.offerFuelText, { color: theme.text }]}>
                  {dispatchOffer.quantity} {dispatchOffer.unit} ·{" "}
                  {dispatchOffer.fuelName}
                </Text>
              </View>
            </View>

            <View style={[s.offerDivider, { backgroundColor: theme.ash }]} />

            <View style={s.offerActions}>
              <TouchableOpacity
                style={[
                  s.offerBtn,
                  s.offerBtnReject,
                  { borderColor: theme.error },
                ]}
                onPress={handleRejectOffer}
                disabled={!!offerLoading}
                activeOpacity={0.8}
              >
                {offerLoading === "reject" ? (
                  <ActivityIndicator size="small" color={theme.error} />
                ) : (
                  <Text style={[s.offerBtnText, { color: theme.error }]}>
                    Decline
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  s.offerBtn,
                  s.offerBtnAccept,
                  { backgroundColor: theme.primary },
                ]}
                onPress={handleAcceptOffer}
                disabled={!!offerLoading}
                activeOpacity={0.8}
              >
                {offerLoading === "accept" ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                    <Text style={[s.offerBtnText, { color: "#fff" }]}>
                      Accept
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Active delivery redirect card ── */}
        {activeDelivery && (
          <TouchableOpacity
            style={[
              s.activeCard,
              { backgroundColor: theme.surface, borderColor: theme.primary },
            ]}
            onPress={() => router.navigate("/(rider)/(queue)/track" as any)}
            activeOpacity={0.85}
          >
            {/* Top strip */}
            <View style={[s.activeStrip, { backgroundColor: theme.primary }]}>
              <View style={s.activeStripLeft}>
                <Ionicons name="navigate" size={14} color="#fff" />
                <Text style={s.activeStripText}>
                  {activeDelivery.status === "awaiting_confirmation"
                    ? "Awaiting Customer Confirmation"
                    : activeDelivery.status === "picked_up"
                      ? "In Transit · Delivering"
                      : "Active Delivery"}
                </Text>
              </View>
              <Text style={s.activeStripEarnings}>
                +{fmtCurrency(activeDelivery.riderEarnings)}
              </Text>
            </View>

            {/* Route body */}
            <View style={s.activeBody}>
              {/* Station */}
              <View style={s.activeRow}>
                <View
                  style={[s.activeDot, { backgroundColor: theme.primary }]}
                />
                <View style={s.activeLocText}>
                  <Text style={[s.activeLocLabel, { color: theme.icon }]}>
                    Pickup from
                  </Text>
                  <Text
                    style={[s.activeLocName, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {activeDelivery.station.name}
                  </Text>
                  {activeDelivery.station.address ? (
                    <Text
                      style={[s.activeLocAddr, { color: theme.icon }]}
                      numberOfLines={1}
                    >
                      {activeDelivery.station.address}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View style={[s.activeConnector, { borderColor: theme.ash }]} />

              {/* Delivery address */}
              <View style={s.activeRow}>
                <View style={[s.activeDot, { backgroundColor: "#7C3AED" }]} />
                <View style={s.activeLocText}>
                  <Text style={[s.activeLocLabel, { color: theme.icon }]}>
                    Deliver to
                  </Text>
                  <Text
                    style={[s.activeLocName, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {activeDelivery.order.user.displayName}
                  </Text>
                  <Text
                    style={[s.activeLocAddr, { color: theme.icon }]}
                    numberOfLines={1}
                  >
                    {activeDelivery.order.deliveryAddress.street},{" "}
                    {activeDelivery.order.deliveryAddress.city}
                  </Text>
                </View>
              </View>

              {/* Fuel chip + tap cue */}
              <View style={s.activeFooter}>
                <View
                  style={[
                    s.activeFuelChip,
                    { backgroundColor: theme.tertiary },
                  ]}
                >
                  <Ionicons
                    name="water-outline"
                    size={12}
                    color={theme.primary}
                  />
                  <Text style={[s.activeFuelText, { color: theme.text }]}>
                    {activeDelivery.order.quantity}{" "}
                    {activeDelivery.order.fuel.unit} ·{" "}
                    {activeDelivery.order.fuel.name}
                  </Text>
                </View>
                <View style={s.activeCue}>
                  <Text style={[s.activeCueText, { color: theme.primary }]}>
                    Open
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={14}
                    color={theme.primary}
                  />
                </View>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* ── Idle states ── */}
        {!activeDelivery &&
          !dispatchOffer &&
          (isAvailable ? (
            <View style={[s.idleCard, { backgroundColor: theme.tertiary }]}>
              <View
                style={[
                  s.idleIconWrap,
                  {
                    backgroundColor: isAvailable
                      ? "#10B98133" // 20% opacity green
                      : theme.tertiary,
                  },
                ]}
              >
                <MaterialIcons
                  name={isAvailable ? "sensors" : "wifi-off"}
                  size={32}
                  color={isAvailable ? "#10B981" : theme.icon}
                />
              </View>
              <Text style={[s.idleTitle, { color: theme.text }]}>
                Waiting for orders
              </Text>
              <Text style={[s.idleSub, { color: theme.icon }]}>
                You're online and visible to the dispatch system. Delivery
                requests will appear here automatically.
              </Text>
              <View
                style={[
                  s.idleTip,
                  {
                    backgroundColor: theme.primary + "12",
                    borderColor: theme.primary + "33",
                  },
                ]}
              >
                <Ionicons
                  name="location-outline"
                  size={14}
                  color={theme.primary}
                />
                <Text style={[s.idleTipText, { color: theme.primary }]}>
                  Location is being shared every 30s
                </Text>
              </View>
            </View>
          ) : (
            <View
              style={[
                s.idleCard,
                {
                  backgroundColor: theme.skeletonShimmer,
                },
              ]}
            >
              <View
                style={[s.idleIconWrap, { backgroundColor: theme.ash + "55" }]}
              >
                <MaterialIcons name="wifi-off" size={32} color={theme.icon} />
              </View>
              <Text style={[s.idleTitle, { color: theme.text }]}>
                You're Offline
              </Text>
              <Text style={[s.idleSub, { color: theme.icon }]}>
                Toggle the switch above to go online and start receiving
                delivery requests.
              </Text>
            </View>
          ))}

        {/* ── Promo banner ── */}
        <RiderPromoBanner />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (
  theme: ReturnType<typeof import("@/constants/theme").useTheme>,
) =>
  StyleSheet.create({
    safe: { flex: 1 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    scroll: { padding: 20, gap: 14, paddingBottom: 110 },

    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    greeting: { fontSize: 13 },
    name: { fontSize: 22, fontWeight: "700", marginTop: 2 },
    headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },

    statusBar: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 14,
      borderWidth: 1,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    statItem: { flex: 1, alignItems: "center" },
    statVal: { fontSize: 16, fontWeight: "700" },
    statLbl: { fontSize: 11, marginTop: 1 },
    statDivider: { width: 1, height: 28, marginHorizontal: 8 },
    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
    },
    statusDot: { width: 7, height: 7, borderRadius: 4 },
    statusPillText: { fontSize: 12, fontWeight: "700" },

    toggleCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: 14,
      borderWidth: 1,
      padding: 14,
    },
    toggleLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    toggleIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    toggleTitle: { fontSize: 14, fontWeight: "600" },
    toggleSub: { fontSize: 12, marginTop: 1 },

    offerCard: { borderRadius: 16, borderWidth: 1.5, overflow: "hidden" },
    offerStrip: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    offerStripLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
    offerStripText: { fontSize: 12, fontWeight: "700", color: "#fff" },
    offerStripEarning: { fontSize: 15, fontWeight: "800", color: "#fff" },
    offerEarning: { fontSize: 16, fontWeight: "700" },
    offerBody: { paddingHorizontal: 14, gap: 8, paddingVertical: 12 },
    offerRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
    offerDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginTop: 5,
      flexShrink: 0,
    },
    offerConnector: {
      marginLeft: 4,
      height: 14,
      borderLeftWidth: 2,
      borderStyle: "dashed",
      marginVertical: -2,
    },
    offerLocText: { flex: 1 },
    offerLocLabel: { fontSize: 11 },
    offerLocName: { fontSize: 14, fontWeight: "600", marginTop: 1 },
    offerLocAddr: { fontSize: 12, marginTop: 1 },
    offerFuelChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 10,
      borderRadius: 10,
    },
    offerFuelText: { fontSize: 13, flex: 1 },
    offerDivider: { height: StyleSheet.hairlineWidth },
    offerActions: { flexDirection: "row", gap: 10, padding: 12 },
    offerBtn: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 6,
    },
    offerBtnReject: { borderWidth: 1.5, backgroundColor: "transparent" },
    offerBtnAccept: {},
    offerBtnText: { fontSize: 14, fontWeight: "700" },
    activeCard: {
      borderRadius: 16,
      borderWidth: 1.5,
      overflow: "hidden",
    },

    /* Top strip */
    activeStrip: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    activeStripLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    activeStripText: {
      fontSize: 12,
      fontWeight: "700",
      color: "#fff",
    },
    activeStripEarnings: {
      fontSize: 15,
      fontWeight: "800",
      color: "#fff",
    },

    /* Body */
    activeBody: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 10,
    },

    activeRow: {
      flexDirection: "row",
      gap: 12,
      alignItems: "flex-start",
    },

    activeDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginTop: 5,
      flexShrink: 0,
    },

    activeConnector: {
      marginLeft: 4,
      height: 16,
      borderLeftWidth: 2,
      borderStyle: "dashed",
      marginVertical: -2,
    },

    activeLocText: {
      flex: 1,
    },

    activeLocLabel: {
      fontSize: 11,
    },

    activeLocName: {
      fontSize: 14,
      fontWeight: "600",
      marginTop: 1,
    },

    activeLocAddr: {
      fontSize: 12,
      marginTop: 1,
    },

    /* Footer */
    activeFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 4,
    },

    activeFuelChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
    },

    activeFuelText: {
      fontSize: 12,
    },

    activeCue: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
    },

    activeCueText: {
      fontSize: 12,
      fontWeight: "600",
    },
    idleCard: { borderRadius: 16, padding: 32, alignItems: "center", gap: 12 },
    idleIconWrap: {
      width: 64,
      height: 64,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    idleTitle: { fontSize: 17, fontWeight: "700" },
    idleSub: { fontSize: 13, lineHeight: 20, textAlign: "center" },
    idleTip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
      borderWidth: 1,
      marginTop: 4,
    },
    idleTipText: { fontSize: 12, fontWeight: "500" },

    promoBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      marginTop: 4,
    },
    promoIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    promoText: { flex: 1 },
    promoTitle: { fontSize: 13, fontWeight: "700", marginBottom: 3 },
    promoSub: { fontSize: 12, lineHeight: 17 },
    statsRow: { flexDirection: "row", gap: 12, marginVertical: 14 },
    statCard: {
      flex: 1,
      borderRadius: 14,
      borderWidth: 1,
      paddingVertical: 12,
      alignItems: "center",
      gap: 4,
    },
    statValue: { fontSize: 16, fontWeight: "700" },
    statLabel: { fontSize: 11, fontWeight: "500" },
    statusDotIndicator: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
  });
