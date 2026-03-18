import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker } from "react-native-maps";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";
import { useUserLocation } from "@/hooks/useUserLocation";
import NotificationButton from "@/components/ui/global/NotificationButton";
import BackButton from "@/components/ui/global/BackButton";
import ProfileCard from "@/components/ui/global/ProfileCard";
import { useSessionStore } from "@/store/useSessionStore";
import RateServiceModal from "../(order)/modal/rate-service";
import MapSkeleton from "@/components/ui/skeletons/MapSkeleton";

type OrderStatus = "pending" | "confirmed" | "in-transit" | "delivered" | "cancelled";

interface ActiveOrder {
  _id: string;
  status: OrderStatus;
  totalPrice: number;
  createdAt: string;
  fuel?: { name: string; unit: string };
  quantity?: number;
  station?: { name: string; location: { lat: number; lng: number } };
  deliveryAddress?: { label: string };
}

const STEP_LABELS = ["Confirmed", "In Transit", "Delivered"];
const STEP_ICONS: (keyof typeof Ionicons.glyphMap)[] = ["checkmark-circle-outline", "bicycle-outline", "home-outline"];
const STATUS_TO_STEP: Record<string, number> = {
  pending: 0, confirmed: 0, "in-transit": 1, delivered: 2, cancelled: -1,
};
const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: "#F59E0B", confirmed: "#3B82F6",
  "in-transit": "#F97316", delivered: "#22C55E", cancelled: "#EF4444",
};

function useDummyRider(
  userLoc: { lat: number; lng: number } | null,
  stationLoc: { lat: number; lng: number } | null,
  active: boolean
) {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const progress = useRef(0);

  useEffect(() => {
    if (!active || !userLoc || !stationLoc) return;
    progress.current = 0;
    setPos(stationLoc);
    const interval = setInterval(() => {
      progress.current = Math.min(progress.current + 0.006, 1);
      setPos({
        lat: stationLoc.lat + (userLoc.lat - stationLoc.lat) * progress.current,
        lng: stationLoc.lng + (userLoc.lng - stationLoc.lng) * progress.current,
      });
      if (progress.current >= 1) clearInterval(interval);
    }, 2000);
    return () => clearInterval(interval);
  }, [active, userLoc?.lat, userLoc?.lng, stationLoc?.lat, stationLoc?.lng]);

  return pos;
}

function useETA(active: boolean, initial = 20) {
  const [eta, setEta] = useState(initial);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setEta((e) => Math.max(1, e - 1)), 60000);
    return () => clearInterval(t);
  }, [active]);
  return eta;
}

