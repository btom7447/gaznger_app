import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Linking,
  Platform,
  TextInput,
} from "react-native";
import MapView, { Circle, Marker, Polyline } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as Location from "expo-location";
import { toast } from "sonner-native";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";
import { getSocket, subscribeReconnect, useSocketStatus } from "@/lib/socket";
import SocketStrip from "@/components/ui/global/SocketStrip";
import {
  enqueueAction,
  subscribeActionFailure,
  subscribeActionQueue,
  retryHeadOfQueue,
  dropHeadOfQueue,
  type QueuedAction,
} from "@/lib/actionQueue";
import MapSkeleton from "@/components/ui/skeletons/MapSkeleton";
import Avatar from "@/components/ui/global/Avatar";
import {
  DestinationMapPin,
  RiderMapPin,
  StationMapPin,
} from "@/components/ui/customer/track/MapPins";
import BackButton from "@/components/ui/global/BackButton";
import NotificationButton from "@/components/ui/global/NotificationButton";
import ProfileButton from "@/components/ui/global/ProfileButton";

/**
 * Delivery status mirrors the server's expanded enum. Spans both
 * legacy values (`accepted`/`picked_up`) AND the v3 granular pipeline
 * (`at_plant`/`refilling`/`returning`/`arrived`/`dispensing`). The
 * rider-side UX drives the granular flow now; legacy values stay as
 * a fallback for old delivery rows already in the pipeline.
 */
type DeliveryStatus =
  | "pending"
  | "accepted"
  | "picked_up"
  | "at_plant"
  | "refilling"
  | "returning"
  | "arrived"
  | "dispensing"
  | "awaiting_confirmation"
  | "delivered"
  | "dropped"
  | "failed";

interface ActiveDelivery {
  _id: string;
  status: DeliveryStatus;
  riderEarnings: number;
  station: {
    name: string;
    address: string;
    location?: { lat: number; lng: number };
  };
  order: {
    _id: string;
    fuel: { name: string; unit: string };
    quantity: number;
    user: { _id?: string; displayName: string; phone?: string; profileImage?: string };
    deliveryAddress: {
      street: string;
      city: string;
      state: string;
      latitude?: number;
      longitude?: number;
    };
    // Populated when station not set on delivery record
    station?: { location?: { lat: number; lng: number } };
  };
}

// 6s gives the customer a fluid-feeling rider pin without burning
// the rider's battery or our rate limiter. The map marker's pulse
// + interpolation-on-coord-change masks the gap between pings.
const LOCATION_POLL_MS = 6_000;

