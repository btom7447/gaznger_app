import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import BottomSheet from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Theme, useTheme } from "@/constants/theme";
import { useOrderStore } from "@/store/useOrderStore";
import { getSocket } from "@/lib/socket";
import { api } from "@/lib/api";
import {
  EmptyState,
  LiveBadge,
  MapMarkerRider,
  OfflineStrip,
  ScreenContainer,
} from "@/components/ui/primitives";
import {
  getProgressStep,
  getStatusLabel,
} from "@/utils/orderStatusLabels";
import TrackingSheetContent, {
  RiderInfo,
} from "@/components/ui/customer/track/TrackingSheetContent";

interface RouteResponse {
  /** [lat, lng] tuples in order. */
  polyline: [number, number][];
  distanceMeters?: number;
  durationSeconds?: number;
}

interface ServerOrder {
  _id: string;
  status: string;
  eta?: number;
  riderId?: {
    _id: string;
    displayName?: string;
    phone?: string;
    profileImage?: string;
  } | null;
  /** Rider profile populated separately when present. */
  riderProfile?: {
    plate?: string;
    rating?: number;
  } | null;
}

const ROUTE_REFETCH_MS = 60_000;

export default function TrackScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const draft = useOrderStore((s) => s.order);
  const setRiderInStore = useOrderStore((s) => s.setRider);
  const setDeliveryConfirmation = useOrderStore(
    (s) => s.setDeliveryConfirmation
  );
  const setWeighIn = useOrderStore((s) => s.setWeighIn);

  const [serverStatus, setServerStatus] = useState<string>("assigning");
  const [eta, setEta] = useState<number>(12);
  const [riderCoord, setRiderCoord] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  // Seed rider state from the persisted draft so a re-mount (e.g. user
  // navigated away and came back) doesn't flash the matching state when
  // we already know who the rider is.
  const [rider, setRider] = useState<RiderInfo | null>(
    draft.rider ? (draft.rider as RiderInfo) : null
  );
  const [routePolyline, setRoutePolyline] = useState<
    { latitude: number; longitude: number }[]
  >([]);
  const mapRef = useRef<MapView>(null);
  const sheetRef = useRef<BottomSheet>(null);

  const destinationCoord = useMemo(
    () => ({
      latitude: draft.deliveryCoords?.lat ?? 6.5244,
      longitude: draft.deliveryCoords?.lng ?? 3.3792,
    }),
    [draft.deliveryCoords]
  );

  /* ───────────────── Initial fetch ─────────────────
   * Pull the order doc once so we have the rider profile + actual
   * server status before any socket events arrive. Without this the
   * sheet would sit on its default `assigning` state until the first
   * push lands.
   */
  useEffect(() => {
    if (!draft.orderId) return;
    let cancelled = false;
    api
      .get<ServerOrder>(`/api/orders/${draft.orderId}`, { timeoutMs: 10_000 })
      .then((order) => {
        if (cancelled) return;
        if (order.status) setServerStatus(order.status);
        if (typeof order.eta === "number") setEta(order.eta);
        if (order.riderId) {
          const r = order.riderId;
          const display = r.displayName ?? "Your rider";
          const [first, ...rest] = display.split(/\s+/);
          const riderInfo: RiderInfo = {
            firstName: first ?? "Rider",
            lastName: rest.join(" "),
            plate: order.riderProfile?.plate,
            rating: order.riderProfile?.rating,
            phone: r.phone,
            initials: display
              .split(/\s+/)
              .map((p) => p.charAt(0))
              .join("")
              .slice(0, 2)
              .toUpperCase(),
          };
          setRider(riderInfo);
          setRiderInStore(riderInfo);
        }
      })
      .catch(() => {
        // Non-fatal — socket events will fill us in.
      });
    return () => {
      cancelled = true;
    };
  }, [draft.orderId]);

  /* ───────────────── Socket subscriptions ───────────────── */
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !draft.orderId) return;
    const onUpdate = (data: {
      status?: string;
      eta?: number;
      rider?: RiderInfo;
      deliveredAt?: string;
      totalCharged?: number;
      pointsEarned?: number;
      weighIn?: { emptyKg: number; fullKg: number; netKg: number };
    }) => {
      if (data.status) setServerStatus(data.status);
      if (typeof data.eta === "number") setEta(data.eta);
      // Server emits `rider` once it's assigned — replaces our placeholder
      // and persists to the order store so other screens see it too.
      if (data.rider) {
        setRider(data.rider);
        setRiderInStore(data.rider);
      }
      // Capture delivery-confirm payload so Delivered/Complete can read
      // server-issued totals + timestamp without a follow-up GET.
      if (data.deliveredAt || data.totalCharged != null || data.pointsEarned != null) {
        setDeliveryConfirmation({
          deliveredAt: data.deliveredAt,
          totalCharged: data.totalCharged,
          pointsEarned: data.pointsEarned,
        });
      }
      if (data.weighIn) setWeighIn(data.weighIn);
    };
    const onLocation = (data: { lat: number; lng: number }) => {
      setRiderCoord({ latitude: data.lat, longitude: data.lng });
    };
    socket.on("order:update", onUpdate);
    socket.on("rider:location", onLocation);
    return () => {
      socket.off("order:update", onUpdate);
      socket.off("rider:location", onLocation);
    };
  }, [draft.orderId]);

  /* ───────────────── Real-road polyline ─────────────────
   * We refetch the rider→destination polyline every 60s rather than on
   * every coord push. The rider marker animates via socket updates;
   * the polyline is the slower-moving "road geometry" anchor.
   */
  useEffect(() => {
    if (!draft.orderId || !riderCoord) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const fetchRoute = async () => {
      try {
        const data = await api.get<RouteResponse>(
          `/api/orders/${draft.orderId}/route?riderLat=${riderCoord.latitude}&riderLng=${riderCoord.longitude}`,
          { timeoutMs: 10_000 }
        );
        if (cancelled) return;
        const points = (data.polyline ?? []).map(([lat, lng]) => ({
          latitude: lat,
          longitude: lng,
        }));
        setRoutePolyline(points);
      } catch {
        // Falls back to a straight line in render if no polyline cached.
      }
    };

    fetchRoute();
    timer = setInterval(fetchRoute, ROUTE_REFETCH_MS);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [draft.orderId, riderCoord?.latitude, riderCoord?.longitude]);

  // When status flips to `arrived` (via socket), hand off to Arrival/Handoff.
  useEffect(() => {
    if (serverStatus !== "arrived") return;
    if (!draft.orderId) return;
    if (draft.product === "lpg") {
      router.replace("/(customer)/(track)/handoff" as never);
    } else {
      router.replace("/(customer)/(track)/arrival" as never);
    }
  }, [serverStatus, draft.product, draft.orderId, router]);

  const status = useMemo(
    () => getStatusLabel({ status: serverStatus, product: draft.product }),
    [serverStatus, draft.product]
  );
  const step = getProgressStep(serverStatus);

  const arrivalTime = useMemo(() => {
    const d = new Date(Date.now() + eta * 60_000);
    return d.toLocaleTimeString("en-NG", {
      hour: "numeric",
      minute: "2-digit",
    });
  }, [eta]);

  const phase: "matching" | "active" =
    serverStatus === "assigning" || serverStatus === "confirmed" || !rider
      ? "matching"
      : "active";

  /* ───────────────── Handlers ───────────────── */

  const handleMinimize = useCallback(() => {
    sheetRef.current?.snapToIndex(0); // smallest snap point
  }, []);

  const handleRecenter = useCallback(() => {
    const center = riderCoord
      ? {
          latitude: (riderCoord.latitude + destinationCoord.latitude) / 2,
          longitude: (riderCoord.longitude + destinationCoord.longitude) / 2,
        }
      : destinationCoord;
    mapRef.current?.animateToRegion(
      {
        ...center,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      },
      320
    );
  }, [riderCoord, destinationCoord]);

  const handleCall = useCallback(() => {
    if (rider?.phone) Linking.openURL(`tel:${rider.phone}`);
  }, [rider?.phone]);

  const handleChat = useCallback(() => {
    // TODO: in-app chat. For now route to the rider profile screen
    // (placeholder — exists post-rider-revamp). Avoids a dead button.
    if (!rider) return;
    router.push("/(screens)/profile" as never);
  }, [rider, router]);

  // No active order → empty state.
  if (!draft.orderId && !draft.station) {
    return (
      <ScreenContainer edges={["top", "bottom"]} contentStyle={styles.emptyWrap}>
        <EmptyState
          icon="bicycle-outline"
          title="No active order"
          body="When you have an order in flight, you'll see it live here."
          action={{
            label: "Place an order",
            onPress: () => router.push("/(customer)/(home)" as never),
          }}
          tileBg={theme.bgMuted}
          tileFg={theme.fgMuted}
        />
      </ScreenContainer>
    );
  }

  const snapPoints: (number | `${number}%`)[] = ["18%", "45%", "85%"];

  // Real-road polyline if we have one, otherwise a straight line as
  // fallback (better than nothing while the directions API replies).
  const polylineCoords =
    routePolyline.length > 1
      ? routePolyline
      : riderCoord
      ? [riderCoord, destinationCoord]
      : [];

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: riderCoord
            ? (riderCoord.latitude + destinationCoord.latitude) / 2
            : destinationCoord.latitude,
          longitude: riderCoord
            ? (riderCoord.longitude + destinationCoord.longitude) / 2
            : destinationCoord.longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
      >
        {polylineCoords.length > 1 ? (
          <Polyline
            coordinates={polylineCoords}
            strokeColor={theme.primary}
            strokeWidth={4}
          />
        ) : null}
        {riderCoord ? <MapMarkerRider coordinate={riderCoord} pulse /> : null}
        <Marker coordinate={destinationCoord}>
          <View style={styles.destPin}>
            <Ionicons name="location" size={22} color={theme.primary} />
          </View>
        </Marker>
      </MapView>

      {/* Offline / reconnecting strip — slides in across the top when
          NetInfo reports offline > ~1s. Renders BELOW the safe-area inset
          so it doesn't collide with the status bar. */}
      <View
        style={[styles.offlineWrap, { top: insets.top + 8 }]}
        pointerEvents="box-none"
      >
        <OfflineStrip />
      </View>

      {/* Top overlay — minimize, live badge, recenter */}
      <View style={[styles.topOverlay, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={handleMinimize}
          accessibilityRole="button"
          accessibilityLabel="Minimize tracking sheet"
          accessibilityHint="Collapses the tracking details. Your order keeps running."
          style={({ pressed }) => [
            styles.roundBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons name="chevron-down" size={22} color={theme.fg} />
        </Pressable>
        <View style={styles.liveWrap}>
          <LiveBadge />
        </View>
        <Pressable
          onPress={handleRecenter}
          accessibilityRole="button"
          accessibilityLabel="Re-center map on rider"
          style={({ pressed }) => [
            styles.roundBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons name="navigate-outline" size={20} color={theme.fg} />
        </Pressable>
      </View>

      <BottomSheet
        ref={sheetRef}
        index={1}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        backgroundStyle={{
          backgroundColor: theme.surfaceElevated,
          borderTopLeftRadius: theme.radius.xl,
          borderTopRightRadius: theme.radius.xl,
        }}
        handleIndicatorStyle={{
          backgroundColor: theme.borderStrong,
        }}
      >
        <View style={styles.sheetContent}>
          <TrackingSheetContent
            phase={phase}
            status={status}
            orderId={draft.orderId ?? "—"}
            etaMinutes={eta}
            arrivalTime={arrivalTime}
            qty={draft.qty ?? 0}
            unit={draft.unit ?? "L"}
            fuelLabel={draft.fuelTypeId ?? ""}
            totalNaira={(draft.station?.totalKobo ?? 0) / 100}
            step={step}
            rider={rider}
            onCall={handleCall}
            onChat={handleChat}
          />
        </View>
      </BottomSheet>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1 },
    emptyWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    topOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.space.s4,
    },
    offlineWrap: {
      position: "absolute",
      left: theme.space.s4,
      right: theme.space.s4,
      // Sits above the top overlay so the offline message is the most
      // prominent thing on screen when the socket drops.
      zIndex: 10,
    },
    roundBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
      ...theme.elevation.card,
    },
    liveWrap: {
      backgroundColor: theme.surface,
      borderRadius: theme.radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 4,
      ...theme.elevation.card,
    },
    destPin: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
      ...theme.elevation.card,
    },
    sheetContent: {
      paddingHorizontal: theme.space.s4,
      paddingTop: theme.space.s2,
    },
  });
