import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Image,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker } from "react-native-maps";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { getSocket } from "@/lib/socket";

type OrderStatus = "pending" | "confirmed" | "assigned" | "in-transit" | "awaiting_confirmation" | "delivered" | "cancelled";

interface ActiveOrder {
  _id: string;
  status: OrderStatus;
  totalPrice: number;
  createdAt: string;
  fuel?: { name: string; unit: string };
  quantity?: number;
  riderId?: string;
  station?: { name: string; location: { lat: number; lng: number } };
  deliveryAddress?: { label: string; street?: string; city?: string; latitude?: number; longitude?: number };
}

interface RiderInfo {
  displayName: string;
  phone?: string;
  profileImage?: string;
  vehicleType?: string;
  vehiclePlate?: string;
  rating?: number;
}

const STEP_LABELS = ["Confirmed", "In Transit", "Delivered"];
const STEP_ICONS: (keyof typeof Ionicons.glyphMap)[] = ["checkmark-circle-outline", "bicycle-outline", "home-outline"];
const STATUS_TO_STEP: Record<string, number> = {
  pending: 0, confirmed: 0, assigned: 1, "in-transit": 1,
  awaiting_confirmation: 2, delivered: 3, cancelled: -1,
};
const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: "#F59E0B", confirmed: "#3B82F6", assigned: "#8B5CF6",
  "in-transit": "#F97316", awaiting_confirmation: "#8B5CF6",
  delivered: "#22C55E", cancelled: "#EF4444",
};