export default function TrackScreen() {
  const theme = useTheme();
  const user = useSessionStore((s) => s.user);
  const { location: userLocation, loading: locationLoading } = useUserLocation();

  const [order, setOrder] = useState<ActiveOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRate, setShowRate] = useState(false);
  const [alreadyRated, setAlreadyRated] = useState(false);
  const mapRef = useRef<MapView>(null);

  const fetchActiveOrder = useCallback(async () => {
    try {
      const data = await api.get<{ data: ActiveOrder[] }>("/api/orders?page=1&limit=5");
      const active = data.data?.find(
        (o) => ["pending", "confirmed", "in-transit"].includes(o.status)
      );
      const delivered = data.data?.find((o) => o.status === "delivered");
      setOrder(active ?? delivered ?? null);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveOrder();
    const t = setInterval(fetchActiveOrder, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (order?.status === "delivered" && !alreadyRated) {
      setShowRate(true);
    }
  }, [order?.status]);

  const stationLoc = order?.station?.location ?? null;
  const isInTransit = order?.status === "in-transit";
  const riderPos = useDummyRider(userLocation, stationLoc, isInTransit);
  const eta = useETA(isInTransit);
  const step = order ? (STATUS_TO_STEP[order.status] ?? 0) : 0;
  const s = styles(theme);

  const connectorAnims = useRef(STEP_LABELS.slice(0, -1).map(() => new Animated.Value(0))).current;
  useEffect(() => {
    connectorAnims.forEach((anim, i) => {
      Animated.timing(anim, {
        toValue: step > i ? 1 : 0,
        duration: 400,
        useNativeDriver: false,
      }).start();
    });
  }, [step]);

  useEffect(() => {
    if (!mapRef.current || !userLocation || !riderPos) return;
    mapRef.current.fitToCoordinates(
      [
        { latitude: userLocation.lat, longitude: userLocation.lng },
        { latitude: riderPos.lat, longitude: riderPos.lng },
      ],
      { edgePadding: { top: 200, right: 60, bottom: 280, left: 60 }, animated: true }
    );
  }, [riderPos]);

  if (loading || locationLoading) {
    return (
      <View style={{ flex: 1 }}>
        <MapSkeleton />
        <SafeAreaView pointerEvents="none" style={[StyleSheet.absoluteFillObject, { justifyContent: "flex-end" }]}>
          <View style={[s.loadingLabel, { backgroundColor: theme.background + "F0" }]}>
            <Text style={[s.loadingText, { color: theme.icon }]}>Finding your order…</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const renderHeader = () => (
    <View style={s.header}>
      <BackButton />
      <View style={s.headerRight}>
        <NotificationButton onPress={() => router.push("/(screens)/notification")} />
        <ProfileCard image={user?.profileImage} onPress={() => router.push("/(screens)/profile")} />
      </View>
    </View>
  );

  if (!order) {
    return (
      <View style={{ flex: 1 }}>
        <MapSkeleton />
        {/* Transparent header overlay */}
        <SafeAreaView pointerEvents="box-none" style={[StyleSheet.absoluteFillObject, { zIndex: 10 }]}>
          {renderHeader()}
        </SafeAreaView>
        {/* Empty state card pinned to bottom */}
        <View style={[s.emptyCard, { backgroundColor: theme.background }]}>
          <View style={[s.emptyIconWrap, { backgroundColor: theme.tertiary }]}>
            <Ionicons name="navigate-circle-outline" size={40} color={theme.primary} />
          </View>
          <Text style={[s.emptyTitle, { color: theme.text }]}>No active order</Text>
          <Text style={[s.emptySub, { color: theme.icon }]}>
            Place a fuel order to start tracking your delivery in real time.
          </Text>
          <TouchableOpacity
            style={[s.emptyBtn, { backgroundColor: theme.primary }]}
            onPress={() => router.push("/(customer)/(order)" as any)} // eslint-disable-line @typescript-eslint/no-explicit-any
          >
            <Text style={s.emptyBtnText}>Order Fuel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.historyLink} onPress={() => router.push("/(screens)/order-history" as any)}>
            <Text style={[s.historyLinkText, { color: theme.primary }]}>View Order History</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const statusColor = STATUS_COLOR[order.status] ?? "#999";

  return (
    <View style={{ flex: 1 }}>
      {/* MAP */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider="google"
        initialRegion={userLocation ? {
          latitude: userLocation.lat, longitude: userLocation.lng,
          latitudeDelta: 0.05, longitudeDelta: 0.05,
        } : undefined}
        showsPointsOfInterest={false}
        showsBuildings={false}
        toolbarEnabled={false}
        customMapStyle={mapStyle(theme)}
      >
        {userLocation && (
          <Marker coordinate={{ latitude: userLocation.lat, longitude: userLocation.lng }} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={s.userPin}><Ionicons name="home" size={14} color="#fff" /></View>
          </Marker>
        )}
        {riderPos && (
          <Marker coordinate={{ latitude: riderPos.lat, longitude: riderPos.lng }} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[s.riderPin, { backgroundColor: theme.primary }]}>
              <Ionicons name="bicycle" size={16} color="#fff" />
            </View>
          </Marker>
        )}
        {stationLoc && (
          <Marker coordinate={{ latitude: stationLoc.lat, longitude: stationLoc.lng }} anchor={{ x: 0.5, y: 1 }}>
            <View style={[s.stationPin, { backgroundColor: theme.accent }]}>
              <MaterialIcons name="local-gas-station" size={14} color="#0C1A0C" />
            </View>
          </Marker>
        )}
      </MapView>

      {/* TOP: header + progress */}
      <SafeAreaView pointerEvents="box-none" style={s.topOverlay}>
        {renderHeader()}
        <View style={[s.progressCard, { backgroundColor: theme.background + "F2" }]}>
          {STEP_LABELS.map((label, i) => (
            <React.Fragment key={label}>
              <View style={s.stepItem}>
                <View style={[
                  s.stepCircle,
                  i < step && { backgroundColor: theme.secondary, borderColor: theme.secondary },
                  i === step && { backgroundColor: theme.primary, borderColor: theme.primary },
                  i > step && { backgroundColor: theme.surface, borderColor: theme.ash },
                ]}>
                  {i < step
                    ? <Ionicons name="checkmark" size={11} color="#fff" />
                    : <Ionicons name={STEP_ICONS[i]} size={12} color={i === step ? "#fff" : theme.icon} />
                  }
                </View>
                <Text style={[s.stepLabel, { color: i === step ? theme.primary : i < step ? theme.secondary : theme.icon, fontWeight: i <= step ? "500" : "300" }]}>
                  {label}
                </Text>
              </View>
              {i < STEP_LABELS.length - 1 && (
                <View style={s.progressLine}>
                  <View style={[s.progressLineBase, { backgroundColor: theme.ash }]} />
                  <Animated.View style={[s.progressLineFill, {
                    backgroundColor: theme.secondary,
                    width: connectorAnims[i].interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
                  }]} />
                </View>
              )}
            </React.Fragment>
          ))}
        </View>
      </SafeAreaView>

      {/* BOTTOM PANEL */}
      <View style={[s.bottomPanel, { backgroundColor: theme.background }]}>
        <View style={s.statusRow}>
          <View style={[s.statusBadge, { backgroundColor: statusColor + "20" }]}>
            <View style={[s.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[s.statusText, { color: statusColor }]}>
              {order.status === "in-transit" ? "On the Way"
                : order.status === "confirmed" ? "Order Confirmed"
                : order.status === "delivered" ? "Delivered"
                : "Processing"}
            </Text>
          </View>
          {isInTransit && <Text style={[s.etaText, { color: theme.primary }]}>ETA {eta} min</Text>}
        </View>

        <View style={[s.riderCard, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
          <View style={[s.riderAvatar, { backgroundColor: theme.tertiary }]}>
            <Ionicons name="bicycle-outline" size={24} color={theme.primary} />
          </View>
          <View style={s.riderInfo}>
            <Text style={[s.riderName, { color: theme.text }]}>
              {order.fuel?.name} · {order.quantity} {order.fuel?.unit}
            </Text>
            <Text style={[s.riderMeta, { color: theme.icon }]}>
              {isInTransit ? "Rider is on the way" : order.status === "confirmed" ? "Awaiting dispatch" : "Order delivered"}
            </Text>
          </View>
        </View>

        {/* {order.deliveryAddress && (
          <View style={s.addressRow}>
            <Ionicons name="location-outline" size={15} color={theme.icon} />
            <Text style={[s.addressText, { color: theme.icon }]} numberOfLines={1}>
              {order.deliveryAddress.label}
            </Text>
          </View>
        )} */}

        {/* <TouchableOpacity style={s.historyLink} onPress={() => router.push("/(screens)/order-history" as any)}>
          <Text style={[s.historyLinkText, { color: theme.primary }]}>View Order History</Text>
          <Ionicons name="chevron-forward" size={14} color={theme.primary} />
        </TouchableOpacity> */}
      </View>

      <RateServiceModal
        visible={showRate}
        orderId={order._id}
        onClose={() => { setShowRate(false); setAlreadyRated(true); }}
      />
    </View>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    loadingLabel: { alignItems: "center", paddingVertical: 20, marginHorizontal: 16, borderRadius: 16, marginBottom: 32 },
    loadingText: { fontSize: 14, fontWeight: "300" },
    topOverlay: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 16, paddingVertical: 12,
    },
    headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
    progressCard: {
      flexDirection: "row", alignItems: "center",
      marginHorizontal: 12, marginTop: 4, padding: 14, borderRadius: 16,
    },
    stepItem: { alignItems: "center", width: 60 },
    stepCircle: {
      width: 26, height: 26, borderRadius: 13,
      alignItems: "center", justifyContent: "center",
      borderWidth: 1.5, marginBottom: 4,
    },
    stepLabel: { fontSize: 10, textAlign: "center" },
    progressLine: { flex: 1, height: 2, borderRadius: 1, marginBottom: 12, overflow: "hidden" },
    progressLineBase: { position: "absolute", width: "100%", height: "100%", borderRadius: 1 },
    progressLineFill: { position: "absolute", height: "100%", left: 0, top: 0, borderRadius: 1 },
    bottomPanel: {
      position: "absolute", bottom: 0, left: 0, right: 0,
      paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.08, shadowRadius: 12, elevation: 12,
    },
    statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
    statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    statusDot: { width: 7, height: 7, borderRadius: 4 },
    statusText: { fontSize: 12, fontWeight: "500" },
    etaText: { fontSize: 15, fontWeight: "500" },
    riderCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
    riderAvatar: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center" },
    riderInfo: { flex: 1 },
    riderName: { fontSize: 15, fontWeight: "500", marginBottom: 2 },
    riderMeta: { fontSize: 12, fontWeight: "300" },
    riderActions: { flexDirection: "row", gap: 8 },
    riderActionBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
    addressRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
    addressText: { fontSize: 13, fontWeight: "300", flex: 1 },
    historyLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
    historyLinkText: { fontSize: 13, fontWeight: "400" },
    emptyCard: {
      position: "absolute", bottom: 0, left: 0, right: 0,
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      paddingHorizontal: 24, paddingTop: 24, paddingBottom: 36,
      alignItems: "center", gap: 10,
      shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.1, shadowRadius: 16, elevation: 16,
    },
    emptyIconWrap: { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center" },
    emptyTitle: { fontSize: 19, fontWeight: "500" },
    emptySub: { fontSize: 13, fontWeight: "300", textAlign: "center", lineHeight: 19, maxWidth: 280 },
    emptyBtn: { paddingVertical: 14, paddingHorizontal: 40, borderRadius: 16, marginTop: 4, marginBottom: 10, width: "100%" as any, alignItems: "center" as any },
    emptyBtnText: { color: "#fff", fontSize: 15, fontWeight: "500" },
    userPin: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#1A6B1A", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#fff" },
    riderPin: { width: 38, height: 38, borderRadius: 19, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#fff" },
    stationPin: { width: 30, height: 30, borderRadius: 8, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#fff" },
  });

const mapStyle = (theme: ReturnType<typeof useTheme>) => [
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: theme.background }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: theme.text }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: theme.tertiary }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: theme.quinest }] },
  { featureType: "administrative", elementType: "labels.text.fill", stylers: [{ color: theme.text }] },
];