export default function RiderTrackScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [delivery, setDelivery] = useState<ActiveDelivery | null>(null);
  const [loading, setLoading] = useState(true);
  // Rider's own coords — driven by the location-polling effect below.
  // Same source as the GPS we ship to the server, so the marker on the
  // rider's screen reflects exactly the position the customer sees on
  // theirs (no two-source drift).
  const [riderCoord, setRiderCoord] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  // Polyline geometry for the rider's currently-driving leg. Populated
  // by both an initial GET /route fetch (for fast first paint) and
  // subsequent route:update socket pushes from the server. Empty until
  // we have real road geometry — no straight-line drawing as a stand-in.
  const [routePolyline, setRoutePolyline] = useState<
    { latitude: number; longitude: number }[]
  >([]);
  // Route distance + duration mirrored from the server response. Used
  // in the rider's bottom panel ETA chip; null until first compute.
  const [routeMeta, setRouteMeta] = useState<{
    distanceMeters?: number;
    durationSeconds?: number;
  } | null>(null);
  // Per-step maneuvers from Google Directions for the active leg.
  // Drives the "Turn right onto Aba Road — 280 m" banner. The server
  // pre-strips HTML so we can render `instruction` directly.
  const [routeSteps, setRouteSteps] = useState<
    {
      instruction: string;
      distanceM: number;
      durationS: number;
      maneuver?: string;
      startLat: number;
      startLng: number;
      endLat: number;
      endLng: number;
    }[]
  >([]);
  // Camera-follow flag. true → animateCamera on every rider GPS tick
  // so the rider's pin stays centred. Flips to false when the user
  // pans the map manually; the recenter button restores it.
  const [followRider, setFollowRider] = useState(true);
  // Continuous pulse around the rider's GPS pin — same machinery as
  // the destination halo on the Stations map. Map-native Circle so
  // the bitmap stays sharp at every zoom level.
  const riderPulseRef = useRef(new Animated.Value(0));
  const [riderPulseProgress, setRiderPulseProgress] = useState(0);
  const [pickupLoading, setPickupLoading] = useState(false);
  const [deliverLoading, setDeliverLoading] = useState(false);
  const [showDropModal, setShowDropModal] = useState(false);
  const [dropReason, setDropReason] = useState("");
  const [dropping, setDropping] = useState(false);

  // Re-bind trigger for the socket subscriptions below — see same
  // pattern in customer Track. Without this dep, the effect runs
  // once with a null socket on first mount and never re-binds when
  // the socket eventually connects.
  const socketStatus = useSocketStatus();

  // Tab bar clearance: pill (42px) + buffer
  const tabBarClearance = Math.max(insets.bottom, 16) + 58;

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ delivery: ActiveDelivery | null }>("/api/rider/active");
      const d = res.delivery;
      if (d && d.status !== "pending") {
        setDelivery(d);
      } else {
        setDelivery(null);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Rider GPS halo — Circle radius/opacity tick driver. Same shape as
  // the destination halo on the Stations map; we just listen to the
  // animated value and mirror it into state so a non-Animated `Circle`
  // re-renders on each frame.
  useEffect(() => {
    const v = riderPulseRef.current;
    const id = v.addListener(({ value }) => setRiderPulseProgress(value));
    const loop = Animated.loop(
      Animated.timing(v, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      })
    );
    loop.start();
    return () => {
      loop.stop();
      v.removeListener(id);
    };
  }, []);

  // Camera follow — recentre on every rider GPS tick when followRider
  // is true. animateCamera is smooth (300 ms ease) so the rider sees
  // the map glide along with them. The Track screen owns the follow
  // toggle: panning the map drops follow (onPanDrag handler below);
  // the recenter FAB restores it.
  useEffect(() => {
    if (!followRider || !riderCoord || !mapRef.current) return;
    mapRef.current.animateCamera(
      {
        center: riderCoord,
        // 16-ish reads as "navigation zoom" on Google Maps. Higher
        // and the map feels claustrophobic; lower and the next
        // maneuver isn't visible.
        zoom: 16,
      },
      { duration: 600 }
    );
  }, [followRider, riderCoord?.latitude, riderCoord?.longitude]);

  // Reconnect catch-up — when the socket comes back live after a
  // drop, re-pull the active delivery so any state changes that
  // happened while offline (customer confirmed delivered, admin
  // cancelled, etc.) land instantly.
  useEffect(() => subscribeReconnect(load), [load]);

  // Socket: delivery status updates sent directly to rider (pickup, complete)
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onDeliveryUpdate = ({ deliveryId, status }: { deliveryId: any; status: string }) => {
      setDelivery((prev) => {
        if (!prev || String(prev._id) !== String(deliveryId)) return prev;
        return { ...prev, status: status as DeliveryStatus };
      });
    };
    socket.on("delivery:update", onDeliveryUpdate);
    return () => { socket.off("delivery:update", onDeliveryUpdate); };
  }, [socketStatus]);

  // Socket: order-level updates (customer confirms → delivered, or cancelled)
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onOrderUpdate = ({ orderId, status }: { orderId: any; status: string }) => {
      setDelivery((prev) => {
        if (!prev || String(prev.order._id) !== String(orderId)) return prev;
        if (status === "cancelled" || status === "delivered") return null;
        return prev;
      });
    };
    socket.on("order:update", onOrderUpdate);
    return () => { socket.off("order:update", onOrderUpdate); };
  }, [socketStatus]);

  /**
   * Map the active delivery status to the leg the rider is driving.
   * Returns null when there's no leg to draw — pre-acceptance, no
   * coords, or terminal states. Mirrors the server's
   * `routeTargetForStatus` helper so the rider's screen requests the
   * same geometry the customer sees.
   */
  const routeTarget: "station" | "destination" | null = useMemo(() => {
    if (!delivery || !riderCoord) return null;
    const s = delivery.status;
    if (s === "accepted" || s === "at_plant" || s === "refilling") return "station";
    if (
      s === "picked_up" ||
      s === "returning" ||
      s === "arrived" ||
      s === "dispensing"
    )
      return "destination";
    return null;
  }, [delivery, riderCoord]);

  /**
   * Listen for route:update broadcasts from the server. The rider's
   * own GPS pings drive the recompute upstream, so on the happy path
   * the rider receives their own pushed routes back from the delivery
   * room. Same payload shape as the customer screen so we can keep
   * the handler symmetric.
   */
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !delivery) return;
    const onRouteUpdate = (data: {
      orderId?: string;
      polyline?: [number, number][];
      target?: "station" | "destination";
      distanceM?: number;
      durationS?: number;
      steps?: typeof routeSteps;
    }) => {
      if (!data.polyline) return;
      // Drop pushes for stale deliveries (e.g. just-completed order
      // whose room socket hasn't been kicked yet).
      if (data.orderId && data.orderId !== String(delivery.order._id)) return;
      // We deliberately do NOT filter by target. Server is the source
      // of truth for which leg is active — if it pushed
      // target=destination, the leg flipped server-side and we should
      // mirror immediately, even if our local `delivery.status` hasn't
      // caught up yet (the PATCH response → load() chain takes 100s of
      // ms; the client's routeTarget would still read "station" and
      // drop the destination push, leaving the rider with a stale
      // station polyline until the next GPS ping recomputes).
      const points = data.polyline.map(([lat, lng]) => ({
        latitude: lat,
        longitude: lng,
      }));
      setRoutePolyline(points);
      setRouteMeta({
        distanceMeters: data.distanceM,
        durationSeconds: data.durationS,
      });
      if (data.steps) setRouteSteps(data.steps);
    };
    socket.on("route:update", onRouteUpdate);
    return () => {
      socket.off("route:update", onRouteUpdate);
    };
  }, [delivery, socketStatus]);

  /**
   * Initial route fetch on each phase change. Without this the rider
   * sees no polyline until their first GPS ping has triggered a
   * server-side recompute (~6s). We hit GET /route with the rider's
   * current coords + active target so the first paint is immediate.
   */
  useEffect(() => {
    if (!delivery || !riderCoord || !routeTarget) {
      setRoutePolyline([]);
      setRouteMeta(null);
      setRouteSteps([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<{
          polyline: [number, number][];
          distanceMeters?: number;
          durationSeconds?: number;
          steps?: typeof routeSteps;
        }>(
          `/api/orders/${delivery.order._id}/route?riderLat=${riderCoord.latitude}&riderLng=${riderCoord.longitude}&target=${routeTarget}`,
          { timeoutMs: 10_000 }
        );
        if (cancelled) return;
        const points = (data.polyline ?? []).map(([lat, lng]) => ({
          latitude: lat,
          longitude: lng,
        }));
        setRoutePolyline(points);
        setRouteMeta({
          distanceMeters: data.distanceMeters,
          durationSeconds: data.durationSeconds,
        });
        setRouteSteps(data.steps ?? []);
      } catch {
        // Socket push will fill this in on the next GPS ping.
      }
    })();
    return () => {
      cancelled = true;
    };
    // We don't depend on riderCoord changes — the route:update socket
    // already owns the per-ping refresh path. Re-running this on every
    // GPS update would double our Directions calls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delivery?.order?._id, routeTarget]);

  // Phase 3: socket-first — the customer's /confirm-delivery emits
  // order:update with status=delivered, and the listener above
  // clears the local delivery on the rider side. We keep a longer
  // (30s) safety poll as a backstop for the rare case where the
  // socket missed the event AND the reconnect catch-up hasn't fired
  // yet (e.g. rider went background then foreground without a real
  // disconnect). Was 8s — we can afford to relax.
  useEffect(() => {
    if (delivery?.status === "awaiting_confirmation") {
      pollRef.current = setInterval(load, 30_000);
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [delivery?.status, load]);

  // Location sharing while active delivery
  useEffect(() => {
    if (!delivery) return;
    const startPolling = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const send = async () => {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const { latitude: lat, longitude: lng } = loc.coords;
          // Mirror the GPS we just shipped into local state so the
          // rider's own marker on the map redraws in step with the
          // socket emit. Without this the rider sees a stale dot
          // until the next round-trip lands a `rider:location` echo.
          setRiderCoord({ latitude: lat, longitude: lng });
          await api.patch("/api/rider/location", { lat, lng });
          getSocket()?.emit("rider:location", { lat, lng });
        } catch {}
      };
      send();
      locationIntervalRef.current = setInterval(send, LOCATION_POLL_MS);
    };
    startPolling();
    return () => {
      if (locationIntervalRef.current) { clearInterval(locationIntervalRef.current); locationIntervalRef.current = null; }
    };
  }, [!!delivery]);

  // Fit map to both pins whenever status changes
  useEffect(() => {
    if (!mapRef.current || !delivery) return;
    const coords: { latitude: number; longitude: number }[] = [];
    const { location } = delivery.station;
    const { latitude, longitude } = delivery.order.deliveryAddress;
    if (location) coords.push({ latitude: location.lat, longitude: location.lng });
    if (latitude != null && longitude != null) coords.push({ latitude, longitude });
    if (coords.length >= 2) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 100, right: 60, bottom: 360, left: 60 },
          animated: true,
        });
      }, 400);
    }
  }, [delivery?.status]);

  /**
   * Single helper used by every granular phase button below.
   * Posts to the matching v3 endpoint; the server transitions both
   * Delivery + Order statuses and emits the customer-side
   * `order:update` event we need to keep the customer screen in
   * sync. We don't optimistically flip local state — the
   * `delivery:update` socket event from the server is authoritative
   * and lands within ~100ms.
   */
  const [transitioning, setTransitioning] = useState(false);
  /**
   * Track the action id of the most recent transition we enqueued
   * AND its rollback hook (the prior status to revert to if the
   * server eventually terminally rejects). Keyed by action id so
   * multiple in-flight transitions can each find their own
   * rollback target. Phase 10 — when the queue notifies that an
   * action exhausted its retry budget, we look up its rollback
   * here and apply it.
   */
  const rollbacksRef = useRef<Map<string, DeliveryStatus>>(new Map());

  /**
   * Optimistic + queued transition helper.
   *
   * Combines Phase 4 (optimistic UI) with Phase 10 (offline action
   * queue). The flow:
   *
   *   1. Flip local state to `optimisticNext` immediately.
   *   2. Enqueue the PATCH via the action queue. The queue handles:
   *      - Persistence to AsyncStorage (survives app kill).
   *      - Retry with backoff (1s, 5s, 30s, 5min).
   *      - Drain on socket reconnect / AppState foreground.
   *   3. On success (queue drains, server returns 200): no UI work.
   *      The server's `delivery:update` socket emit confirms the
   *      status the user already sees.
   *   4. On terminal failure (after MAX_ATTEMPTS exhausted):
   *      `subscribeActionFailure` fires; we look up the rollback
   *      target by action id and revert local state, then drop the
   *      head of the queue so the rider can move on.
   *
   * Trade-off vs the prior direct-PATCH approach: terminal failures
   * now take ~5 minutes to surface (the queue has to exhaust its
   * backoff) instead of immediately. That's acceptable because:
   *   - The optimistic UI is correct in the common case (>99%).
   *   - The pending-sync indicator tells the user something's mid-
   *     flight, so they're not silently lied to.
   *   - When the network comes back mid-backoff, the action lands
   *     and everything reconciles automatically.
   */
  const runTransition = useCallback(
    (slug: string, errorMsg: string, optimisticNext: DeliveryStatus) => {
      if (!delivery || transitioning) return;
      const previousStatus = delivery.status;
      const deliveryId = delivery._id;

      // Optimistic flip + lock — both happen synchronously so the
      // CTA disables and the status label updates in the same frame.
      setTransitioning(true);
      setDelivery((prev) =>
        prev ? { ...prev, status: optimisticNext } : prev
      );
      // Release the transitioning lock immediately after the flip so
      // consecutive CTAs aren't blocked by AsyncStorage / network.
      // The rollback map still guards against double-tap: each action
      // gets its own id, and failure reverts by that id.
      setTransitioning(false);

      // Enqueue in the background — don't block the render cycle.
      enqueueAction({
        endpoint: `/api/rider/deliveries/${deliveryId}/${slug}`,
        method: "PATCH",
      }).then((queued) => {
        rollbacksRef.current.set(queued.id, previousStatus);
        rollbackErrors.current.set(queued.id, errorMsg);
      }).catch((err: any) => {
        // enqueueAction itself failed (AsyncStorage error) — revert.
        setDelivery((prev) =>
          prev ? { ...prev, status: previousStatus } : prev
        );
        toast.error(errorMsg, { description: err?.message ?? "Try again." });
      });
    },
    [delivery, transitioning]
  );

  // Per-action error-message map so the terminal-failure listener
  // shows a contextual toast (matching the slug the rider tapped).
  const rollbackErrors = useRef<Map<string, string>>(new Map());

  // Subscribe to terminal queue failures. When an action exhausts
  // its retry budget, look up its rollback target and revert local
  // state. Drop the head so the queue unhalts and subsequent
  // transitions can flow.
  useEffect(() => {
    return subscribeActionFailure(async (failed: QueuedAction) => {
      const rollback = rollbacksRef.current.get(failed.id);
      const message = rollbackErrors.current.get(failed.id) ?? "Sync failed";
      rollbacksRef.current.delete(failed.id);
      rollbackErrors.current.delete(failed.id);
      if (rollback) {
        setDelivery((prev) =>
          prev ? { ...prev, status: rollback } : prev
        );
      }
      toast.error(message, {
        description: "Couldn't sync after several retries. Tap retry to try again, or dismiss to drop.",
      });
      // Drop the failed entry so the queue can proceed. The user can
      // re-tap the CTA if they want to actually retry.
      await dropHeadOfQueue();
    });
  }, []);

  // Granular handlers — each maps to one server endpoint and an
  // optimistic next status for instant local feedback.
  const handleAtPlant = useCallback(
    () => runTransition("at-plant", "Couldn't mark at plant", "at_plant"),
    [runTransition]
  );
  const handleRefilling = useCallback(
    () => runTransition("refilling", "Couldn't start refilling", "refilling"),
    [runTransition]
  );
  const handleHeadingBack = useCallback(
    () => runTransition("heading-back", "Couldn't mark heading back", "returning"),
    [runTransition]
  );
  const handleArrived = useCallback(
    () => runTransition("arrived", "Couldn't mark arrived", "arrived"),
    [runTransition]
  );
  const handleDispensing = useCallback(
    () => runTransition("dispensing", "Couldn't start dispensing", "dispensing"),
    [runTransition]
  );
  const handleFinalise = useCallback(
    () => runTransition("finalise", "Couldn't finalise delivery", "awaiting_confirmation"),
    [runTransition]
  );

  // Legacy fallbacks — kept so any in-flight delivery still in the
  // legacy `accepted` / `picked_up` states can be wrapped up by an
  // upgraded rider client.
  const handlePickup = useCallback(async () => {
    if (!delivery || pickupLoading) return;
    setPickupLoading(true);
    try {
      await api.patch(`/api/rider/deliveries/${delivery._id}/pickup`);
      await load();
    } catch (err: any) {
      toast.error("Failed to confirm pickup", { description: err.message });
    } finally {
      setPickupLoading(false);
    }
  }, [delivery, pickupLoading, load]);

  const handleComplete = useCallback(async () => {
    if (!delivery || deliverLoading) return;
    setDeliverLoading(true);
    try {
      await api.patch(`/api/rider/deliveries/${delivery._id}/complete`);
      await load();
    } catch (err: any) {
      toast.error("Failed to mark delivery", { description: err.message });
    } finally {
      setDeliverLoading(false);
    }
  }, [delivery, deliverLoading, load]);

  const handleDropSubmit = useCallback(async () => {
    if (!delivery || !dropReason.trim()) return;
    setDropping(true);
    try {
      await api.patch(`/api/rider/deliveries/${delivery._id}/drop`, { reason: dropReason.trim() });
      setDelivery(null);
      setShowDropModal(false);
      setDropReason("");
      toast.info("Order dropped", { description: "A new rider will be assigned." });
    } catch (err: any) {
      toast.error("Failed to drop order", { description: err.message });
    } finally {
      setDropping(false);
    }
  }, [delivery, dropReason]);

  const s = styles(theme);

  /**
   * Active maneuver — the step the rider is currently driving.
   *
   * Picks the step whose end-point is closest to the rider, scanning
   * in order so we don't snap back to a previous step on GPS jitter.
   * Returns null when steps are empty (pre-fetch / straight-line
   * fallback) so the banner self-hides.
   *
   * MUST live before the loading/empty early-returns below — React
   * requires every hook to run on every render. Putting `useMemo`
   * after `if (loading) return …` crashes with "Rendered more hooks
   * than during the previous render" the first time delivery arrives.
   */
  const activeStep = useMemo(() => {
    if (!riderCoord || routeSteps.length === 0) return null;
    const dist = (
      a: { lat: number; lng: number },
      b: { lat: number; lng: number }
    ) => {
      const R = 6_371_000;
      const dLat = ((b.lat - a.lat) * Math.PI) / 180;
      const dLng = ((b.lng - a.lng) * Math.PI) / 180;
      const lat1 = (a.lat * Math.PI) / 180;
      const lat2 = (b.lat * Math.PI) / 180;
      const x =
        Math.sin(dLat / 2) ** 2 +
        Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
      return 2 * R * Math.asin(Math.sqrt(x));
    };
    const me = { lat: riderCoord.latitude, lng: riderCoord.longitude };
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < routeSteps.length; i++) {
      const step = routeSteps[i];
      const d = dist(me, { lat: step.endLat, lng: step.endLng });
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const cur = routeSteps[bestIdx];
    const distToEnd = dist(me, { lat: cur.endLat, lng: cur.endLng });
    return {
      ...cur,
      distanceRemainingM: Math.max(0, Math.round(distToEnd)),
    };
  }, [riderCoord, routeSteps]);

  // ── Empty / Loading states ──────────────────────────────────────────────────
  if (loading) return <View style={{ flex: 1 }}><MapSkeleton /></View>;

  if (!delivery) {
    return (
      <View style={{ flex: 1 }}>
        <MapSkeleton />
        <View style={[s.mapHeader, { paddingTop: insets.top + 8 }]}>
          <BackButton />
          <View style={s.headerRight}>
            <NotificationButton onPress={() => router.push("/(screens)/notification" as any)} />
            <ProfileButton onPress={() => router.push("/(rider)/(queue)/profile" as any)} size={36} />
          </View>
        </View>
        <View style={[s.emptyCard, { backgroundColor: theme.background, paddingBottom: tabBarClearance }]}>
          <View style={[s.emptyIcon, { backgroundColor: theme.tertiary }]}>
            <Ionicons name="navigate-circle-outline" size={40} color={theme.primary} />
          </View>
          <Text style={[s.emptyTitle, { color: theme.text }]}>No active delivery</Text>
          <Text style={[s.emptySub, { color: theme.icon }]}>
            Accept a delivery from the queue to start tracking here.
          </Text>
        </View>
      </View>
    );
  }

  // ── Derived values ──────────────────────────────────────────────────────────
  // Prefer delivery.station.location; fall back to order.station.location (populated separately)
  // Reject zero-coordinates (DB default for stations without real coords)
  const rawStationLoc = delivery.station.location ?? delivery.order.station?.location ?? null;
  const stationLoc = (rawStationLoc?.lat && rawStationLoc?.lng) ? rawStationLoc : null;
  const deliveryLat = delivery.order.deliveryAddress.latitude;
  const deliveryLng = delivery.order.deliveryAddress.longitude;
  // Reject 0/0 the same way the station check does — Address model
  // defaults both fields to 0, so a strict null check passes for
  // unpopulated addresses and renders a marker in the middle of the
  // ocean. Truthy check filters the default sentinel.
  const deliveryLoc =
    deliveryLat && deliveryLng
      ? { lat: deliveryLat, lng: deliveryLng }
      : null;

  // Only navigate to station (customer navigation is a future in-app feature)
  const stationNavTarget = stationLoc;

  // Per-phase label + colour. Granular v3 statuses get sharper
  // wording so the rider knows exactly what step they're on.
  const statusLabel =
    delivery.status === "accepted"
      ? "Head to Station"
      : delivery.status === "at_plant"
      ? "At Station · Awaiting Fill"
      : delivery.status === "refilling"
      ? "Filling Order"
      : delivery.status === "returning"
      ? "Heading to Customer"
      : delivery.status === "picked_up"
      ? "In Transit · Delivering"
      : delivery.status === "arrived"
      ? "At Customer's Gate"
      : delivery.status === "dispensing"
      ? "Dispensing Now"
      : delivery.status === "awaiting_confirmation"
      ? "Awaiting Confirmation"
      : "Active";

  const statusColor =
    delivery.status === "picked_up" || delivery.status === "returning"
      ? "#F97316"
      : delivery.status === "awaiting_confirmation" ||
        delivery.status === "arrived" ||
        delivery.status === "dispensing"
      ? "#10B981"
      : theme.primary;

  // Is this an LPG-Swap order? Drives the at_plant short-circuit
  // (swap goes at_plant → returning, skipping refilling) and the
  // arrived → finalise short-circuit (swap skips dispensing).
  const isSwap =
    delivery.order.fuel?.name?.toLowerCase().includes("gas") ||
    delivery.order.fuel?.name?.toLowerCase().includes("lpg") ||
    false;

  const initialRegion = stationLoc
    ? { latitude: stationLoc.lat, longitude: stationLoc.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : deliveryLoc
    ? { latitude: deliveryLoc.lat, longitude: deliveryLoc.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : undefined;

  // Rider halo — concentric pulse centered on the rider's GPS pin.
  // Two overlapping rings (offset by half a cycle) so the pulse
  // reads as continuous instead of flashing on/off. The Circle is
  // map-anchored at the SAME lat/lng as the pin's anchor, so the
  // halo always sits dead-centre on the motorbike glyph.
  const riderPulseRadiusM = 25 + 75 * riderPulseProgress;
  const riderPulseOpacity = 0.5 * (1 - riderPulseProgress);
  // Second ring, half-cycle out of phase so the user always sees
  // either an outgoing or fading ring at every frame.
  const offsetProgress = (riderPulseProgress + 0.5) % 1;
  const riderPulseRadiusM2 = 25 + 75 * offsetProgress;
  const riderPulseOpacity2 = 0.5 * (1 - offsetProgress);

  /**
   * Maneuver glyph — maps Google's `maneuver` codes to Ionicons names.
   * Falls back to a generic forward arrow when no maneuver is set
   * (most "continue straight" steps don't include one).
   */
  const maneuverIcon = (() => {
    const m = activeStep?.maneuver ?? "";
    if (m.includes("turn-sharp-left")) return "arrow-back" as const;
    if (m.includes("turn-left")) return "arrow-back-outline" as const;
    if (m.includes("turn-sharp-right")) return "arrow-forward" as const;
    if (m.includes("turn-right")) return "arrow-forward-outline" as const;
    if (m.includes("uturn")) return "return-up-back" as const;
    if (m.includes("roundabout")) return "sync" as const;
    if (m.includes("merge") || m.includes("ramp")) return "git-merge" as const;
    if (m.includes("fork")) return "git-branch" as const;
    return "arrow-up" as const;
  })();

  const customerInitials = (delivery.order.user.displayName ?? "C")
    .split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1 }}>
      {/* MAP */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider="google"
        initialRegion={initialRegion}
        // showsUserLocation off — we render our own marker so the
        // rider's screen matches the customer view exactly. The
        // native blue dot was visually close to the destination pin
        // colour and made the rider's own position easy to lose.
        showsMyLocationButton={false}
        showsPointsOfInterest={false}
        toolbarEnabled={false}
        // Drop the follow lock the moment the rider pans — they
        // probably want to scout ahead. Recenter FAB restores the
        // follow camera. Listening on onPanDrag (Android-only on
        // current react-native-maps) covers the most common case;
        // iOS riders fall back to tapping the FAB to re-engage.
        onPanDrag={() => {
          if (followRider) setFollowRider(false);
        }}
      >
        {/* Active leg polyline. Same source as the customer's
            screen (server pushes route:update to the shared
            delivery room), so the two views stay in lockstep
            without a separate rider Directions call. */}
        {routePolyline.length > 1 ? (
          <Polyline
            coordinates={routePolyline}
            strokeColor={theme.primary}
            strokeWidth={4}
          />
        ) : null}

        {/* Rider GPS halo — two concentric pulses 0.5 cycles apart so
            the user always sees a ring expanding around the pin. Both
            Circles use the same `center` as the rider Marker so they
            sit dead-centre on the motorbike glyph regardless of zoom. */}
        {riderCoord ? (
          <>
            <Circle
              center={riderCoord}
              radius={riderPulseRadiusM}
              strokeColor="transparent"
              strokeWidth={0}
              fillColor={`${theme.primary}${Math.round(riderPulseOpacity * 255)
                .toString(16)
                .padStart(2, "0")}`}
              zIndex={996}
            />
            <Circle
              center={riderCoord}
              radius={riderPulseRadiusM2}
              strokeColor="transparent"
              strokeWidth={0}
              fillColor={`${theme.primary}${Math.round(riderPulseOpacity2 * 255)
                .toString(16)
                .padStart(2, "0")}`}
              zIndex={995}
            />
          </>
        ) : null}

        {/* Three semantic pins. Each rendered conditionally so a
            missing coord (e.g. station populates after delivery
            object lands) doesn't crash the Marker tree. */}
        {stationLoc ? (
          <StationMapPin
            coordinate={{ latitude: stationLoc.lat, longitude: stationLoc.lng }}
          />
        ) : null}
        {deliveryLoc ? (
          <DestinationMapPin
            coordinate={{ latitude: deliveryLoc.lat, longitude: deliveryLoc.lng }}
          />
        ) : null}
        {riderCoord ? (
          // Key on the rounded coord (3dp ≈ 110m grid) so the marker
          // remounts when the rider crosses a tile — Android caches
          // markers aggressively and a static `Marker` won't redraw
          // when only the coordinate prop changes.
          <RiderMapPin
            key={`rider-${riderCoord.latitude.toFixed(3)}-${riderCoord.longitude.toFixed(3)}`}
            coordinate={riderCoord}
          />
        ) : null}
      </MapView>

      {/* FLOATING HEADER */}
      <View style={[s.mapHeader, { paddingTop: insets.top + 8 }]}>
        <BackButton />
        <View style={s.headerRight}>
          <NotificationButton onPress={() => router.push("/(screens)/notification" as any)} />
          <ProfileButton onPress={() => router.push("/(rider)/(queue)/profile" as any)} size={36} />
        </View>
      </View>

      {/* Maneuver banner — surfaces the next turn from the active
          step. Self-hides when there's no step (pre-route, or
          straight-line fallback). MVP nav: text + glyph only, no
          voice. Distance is rounded down to 10m for the "in 280m"
          line so it doesn't jitter every few meters. */}
      {activeStep ? (
        <View style={[s.maneuverBanner, { top: insets.top + 64 }]}>
          <View style={s.maneuverIconTile}>
            <Ionicons name={maneuverIcon} size={22} color="#fff" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.maneuverDistance}>
              In {Math.max(10, Math.round(activeStep.distanceRemainingM / 10) * 10)} m
            </Text>
            <Text style={s.maneuverInstruction} numberOfLines={2}>
              {activeStep.instruction}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Recenter FAB — appears only when follow is OFF (the rider
          panned). One tap restores follow + animates the camera back
          to their current GPS. */}
      {!followRider && riderCoord ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Recenter map on my location"
          onPress={() => {
            setFollowRider(true);
            mapRef.current?.animateCamera(
              { center: riderCoord, zoom: 16 },
              { duration: 400 }
            );
          }}
          style={[
            s.recenterFab,
            { bottom: tabBarClearance + 280 },
          ]}
        >
          <Ionicons name="locate" size={20} color={theme.primary} />
        </TouchableOpacity>
      ) : null}

      {/* Connection state strip — sits between the floating header
          and the bottom panel so it's visible without obscuring map
          interactions. Self-hides when status === "live". The
          pending-sync pill stacks below it for the rare case where
          the socket is live but the action queue has entries
          mid-flight (e.g. a transition fired while offline that
          hasn't drained yet). */}
      <View
        style={{
          position: "absolute",
          top: insets.top + 56,
          left: 0,
          right: 0,
          alignItems: "center",
          gap: 6,
        }}
        pointerEvents="box-none"
      >
        <SocketStrip />
        <PendingSyncPill onRetry={retryHeadOfQueue} />
      </View>

      {/* BOTTOM PANEL */}
      <View style={[s.bottomPanel, { backgroundColor: theme.background, paddingBottom: tabBarClearance }]}>

        {/* Status row — status badge, route ETA chip (when routed), station chip */}
        <View style={s.statusRow}>
          <View style={[s.statusBadge, { backgroundColor: statusColor + "20" }]}>
            <View style={[s.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[s.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          {/* Route ETA chip — Google-Directions duration for the leg
              the rider is currently on. Shown only after the route
              compute lands (rider has GPS + status maps to a leg).
              Drops the chip rather than showing "—" so the row
              doesn't look like a broken value. */}
          {routeMeta?.durationSeconds != null && routeMeta.durationSeconds > 0 ? (
            <View style={[s.stationChip, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
              <Ionicons name="time-outline" size={11} color={theme.icon} />
              <Text style={[s.stationChipText, { color: theme.icon }]} numberOfLines={1}>
                {Math.max(1, Math.round(routeMeta.durationSeconds / 60))} min
                {routeTarget === "station" ? " to station" : " to customer"}
              </Text>
            </View>
          ) : null}
          <View style={[s.stationChip, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
            <MaterialIcons name="local-gas-station" size={11} color={theme.icon} />
            <Text style={[s.stationChipText, { color: theme.icon }]} numberOfLines={1}>
              {delivery.station.name}
            </Text>
          </View>
        </View>

        {/* Customer card */}
        <View style={[s.customerCard, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
          <Avatar
            uri={delivery.order.user.profileImage}
            initials={customerInitials}
            size={48}
            radius={14}
          />
          <View style={s.customerInfo}>
            <Text style={[s.customerName, { color: theme.text }]}>
              {delivery.order.user.displayName}
            </Text>
            <Text style={[s.customerAddr, { color: theme.icon }]} numberOfLines={1}>
              {delivery.order.deliveryAddress.street}, {delivery.order.deliveryAddress.city}
            </Text>
            <View style={[s.fuelChip, { backgroundColor: theme.tertiary }]}>
              <Ionicons name="water-outline" size={11} color={theme.primary} />
              <Text style={[s.fuelText, { color: theme.text }]}>
                {delivery.order.quantity} {delivery.order.fuel.unit} · {delivery.order.fuel.name}
              </Text>
            </View>
          </View>
          {delivery.order.user.phone ? (
            <View style={s.contactBtns}>
              <TouchableOpacity
                style={[s.contactBtn, { backgroundColor: theme.tertiary }]}
                onPress={async () => {
                  if (!delivery.order.user._id) return;
                  try {
                    const res = await api.post<{
                      chat: { _id: string };
                    }>("/api/chats", {
                      peerUserId: delivery.order.user._id,
                      peerRole: "customer",
                      orderRef: delivery.order._id,
                    });
                    router.push({
                      pathname: "/(screens)/chat/[id]" as never,
                      params: { id: res.chat._id } as never,
                    });
                  } catch (err: any) {
                    toast.error(err?.message ?? "Couldn't open chat");
                  }
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="chatbubble-outline" size={15} color={theme.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.contactBtn, { backgroundColor: theme.primary }]}
                onPress={() => Linking.openURL(`tel:${delivery.order.user.phone}`)}
                activeOpacity={0.8}
              >
                <Ionicons name="call" size={15} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {/* Navigate to station — only shown when heading to pickup */}
        {delivery.status === "accepted" && stationNavTarget && (
          <TouchableOpacity
            style={[s.navBtn, { backgroundColor: theme.primary + "18", borderColor: theme.primary }]}
            onPress={() => {
              const url =
                Platform.OS === "ios"
                  ? `maps://?daddr=${stationNavTarget.lat},${stationNavTarget.lng}&dirflg=d`
                  : `google.navigation:q=${stationNavTarget.lat},${stationNavTarget.lng}`;
              Linking.openURL(url).catch(() => {
                Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${stationNavTarget.lat},${stationNavTarget.lng}`);
              });
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="navigate-outline" size={16} color={theme.primary} />
            <Text style={[s.navBtnText, { color: theme.primary }]}>Navigate to Station</Text>
          </TouchableOpacity>
        )}

        {/* No litres-dispensed tracker on the rider side — the
            customer ordered a fixed quantity, so there's nothing to
            tally up. The customer's Arrival screen plays a brief
            count-up animation when status flips to `dispensing`,
            which is enough feedback for both sides. */}

        {/* Action row — always 2 buttons. Left = Drop. Right CTA
            varies per phase along the granular ladder. */}
        <View style={s.actionRow}>
          <TouchableOpacity
            style={[s.actionSecondary, { borderColor: theme.error }]}
            onPress={() => setShowDropModal(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="close-circle-outline" size={16} color={theme.error} />
            <Text style={[s.actionSecondaryText, { color: theme.error }]}>Drop</Text>
          </TouchableOpacity>

          {/* Granular phase CTAs (v3). Each maps to one server endpoint. */}
          {delivery.status === "accepted" && (
            <TouchableOpacity
              style={[s.actionPrimary, { backgroundColor: theme.primary }]}
              onPress={handleAtPlant}
              disabled={transitioning}
              activeOpacity={0.85}
            >
              {transitioning ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="local-gas-station" size={18} color="#fff" />
                  <Text style={s.actionPrimaryText}>Mark at station</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {delivery.status === "at_plant" && (
            <TouchableOpacity
              style={[s.actionPrimary, { backgroundColor: theme.primary }]}
              onPress={isSwap ? handleHeadingBack : handleRefilling}
              disabled={transitioning}
              activeOpacity={0.85}
            >
              {transitioning ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons
                    name={isSwap ? "swap-horizontal" : "water"}
                    size={18}
                    color="#fff"
                  />
                  <Text style={s.actionPrimaryText}>
                    {isSwap ? "Cylinder swapped" : "Start refilling"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {delivery.status === "refilling" && (
            <TouchableOpacity
              style={[s.actionPrimary, { backgroundColor: "#F97316" }]}
              onPress={handleHeadingBack}
              disabled={transitioning}
              activeOpacity={0.85}
            >
              {transitioning ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                  <Text style={s.actionPrimaryText}>Heading back</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {delivery.status === "returning" && (
            <TouchableOpacity
              style={[s.actionPrimary, { backgroundColor: "#10B981" }]}
              onPress={handleArrived}
              disabled={transitioning}
              activeOpacity={0.85}
            >
              {transitioning ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="location" size={18} color="#fff" />
                  <Text style={s.actionPrimaryText}>I've arrived</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {delivery.status === "arrived" && (
            <TouchableOpacity
              style={[s.actionPrimary, { backgroundColor: "#10B981" }]}
              onPress={isSwap ? handleFinalise : handleDispensing}
              disabled={transitioning}
              activeOpacity={0.85}
            >
              {transitioning ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons
                    name={isSwap ? "checkmark-done" : "water"}
                    size={18}
                    color="#fff"
                  />
                  <Text style={s.actionPrimaryText}>
                    {isSwap ? "Cylinder handed over" : "Start dispensing"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {delivery.status === "dispensing" && (
            <TouchableOpacity
              style={[s.actionPrimary, { backgroundColor: "#10B981" }]}
              onPress={handleFinalise}
              disabled={transitioning}
              activeOpacity={0.85}
            >
              {transitioning ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="bag-check-outline" size={18} color="#fff" />
                  <Text style={s.actionPrimaryText}>Done · ask to confirm</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Legacy fallback — shown only if a delivery row is still
              in `picked_up` (created before the v3 rollout). The new
              ladder bypasses this state entirely. */}
          {delivery.status === "picked_up" && (
            <TouchableOpacity
              style={[s.actionPrimary, { backgroundColor: "#10B981" }]}
              onPress={handleComplete}
              disabled={deliverLoading}
              activeOpacity={0.85}
            >
              {deliverLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="bag-check-outline" size={18} color="#fff" />
                  <Text style={s.actionPrimaryText}>Deliver Order</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {delivery.status === "awaiting_confirmation" && (
            <View style={[s.actionPrimary, { backgroundColor: "#10B981" + "40" }]}>
              <Ionicons name="time-outline" size={16} color="#065F46" />
              <Text style={[s.actionPrimaryText, { color: "#065F46" }]}>
                Customer Confirming…
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Drop Order Modal */}
      <Modal
        visible={showDropModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDropModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: theme.background }]}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: theme.text }]}>Drop Order</Text>
              <TouchableOpacity onPress={() => { setShowDropModal(false); setDropReason(""); }} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={theme.icon} />
              </TouchableOpacity>
            </View>
            <Text style={[s.modalSub, { color: theme.icon }]}>
              Please provide a reason. The customer will be notified and a new rider will be dispatched.
            </Text>
            {["Fuel station closed", "Vehicle breakdown", "Safety concern", "Wrong address", "Unable to reach customer"].map((r) => (
              <TouchableOpacity
                key={r}
                style={[s.reasonChip, {
                  backgroundColor: dropReason === r ? theme.primary + "18" : theme.surface,
                  borderColor: dropReason === r ? theme.primary : theme.ash,
                }]}
                onPress={() => setDropReason(r)}
                activeOpacity={0.8}
              >
                <Text style={[s.reasonChipText, { color: dropReason === r ? theme.primary : theme.text }]}>{r}</Text>
              </TouchableOpacity>
            ))}
            <TextInput
              style={[s.reasonInput, { borderColor: theme.borderMid, backgroundColor: theme.surface, color: theme.text }]}
              placeholder="Or type your reason…"
              placeholderTextColor={theme.icon}
              value={dropReason}
              onChangeText={setDropReason}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[s.dropBtn, { backgroundColor: theme.error, opacity: !dropReason.trim() ? 0.5 : 1 }]}
              onPress={handleDropSubmit}
              disabled={dropping || !dropReason.trim()}
              activeOpacity={0.85}
            >
              {dropping ? <ActivityIndicator color="#fff" /> : <Text style={s.dropBtnText}>Confirm Drop</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = (theme: ReturnType<typeof import("@/constants/theme").useTheme>) =>
  StyleSheet.create({
    mapHeader: {
      position: "absolute", top: 0, left: 0, right: 0,
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 16, paddingBottom: 12,
    },
    headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },

    /** Maneuver banner — sits below the floating header, runs
     *  edge-to-edge with a 16px inset so it dominates the top of
     *  the map. Primary-tinted background so the rider sees it
     *  even at a glance. */
    maneuverBanner: {
      position: "absolute",
      left: 16,
      right: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 10,
      paddingLeft: 10,
      paddingRight: 14,
      borderRadius: 14,
      backgroundColor: theme.primary,
      ...theme.elevation.card,
    },
    maneuverIconTile: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: "rgba(255,255,255,0.18)",
      alignItems: "center",
      justifyContent: "center",
    },
    maneuverDistance: {
      fontSize: 11,
      fontWeight: "800",
      color: "rgba(255,255,255,0.85)",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    maneuverInstruction: {
      fontSize: 14,
      fontWeight: "800",
      color: "#fff",
      marginTop: 1,
    },

    /** Recenter FAB — fixed-size circular button. Sits above the
     *  bottom panel so it's reachable without obscuring the rider
     *  controls. */
    recenterFab: {
      position: "absolute",
      right: 16,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "#fff",
      alignItems: "center",
      justifyContent: "center",
      ...theme.elevation.card,
    },

    emptyCard: {
      position: "absolute", bottom: 0, left: 0, right: 0,
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      paddingHorizontal: 24, paddingTop: 24,
      alignItems: "center", gap: 10,
      shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.1, shadowRadius: 16, elevation: 16,
    },
    emptyIcon: { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center" },
    emptyTitle: { fontSize: 19, fontWeight: "500" },
    emptySub: { fontSize: 13, textAlign: "center", lineHeight: 19, maxWidth: 280 },

    pinWrapper: { alignItems: "center" },
    pinBubble: {
      width: 38, height: 38, borderRadius: 12,
      justifyContent: "center", alignItems: "center",
      shadowColor: "#000", shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.18, shadowRadius: 6, elevation: 6,
    },
    pinTail: {
      width: 0, height: 0,
      borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 7,
      borderLeftColor: "transparent", borderRightColor: "transparent",
      marginTop: -1,
    },

    bottomPanel: {
      position: "absolute", bottom: 0, left: 0, right: 0,
      paddingHorizontal: 16, paddingTop: 16,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.08, shadowRadius: 12, elevation: 12,
      gap: 10,
    },
    statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    statusDot: { width: 7, height: 7, borderRadius: 4 },
    statusText: { fontSize: 12, fontWeight: "600" },
    stationChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, maxWidth: 160 },
    stationChipText: { fontSize: 11 },

    customerCard: {
      flexDirection: "row", alignItems: "center", gap: 10,
      padding: 12, borderRadius: 16, borderWidth: 1,
    },
    customerInfo: { flex: 1, gap: 3 },
    customerName: { fontSize: 15, fontWeight: "600" },
    customerAddr: { fontSize: 12 },
    fuelChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: "flex-start" },
    fuelText: { fontSize: 11 },
    contactBtns: { flexDirection: "row", gap: 6 },
    contactBtn: { width: 34, height: 34, borderRadius: 17, justifyContent: "center", alignItems: "center" },

    navBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      paddingVertical: 11, borderRadius: 14, borderWidth: 1,
    },
    navBtnText: { fontSize: 14, fontWeight: "500" },

    actionRow: { flexDirection: "row", gap: 10 },
    actionSecondary: {
      flex: 1, height: 48, borderRadius: 12,
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
      borderWidth: 1.5, backgroundColor: "transparent",
    },
    actionSecondaryText: { fontSize: 13, fontWeight: "700" },
    actionPrimary: {
      flex: 2, height: 48, borderRadius: 12,
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    },
    actionPrimaryText: { color: "#fff", fontSize: 14, fontWeight: "700" },

    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, gap: 10 },
    modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#D1D5DB", alignSelf: "center", marginBottom: 8 },
    modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
    modalTitle: { fontSize: 18, fontWeight: "700" },
    modalSub: { fontSize: 13, lineHeight: 19, marginBottom: 4 },
    reasonChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
    reasonChipText: { fontSize: 13, fontWeight: "500" },
    reasonInput: { borderWidth: 1.5, borderRadius: 12, padding: 12, fontSize: 14, minHeight: 72, marginTop: 4 },
    dropBtn: { height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 8 },
    dropBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  });

/**
 * Pending-sync pill.
 *
 * Renders below the SocketStrip on the rider's Track screen when
 * the action queue has entries waiting to drain. Two states:
 *
 *   - "Syncing N…" — neutral pill, just informational. Queue is
 *     mid-flight; entries will land when the socket is healthy.
 *   - "Sync failed — Retry" — warning pill with a tap target. The
 *     head of the queue exhausted its retry budget; tapping
 *     `onRetry` resets attempts and kicks another drain.
 *
 * Self-hides when the queue is empty. Subscribes via
 * `subscribeActionQueue` so the count updates in real time.
 */
function PendingSyncPill({ onRetry }: { onRetry: () => Promise<void> }) {
  const theme = useTheme();
  const [entries, setEntries] = useState<QueuedAction[]>([]);

  useEffect(() => subscribeActionQueue(setEntries), []);

  if (entries.length === 0) return null;

  const head = entries[0];
  const halted = head.attempts >= 4; // matches MAX_ATTEMPTS in actionQueue.ts

  if (halted) {
    return (
      <TouchableOpacity
        onPress={() => onRetry().catch(() => {})}
        activeOpacity={0.85}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: theme.errorTint,
        }}
      >
        <Ionicons name="alert-circle" size={14} color={theme.error} />
        <Text style={{ fontSize: 11.5, fontWeight: "700", color: theme.error }}>
          Sync failed — tap to retry
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: theme.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.border,
      }}
    >
      <Ionicons name="sync" size={12} color={theme.icon} />
      <Text style={{ fontSize: 11.5, fontWeight: "700", color: theme.text }}>
        Syncing {entries.length}…
      </Text>
    </View>
  );
}