function useRiderLocation(orderId: string | null) {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (!orderId) return;
    const socket = getSocket();
    if (!socket) return;
    const handler = ({ lat, lng }: { lat: number; lng: number }) => setPos({ lat, lng });
    socket.on("rider:location", handler);
    return () => { socket.off("rider:location", handler); };
  }, [orderId]);
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
  const insets = useSafeAreaInsets();
  const user = useSessionStore((s) => s.user);
  const { location: userLocation, loading: locationLoading } = useUserLocation();

  const [order, setOrder] = useState<ActiveOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRate, setShowRate] = useState(false);
  const [riderInfo, setRiderInfo] = useState<RiderInfo | null>(null);
  const [confirmingReceipt, setConfirmingReceipt] = useState(false);
  const mapRef = useRef<MapView>(null);

  const fetchActiveOrder = useCallback(async () => {
    try {
      const data = await api.get<{ data: ActiveOrder[] }>("/api/orders?page=1&limit=5");
      const active = data.data?.find(
        (o) => ["pending", "confirmed", "assigned", "in-transit", "awaiting_confirmation"].includes(o.status)
      );
      setOrder(active ?? null);
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

  // Real-time order status updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = ({ orderId, status }: { orderId: any; status: string }) => {
      setOrder((prev) => {
        if (!prev || String(prev._id) !== String(orderId)) return prev;
        if (status === "delivered") {
          setTimeout(() => {
            setOrder(null);
            setShowRate(false);
            setRiderInfo(null);
          }, 3000);
        }
        return { ...prev, status: status as ActiveOrder["status"] };
      });
    };
    socket.on("order:update", handler);
    return () => { socket.off("order:update", handler); };
  }, []);

  // Rating modal is not auto-shown on tracking screen after delivery

  // Fetch rider info when a rider is assigned
  useEffect(() => {
    if (!order?.riderId) { setRiderInfo(null); return; }
    api.get<RiderInfo>(`/api/rider/public/${order.riderId}`).then(setRiderInfo).catch(() => {});
  }, [order?.riderId]);

  const handleConfirmReceipt = async () => {
    if (!order) return;
    setConfirmingReceipt(true);
    try {
      await api.patch(`/api/orders/${order._id}/confirm-delivery`);
      setOrder((prev) => prev ? { ...prev, status: "delivered" } : prev);
    } catch {
      // silent — order:update socket will correct state
    } finally {
      setConfirmingReceipt(false);
    }
  };

  const stationLoc = order?.station?.location ?? null;
  const deliveryLoc = (order?.deliveryAddress?.latitude != null && order?.deliveryAddress?.longitude != null)
    ? { lat: order.deliveryAddress.latitude, lng: order.deliveryAddress.longitude }
    : null;
  const isInTransit = order?.status === "in-transit" || order?.status === "awaiting_confirmation";
  const riderPos = useRiderLocation(order?._id ?? null);

  // Compute initial ETA from station→delivery address distance (25 km/h avg + 5 min base)
  const etaInitial = React.useMemo(() => {
    const dest = deliveryLoc ?? userLocation;
    if (!stationLoc || !dest) return 18;
    const R = 6371;
    const dLat = ((dest.lat - stationLoc.lat) * Math.PI) / 180;
    const dLng = ((dest.lng - stationLoc.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((stationLoc.lat * Math.PI) / 180) *
        Math.cos((dest.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.max(8, Math.round((distKm / 25) * 60) + 5);
  }, [stationLoc?.lat, stationLoc?.lng, deliveryLoc?.lat, deliveryLoc?.lng, userLocation?.lat, userLocation?.lng]);

  const eta = useETA(isInTransit, etaInitial);
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

  // Pulse: "finding a rider" avatar ring
  const findingPulse = useRef(new Animated.Value(1)).current;
  const findingOpacity = useRef(new Animated.Value(0.7)).current;
  const isFinding = order?.status === "confirmed" && !riderInfo;
  useEffect(() => {
    if (!isFinding) {
      findingPulse.setValue(1);
      findingOpacity.setValue(0);
      return;
    }
    const anim = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(findingPulse, { toValue: 1.9, duration: 1100, useNativeDriver: true }),
          Animated.timing(findingPulse, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(findingOpacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
          Animated.timing(findingOpacity, { toValue: 0, duration: 1100, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [isFinding]);

  // Pulse: rider map marker
  const riderMarkerPulse = useRef(new Animated.Value(1)).current;
  const riderMarkerOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!riderPos) {
      riderMarkerPulse.setValue(1);
      riderMarkerOpacity.setValue(0);
      return;
    }
    const anim = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(riderMarkerPulse, { toValue: 2.2, duration: 900, useNativeDriver: true }),
          Animated.timing(riderMarkerPulse, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(riderMarkerOpacity, { toValue: 0.5, duration: 0, useNativeDriver: true }),
          Animated.timing(riderMarkerOpacity, { toValue: 0, duration: 900, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [!!riderPos]);

  // Fit map to station + delivery address once both are known (before rider is assigned)
  useEffect(() => {
    if (!mapRef.current || !stationLoc || !deliveryLoc || riderPos) return;
    mapRef.current.fitToCoordinates(
      [
        { latitude: stationLoc.lat, longitude: stationLoc.lng },
        { latitude: deliveryLoc.lat, longitude: deliveryLoc.lng },
      ],
      { edgePadding: { top: 220, right: 70, bottom: 300, left: 70 }, animated: true }
    );
  }, [!!stationLoc, !!deliveryLoc, !!riderPos]);

  // Re-fit map to rider + delivery address as rider moves
  useEffect(() => {
    if (!mapRef.current || !riderPos) return;
    const dest = deliveryLoc ?? userLocation;
    if (!dest) return;
    mapRef.current.fitToCoordinates(
      [
        { latitude: riderPos.lat, longitude: riderPos.lng },
        { latitude: dest.lat, longitude: dest.lng },
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
        initialRegion={
          deliveryLoc
            ? {
                latitude: deliveryLoc.lat,
                longitude: deliveryLoc.lng,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }
            : stationLoc
              ? {
                  latitude: stationLoc.lat,
                  longitude: stationLoc.lng,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }
              : userLocation
                ? {
                    latitude: userLocation.lat,
                    longitude: userLocation.lng,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                  }
                : undefined
        }
        showsPointsOfInterest={false}
        showsBuildings={false}
        toolbarEnabled={false}
        customMapStyle={mapStyle(theme)}
      >
        {/* Delivery address pin — white bg + purple border, address/place icon */}
        {deliveryLoc && (
          <Marker
            coordinate={{
              latitude: deliveryLoc.lat,
              longitude: deliveryLoc.lng,
            }}
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={false}
          >
            <View style={s.pinWrapper}>
              <View
                style={[
                  s.pinBubble,
                  {
                    backgroundColor: "#fff",
                    borderColor: "#7C3AED",
                    borderWidth: 1.5,
                  },
                ]}
              >
                <MaterialIcons name="place" size={18} color="#7C3AED" />
              </View>
              <View style={[s.pinTail, { borderTopColor: "#7C3AED" }]} />
            </View>
          </Marker>
        )}

        {/* Station pin — white bg + primary border, same as StationsMap unselected */}
        {stationLoc && !riderPos && (
          <Marker
            coordinate={{ latitude: stationLoc.lat, longitude: stationLoc.lng }}
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={false}
          >
            <View style={s.pinWrapper}>
              <View
                style={[
                  s.pinBubble,
                  {
                    backgroundColor: "#fff",
                    borderColor: theme.primary,
                    borderWidth: 1.5,
                  },
                ]}
              >
                <MaterialIcons
                  name="local-gas-station"
                  size={15}
                  color={theme.primary}
                />
              </View>
              <View style={[s.pinTail, { borderTopColor: theme.primary }]} />
            </View>
          </Marker>
        )}

        {/* Rider pin — primary fill + white border (selected style, matches active station pin) */}
        {riderPos && (
          <Marker
            coordinate={{ latitude: riderPos.lat, longitude: riderPos.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={s.riderPinWrap}>
              <Animated.View
                style={[
                  s.riderPinRing,
                  {
                    backgroundColor: theme.primary,
                    transform: [{ scale: riderMarkerPulse }],
                    opacity: riderMarkerOpacity,
                  },
                ]}
              />
              <View
                style={[
                  s.pinBubble,
                  {
                    backgroundColor: theme.primary,
                    borderColor: "#fff",
                    borderWidth: 2,
                  },
                ]}
              >
                <Ionicons name="bicycle" size={15} color="#fff" />
              </View>
            </View>
          </Marker>
        )}
      </MapView>

      {/* TOP: header + progress */}
      <SafeAreaView pointerEvents="box-none" style={s.topOverlay}>
        {renderHeader()}
        <View
          style={[s.progressCard, { backgroundColor: theme.background + "F2" }]}
        >
          {STEP_LABELS.map((label, i) => (
            <React.Fragment key={label}>
              <View style={s.stepItem}>
                <View
                  style={[
                    s.stepCircle,
                    i < step && {
                      backgroundColor: theme.secondary,
                      borderColor: theme.secondary,
                    },
                    i === step && {
                      backgroundColor: theme.primary,
                      borderColor: theme.primary,
                    },
                    i > step && {
                      backgroundColor: theme.surface,
                      borderColor: theme.ash,
                    },
                  ]}
                >
                  {i < step ? (
                    <Ionicons name="checkmark" size={11} color="#fff" />
                  ) : (
                    <Ionicons
                      name={STEP_ICONS[i]}
                      size={12}
                      color={i === step ? "#fff" : theme.icon}
                    />
                  )}
                </View>
                <Text
                  style={[
                    s.stepLabel,
                    {
                      color:
                        i === step
                          ? theme.primary
                          : i < step
                            ? theme.secondary
                            : theme.icon,
                      fontWeight: i <= step ? "500" : "300",
                    },
                  ]}
                >
                  {label}
                </Text>
              </View>
              {i < STEP_LABELS.length - 1 && (
                <View style={s.progressLine}>
                  <View
                    style={[s.progressLineBase, { backgroundColor: theme.ash }]}
                  />
                  <Animated.View
                    style={[
                      s.progressLineFill,
                      {
                        backgroundColor: theme.secondary,
                        width: connectorAnims[i].interpolate({
                          inputRange: [0, 1],
                          outputRange: ["0%", "100%"],
                        }),
                      },
                    ]}
                  />
                </View>
              )}
            </React.Fragment>
          ))}
        </View>
      </SafeAreaView>

      {/* BOTTOM PANEL — paddingBottom accounts for floating tab bar */}
      <View
        style={[
          s.bottomPanel,
          {
            backgroundColor: theme.background,
            paddingBottom: Math.max(insets.bottom, 16) + 58,
          },
        ]}
      >
        <View style={s.statusRow}>
          <View
            style={[s.statusBadge, { backgroundColor: statusColor + "20" }]}
          >
            <View style={[s.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[s.statusText, { color: statusColor }]}>
              {order.status === "pending"
                ? "Order Placed"
                : order.status === "confirmed"
                  ? "Confirmed"
                  : order.status === "assigned"
                    ? "Rider Assigned"
                    : order.status === "in-transit"
                      ? "On the Way"
                      : order.status === "awaiting_confirmation"
                        ? "Confirm Receipt"
                        : order.status === "delivered"
                          ? "Delivered"
                          : order.status === "cancelled"
                            ? "Cancelled"
                            : "Processing"}
            </Text>
          </View>
          {order.status === "in-transit" && (
            <Text style={[s.etaText, { color: theme.primary }]}>
              ETA {eta} min
            </Text>
          )}
        </View>

        {/* Rider card — shown when a rider is assigned, hidden after delivered */}
        {riderInfo && order.status !== "delivered" ? (
          <View
            style={[
              s.riderCard,
              { backgroundColor: theme.surface, borderColor: theme.ash },
            ]}
          >
            <View style={[s.riderAvatar, { backgroundColor: theme.tertiary }]}>
              {riderInfo.profileImage ? (
                <Image
                  source={{ uri: riderInfo.profileImage }}
                  style={s.riderAvatarPhoto}
                />
              ) : (
                <Ionicons
                  name="bicycle-outline"
                  size={24}
                  color={theme.primary}
                />
              )}
            </View>
            <View style={s.riderInfo}>
              <Text style={[s.riderName, { color: theme.text }]}>
                {riderInfo.displayName}
              </Text>
              <View style={s.riderMetaRow}>
                {riderInfo.rating ? (
                  <View style={s.riderRating}>
                    <Ionicons name="star" size={11} color="#FBBF24" />
                    <Text style={[s.riderMetaText, { color: theme.icon }]}>
                      {riderInfo.rating.toFixed(1)}
                    </Text>
                  </View>
                ) : null}
                {riderInfo.vehiclePlate && (
                  <Text style={[s.riderMetaText, { color: theme.icon }]}>
                    {riderInfo.vehiclePlate}
                  </Text>
                )}
              </View>
            </View>
            {riderInfo.phone && (
              <View style={s.riderActions}>
                <TouchableOpacity
                  style={[s.contactBtn, { backgroundColor: theme.tertiary }]}
                  onPress={() =>
                    Linking.openURL(
                      `sms:${riderInfo.phone}?body=Hi, I'm tracking my delivery`,
                    )
                  }
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="chatbubble-outline"
                    size={15}
                    color={theme.primary}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.contactBtn, { backgroundColor: theme.primary }]}
                  onPress={() => Linking.openURL(`tel:${riderInfo.phone}`)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call" size={15} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <View
            style={[
              s.riderCard,
              { backgroundColor: theme.surface, borderColor: theme.ash },
            ]}
          >
            <View style={s.riderAvatarWrap}>
              {isFinding && (
                <Animated.View
                  style={[
                    s.riderAvatarRing,
                    {
                      backgroundColor: theme.primary,
                      transform: [{ scale: findingPulse }],
                      opacity: findingOpacity,
                    },
                  ]}
                />
              )}
              <View
                style={[s.riderAvatar, { backgroundColor: theme.tertiary }]}
              >
                <Ionicons
                  name="bicycle-outline"
                  size={24}
                  color={theme.primary}
                />
              </View>
            </View>
            <View style={s.riderInfo}>
              <Text style={[s.riderName, { color: theme.text }]}>
                {order.fuel?.name} · {order.quantity} {order.fuel?.unit}
              </Text>
              <Text style={[s.riderMetaText, { color: theme.icon }]}>
                {order.status === "confirmed"
                  ? "Finding a rider…"
                  : order.status === "pending"
                    ? "Awaiting confirmation"
                    : ""}
              </Text>
            </View>
          </View>
        )}

        {/* Confirm Receipt button */}
        {order.status === "awaiting_confirmation" && (
          <TouchableOpacity
            style={[
              s.confirmBtn,
              {
                backgroundColor: "#22C55E",
                opacity: confirmingReceipt ? 0.7 : 1,
              },
            ]}
            onPress={handleConfirmReceipt}
            disabled={confirmingReceipt}
            activeOpacity={0.85}
          >
            {confirmingReceipt ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color="#fff"
                />
                <Text style={s.confirmBtnText}>I've Received My Order</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      <RateServiceModal
        visible={showRate}
        orderId={order._id}
        riderId={order.riderId}
        onClose={() => setShowRate(false)}
      />
    </View>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    loadingLabel: {
      alignItems: "center",
      paddingVertical: 20,
      marginHorizontal: 16,
      borderRadius: 16,
      marginBottom: 32,
    },
    loadingText: { fontSize: 14, fontWeight: "300" },
    topOverlay: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
    progressCard: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 12,
      marginTop: 4,
      padding: 14,
      borderRadius: 16,
    },
    stepItem: { alignItems: "center", width: 60 },
    stepCircle: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      marginBottom: 4,
    },
    stepLabel: { fontSize: 10, textAlign: "center" },
    progressLine: {
      flex: 1,
      height: 2,
      borderRadius: 1,
      marginBottom: 12,
      overflow: "hidden",
    },
    progressLineBase: {
      position: "absolute",
      width: "100%",
      height: "100%",
      borderRadius: 1,
    },
    progressLineFill: {
      position: "absolute",
      height: "100%",
      left: 0,
      top: 0,
      borderRadius: 1,
    },
    bottomPanel: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 16,
      paddingTop: 16,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 12,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    statusDot: { width: 7, height: 7, borderRadius: 4 },
    statusText: { fontSize: 12, fontWeight: "500" },
    etaText: { fontSize: 15, fontWeight: "500" },
    riderCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      marginBottom: 12,
    },
    riderAvatarWrap: {
      width: 48,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
    },
    riderAvatarRing: {
      position: "absolute",
      width: 48,
      height: 48,
      borderRadius: 24,
    },
    riderAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: "center",
      alignItems: "center",
    },
    riderInfo: { flex: 1 },
    riderName: { fontSize: 15, fontWeight: "500", marginBottom: 2 },
    riderMeta: { fontSize: 12, fontWeight: "300" },
    riderMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 2,
    },
    riderRating: { flexDirection: "row", alignItems: "center", gap: 3 },
    riderMetaText: { fontSize: 12, fontWeight: "300" },
    riderActions: { flexDirection: "row", gap: 8 },
    riderActionBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
    },
    confirmBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 15,
      borderRadius: 16,
      marginTop: 4,
    },
    confirmBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
    addressRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 12,
    },
    addressText: { fontSize: 13, fontWeight: "300", flex: 1 },
    historyLink: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    historyLinkText: { fontSize: 13, fontWeight: "400" },
    emptyCard: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 36,
      alignItems: "center",
      gap: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
      elevation: 16,
    },
    emptyIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      justifyContent: "center",
      alignItems: "center",
    },
    emptyTitle: { fontSize: 19, fontWeight: "500" },
    emptySub: {
      fontSize: 13,
      fontWeight: "300",
      textAlign: "center",
      lineHeight: 19,
      maxWidth: 280,
    },
    emptyBtn: {
      paddingVertical: 14,
      paddingHorizontal: 40,
      borderRadius: 16,
      marginTop: 4,
      marginBottom: 10,
      width: "100%" as any,
      alignItems: "center" as any,
    },
    emptyBtnText: { color: "#fff", fontSize: 15, fontWeight: "500" },
    // Map pins — identical to StationsMap
    pinWrapper: { alignItems: "center" },
    pinBubble: {
      width: 38,
      height: 38,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.18,
      shadowRadius: 6,
      elevation: 6,
    },
    pinTail: {
      width: 0,
      height: 0,
      borderLeftWidth: 5,
      borderRightWidth: 5,
      borderTopWidth: 7,
      borderLeftColor: "transparent",
      borderRightColor: "transparent",
      marginTop: -1,
    },
    riderPinPhoto: { width: 34, height: 34, borderRadius: 10 },
    // Rider pin wrapper (for pulse ring)
    riderPinWrap: {
      width: 38,
      height: 38,
      alignItems: "center",
      justifyContent: "center",
    },
    riderPinRing: {
      position: "absolute",
      width: 38,
      height: 38,
      borderRadius: 19,
    },
    // Rider card avatar photo
    riderAvatarPhoto: { width: 44, height: 44, borderRadius: 22 },
    contactBtns: { flexDirection: "row", gap: 6 },
    contactBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      justifyContent: "center",
      alignItems: "center",
    },
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
