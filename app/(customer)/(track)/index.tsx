import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Theme, useTheme } from "@/constants/theme";
import { useOrderStore } from "@/store/useOrderStore";
import { useActiveOrder } from "@/hooks/useActiveOrder";
import { getSocket, subscribeReconnect } from "@/lib/socket";
import { api } from "@/lib/api";
import {
  LiveBadge,
  MapMarkerRider,
  OfflineStrip,
} from "@/components/ui/primitives";
import SocketStrip from "@/components/ui/global/SocketStrip";
import {
  getStatusLabel,
  getTrackPhase,
  TrackPhase,
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

// `TrackPhase` + `getTrackPhase` live in utils/orderStatusLabels so
// every Track-adjacent screen reads from the same mapping. This file
// imports the helper rather than re-deriving it inline.

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
  /**
   * Locked station — populated by the server. Provides the pickup
   * coordinates we render the small green station pin from. The
   * design fades this pin out once the rider is on the way to the
   * customer (almost-there phase).
   */
  station?: {
    _id?: string;
    name?: string;
    shortName?: string;
    location?: { lat: number; lng: number };
  } | null;
}

// Polyline is pushed via the `route:update` socket event in Phase 3.
// This interval is a fallback safety net for cases where the socket
// drops between rider GPS pings — without it, a stuck polyline would
// stay until the next reconnect catch-up. 5 minutes is conservative
// because the customer also re-fetches whenever serverStatus or
// riderCoord changes (see the fetchRoute effect).
const ROUTE_REFETCH_MS = 5 * 60_000;

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

  /**
   * Server-side active-order check. The local `draft` may be empty
   * if the user opened Track via the tab from elsewhere or after an
   * app restart, so we never trust draft alone for the "do I have
   * an order in flight?" decision. This hook polls every 30s + on
   * mount, returns the most-recent active order so we can hydrate
   * the screen from the server.
   */
  const { activeOrder, loading: activeOrderLoading } = useActiveOrder();

  /**
   * Effective order id for everything below — local draft if present
   * (fastest, no network), otherwise the active-order hook. This
   * lets the screen function correctly when reached without a hot
   * draft state.
   */
  const effectiveOrderId = draft.orderId ?? activeOrder?._id ?? null;

  const [serverStatus, setServerStatus] = useState<string>("assigning");
  // Transient flag — true for 5s after the rider confirms "Heading
  // back" (status flips refilling → returning). Drives the at-pickup
  // body's progress loader so it ONLY runs during a real transition,
  // not the entire time the rider is at the station. Without this the
  // loader would crawl in idle limbo and feel dishonest.
  const [showRefillLoader, setShowRefillLoader] = useState(false);
  const prevServerStatusRef = useRef<string | null>(null);
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
  // Locked station coords + brand monogram. Populated from the order
  // document on initial fetch. Drives the small green station pin on
  // the map during the `assigned` + `in-transit` phases (per design).
  const [station, setStation] = useState<{
    coord: { latitude: number; longitude: number };
    brand: string;
  } | null>(null);
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

  /* ───────────────── Initial fetch + reconnect catch-up ─────────────────
   * Pull the order doc on mount so we have the rider profile + actual
   * server status before any socket events arrive. ALSO re-fetch on
   * every socket reconnect — events emitted while we were offline
   * are gone forever, so a single GET catches us up.
   *
   * The fetch is idempotent on the local state machine: it only
   * `setServerStatus` if the value changed, so re-fetching after
   * each reconnect doesn't cause cascading re-renders.
   */
  const refreshOrderState = useCallback(async () => {
    if (!effectiveOrderId) return;
    try {
      const order = await api.get<ServerOrder>(
        `/api/orders/${effectiveOrderId}`,
        { timeoutMs: 10_000 }
      );
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
          profileImage: r.profileImage,
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
      if (order.station?.location) {
        const source = order.station.shortName ?? order.station.name ?? "";
        const brand = source
          .replace(/[^A-Za-z0-9]/g, "")
          .slice(0, 2)
          .toUpperCase();
        setStation({
          coord: {
            latitude: order.station.location.lat,
            longitude: order.station.location.lng,
          },
          brand: brand || "FU",
        });
      }
    } catch {
      // Non-fatal — socket events will fill us in.
    }
  }, [effectiveOrderId, setRiderInStore]);

  // Initial fetch on mount + on any orderId change.
  useEffect(() => {
    refreshOrderState();
  }, [refreshOrderState]);

  // Reconnect catch-up — every time the socket comes back live after
  // a drop, re-fetch in case order:update events fired while we were
  // disconnected. The server's per-delivery room model relies on this:
  // once both sides drop and rejoin, neither has the events that
  // fired in between. The single GET papers over that gap.
  useEffect(() => {
    return subscribeReconnect(() => {
      refreshOrderState();
    });
  }, [refreshOrderState]);

  /* ───────────────── Socket subscriptions ───────────────── */
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !effectiveOrderId) return;
    const onUpdate = (data: {
      status?: string;
      eta?: number;
      rider?: RiderInfo;
      deliveredAt?: string;
      totalCharged?: number;
      pointsEarned?: number;
      weighIn?: { emptyKg: number; fullKg: number; netKg: number };
    }) => {
      if (data.status) {
        setServerStatus(data.status);
        // Server signalled the rider is no longer on this order
        // (dropped → confirmed, cancellation → cancelled). Clear the
        // local rider snapshot so the sheet stops showing a stale
        // rider card + stale GPS pin. The active-order hook will
        // re-poll on its 30s cadence and the screen will re-hydrate
        // if a new rider gets assigned.
        if (data.status === "confirmed" || data.status === "cancelled") {
          setRider(null);
          setRiderCoord(null);
        }
      }
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
    // Phase 3 — server emits route:update from /api/orders/:id/route
    // every time it computes a fresh polyline. Listening here means
    // we don't have to refetch on a timer; the polyline reflows in
    // real time as the rider moves.
    const onRouteUpdate = (data: {
      orderId?: string;
      polyline?: [number, number][];
      target?: "station" | "destination";
    }) => {
      if (!data.polyline) return;
      // Filter by orderId so we don't accept stale updates from a
      // prior delivery that lingered in our socket session.
      if (data.orderId && data.orderId !== effectiveOrderId) return;
      const points = data.polyline.map(([lat, lng]) => ({
        latitude: lat,
        longitude: lng,
      }));
      setRoutePolyline(points);
    };
    socket.on("order:update", onUpdate);
    socket.on("rider:location", onLocation);
    socket.on("route:update", onRouteUpdate);
    return () => {
      socket.off("order:update", onUpdate);
      socket.off("rider:location", onLocation);
      socket.off("route:update", onRouteUpdate);
    };
  }, [effectiveOrderId]);

  /**
   * "Heading back" loader trigger. When the rider confirms heading
   * back (server flips refilling → returning), flash the at-pickup
   * progress bar for 5 seconds before the body re-routes itself to
   * the in-transit RiderCard. Watching the prev/next pair instead
   * of just `serverStatus === "returning"` so the loader only runs
   * once per transition, not every render.
   */
  useEffect(() => {
    const prev = prevServerStatusRef.current;
    prevServerStatusRef.current = serverStatus;
    if (
      (prev === "refilling" || prev === "at_plant") &&
      serverStatus === "returning"
    ) {
      setShowRefillLoader(true);
      const t = setTimeout(() => setShowRefillLoader(false), 5000);
      return () => clearTimeout(t);
    }
    // Belt-and-braces: if the rider skipped straight past returning
    // (LPG-Swap shortcut), make sure the loader doesn't get stuck on.
    if (
      serverStatus !== "refilling" &&
      serverStatus !== "at_plant" &&
      serverStatus !== "returning"
    ) {
      setShowRefillLoader(false);
    }
  }, [serverStatus]);

  /**
   * Phase-driven routed polyline. Two distinct legs depending on
   * where the rider currently is in the flow:
   *   - assigned / at-pickup → rider→station (the leg they're
   *     currently driving). Server takes `target=station` to fetch
   *     the directions geometry to the order's locked station.
   *   - in-transit / almost-there → rider→destination (default).
   *   - pre-assignment → no polyline (no rider GPS yet).
   *
   * We pick the target based on the server status string rather
   * than `trackPhase` because the route fetch happens before
   * trackPhase is computed in render order. Mapping is identical
   * either way.
   */
  const routeTarget: "station" | "destination" | null = useMemo(() => {
    if (!riderCoord) return null;
    const s = serverStatus;
    if (
      s === "assigned" ||
      s === "at_plant" ||
      s === "refilling"
    ) {
      return "station";
    }
    if (
      s === "in-transit" ||
      s === "in_transit" ||
      s === "picked_up" ||
      s === "returning" ||
      s === "arrived" ||
      s === "dispensing"
    ) {
      return "destination";
    }
    return null;
  }, [serverStatus, riderCoord]);

  useEffect(() => {
    if (!effectiveOrderId || !riderCoord || !routeTarget) {
      setRoutePolyline([]);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const fetchRoute = async () => {
      try {
        const data = await api.get<RouteResponse>(
          `/api/orders/${effectiveOrderId}/route?riderLat=${riderCoord.latitude}&riderLng=${riderCoord.longitude}&target=${routeTarget}`,
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
  }, [
    effectiveOrderId,
    riderCoord?.latitude,
    riderCoord?.longitude,
    routeTarget,
  ]);

  // Auto hand-off to Arrival (liquid) or Handoff (LPG) when the
  // server signals the rider is on-site. Two trigger statuses:
  //   - `arrived` — v3 granular signal (rider app has upgraded)
  //   - `awaiting_confirmation` — legacy rider-app signal (rider tapped
  //     "Delivered" and the order is waiting on customer-confirm). The
  //     legacy app collapses arrived/dispensing into this one status,
  //     so without listening for it the customer screen would sit on
  //     Track forever and the user couldn't reach Arrival/Handoff.
  useEffect(() => {
    const isHandoffStatus =
      serverStatus === "arrived" ||
      serverStatus === "dispensing" ||
      serverStatus === "awaiting_confirmation";
    if (!isHandoffStatus) return;
    if (!effectiveOrderId) return;
    if (draft.product === "lpg") {
      router.replace("/(customer)/(track)/handoff" as never);
    } else {
      router.replace("/(customer)/(track)/arrival" as never);
    }
  }, [serverStatus, draft.product, effectiveOrderId, router]);

  const status = useMemo(
    () => getStatusLabel({ status: serverStatus, product: draft.product }),
    [serverStatus, draft.product]
  );

  // v3 sub-phase derivation. Centralised in utils/orderStatusLabels
  // so the same mapping is reused by any Track-adjacent surface
  // without drift. Folds legacy + v3 granular statuses transparently
  // — when the rider app upgrades, the customer's at-pickup +
  // arrived phases will start surfacing without changes here.
  const trackPhase: TrackPhase = useMemo(
    () =>
      getTrackPhase({
        status: serverStatus,
        hasRider: !!rider,
        etaMinutes: eta,
      }),
    [serverStatus, rider, eta]
  );

  /**
   * Manual hand-off escape hatch.
   *
   * The legacy rider app collapses arrived/dispensing into
   * `awaiting_confirmation`, which the auto-route effect handles —
   * but only AFTER the rider taps "Delivered" on their side. While
   * we wait on rider-app upgrades, the customer needs a way to step
   * into Arrival/Handoff themselves to exercise the full delivery
   * flow (dispense progress, weigh-in, confirm-delivery, rate, …).
   *
   * Behaviour:
   *   - Fires the customer-here ping (best-effort) so the rider
   *     gets the "customer at gate" socket event.
   *   - Routes locally to Arrival (liquid) or Handoff (LPG).
   *   - The server's order status doesn't change — that still
   *     requires the rider to tap Delivered. The customer just
   *     pre-staged into the next screen so they can drive
   *     confirm-delivery from there.
   */
  /**
   * Auto-snap the sheet on phase transitions so the user lands on
   * the most useful height per phase without manual dragging.
   *   pre-assignment → mid (45%) — sheet hero + matching skeleton
   *   assigned       → mid (45%) — RiderCard + ETA
   *   at-pickup      → mid (45%) — RiderCard + refilling progress
   *   in-transit     → mid (45%) — RiderCard + ETA
   *   almost-there   → peek (18%) — clears the screen for the
   *                    floating I'm-here CTA + the rider's
   *                    final approach on the map
   *
   * IMPORTANT: We skip the FIRST fire (mount). The BottomSheet
   * already mounts at `index={1}` (mid) by default; calling
   * `snapToIndex` from an effect that runs before the sheet has
   * been measured can race the internal animator and leave the
   * sheet stuck off-screen on first paint. After the first
   * trackPhase change we let the effect drive snapping normally.
   */
  const lastSnappedPhaseRef = useRef<string | null>(null);
  const hasMountedRef = useRef(false);
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      lastSnappedPhaseRef.current = trackPhase;
      return;
    }
    if (lastSnappedPhaseRef.current === trackPhase) return;
    lastSnappedPhaseRef.current = trackPhase;
    const targetIndex = trackPhase === "almost-there" ? 0 : 1;
    // Defer 250ms so any in-flight snap animation can settle before
    // we drive a new one. Without the wait, rapid phase flips
    // (e.g. assigning → assigned → in-transit on a fast network)
    // queue up snap requests and the sheet snaps to the wrong final
    // index.
    const t = setTimeout(() => {
      sheetRef.current?.snapToIndex(targetIndex);
    }, 250);
    return () => clearTimeout(t);
  }, [trackPhase]);

  /* ───────────────── Sheet state + handlers ───────────────── */

  /**
   * Tracks the sheet's current snap index so the top-overlay button
   * can toggle correctly between minimize and expand. Without this
   * the button always called `snapToIndex(0)` even when the sheet
   * was already at the smallest snap, which felt broken.
   *
   *   index === 0 → sheet at peek; button shows ↑ "Expand"
   *   index >= 1 → sheet at mid/full; button shows ↓ "Minimize"
   *
   * `onChange` fires for both user drags AND programmatic snaps,
   * so the icon stays in sync regardless of how the sheet moved.
   */
  // Re-sync the auto-snap memo if the user drags the sheet manually,
  // so the phase-driven snap effect doesn't fight them.
  const handleSheetChange = useCallback(() => {
    lastSnappedPhaseRef.current = trackPhase;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * "Details" footer tap on the tracking sheet — routes to the
   * order detail screen so the user can see the full receipt,
   * timeline, and rider card. Stable callback so it doesn't get
   * recreated each render (gorhom's gesture handler can otherwise
   * mis-fire on the touch and snap the sheet up instead of
   * letting the press through). Falls back to the order history
   * list if we don't yet have an orderId on the draft (rare —
   * pre-assignment sometimes hasn't persisted the id locally).
   */
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

  /**
   * Stable snap-point array. gorhom/bottom-sheet v5 compares this
   * by reference internally — recreating it on every render
   * resets the sheet's animated state and (on Android) can leave
   * it visually missing despite being mounted.
   */
  const snapPoints = useMemo<(string | number)[]>(
    () => ["18%", "45%", "85%"],
    []
  );

  /**
   * "No active order" is no longer a full-screen replacement for the
   * Track surface. The map + bottom sheet stay mounted; the sheet's
   * body switches to an empty state with a "Place an order" CTA. This
   * matches the rest of the app where the canonical chrome (map +
   * sheet) is always present and only the contents shift per state —
   * so users always have a familiar surface to land on.
   *
   * Source-of-truth precedence:
   *   1. Local draft (hot state from a just-placed order)
   *   2. `useActiveOrder` poll (server-side check, covers restart /
   *      deep-link / tab switch from elsewhere)
   *   3. While the server check is in flight on first mount, we
   *      treat the screen as "active" so we don't flash the empty
   *      state if the user actually does have an order. The hook
   *      flips loading=false within ~1 round-trip.
   */
  const hasActiveOrder =
    !!draft.orderId ||
    !!draft.station ||
    !!activeOrder ||
    activeOrderLoading;

  // Real-road polyline only — no straight-line fallback. Drawing
  // [rider, destination] regardless of phase would be misleading
  // during assigned/at-pickup when the rider's actual leg is to the
  // station, not the destination. Skip rendering until the phase-aware
  // Directions API call returns.
  const polylineCoords = routePolyline.length > 1 ? routePolyline : [];

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
        {/* Live phase-driven polyline. Drawn ONLY when we have a
            real-road polyline back from the Directions API for the
            CURRENT leg the rider is on (rider→station while
            assigned/at-pickup, rider→destination while in-transit
            and onwards). The dashed station→destination "guide" was
            removed per UX direction — the customer should only see
            the leg the rider is actively driving, not a fuller
            map guide. No polyline appears during pre-assignment
            (no rider GPS yet) or during the at-pickup pause. */}
        {polylineCoords.length > 1 ? (
          <Polyline
            coordinates={polylineCoords}
            strokeColor={theme.primary}
            strokeWidth={4}
          />
        ) : null}
        {riderCoord ? <MapMarkerRider coordinate={riderCoord} pulse /> : null}
        {/* Station pickup pin — small green circle with the station's
            brand monogram. Renders during assigned + in-transit;
            fades out on almost-there per design. */}
        {station &&
        trackPhase !== "almost-there" &&
        trackPhase !== "pre-assignment" ? (
          <Marker coordinate={station.coord} tracksViewChanges={false}>
            <View style={styles.stationPin}>
              <Text style={styles.stationPinText}>{station.brand}</Text>
            </View>
          </Marker>
        ) : null}
        <Marker coordinate={destinationCoord}>
          <View style={styles.destPin}>
            <Ionicons name="location" size={22} color={theme.primary} />
          </View>
        </Marker>
      </MapView>

      {/* Connection strips — NetInfo first (no internet), then
          SocketStrip (internet but socket unhealthy). They surface
          different failure modes; usually only one fires at a time
          but both are valid signals to the user. */}
      <View
        style={[styles.offlineWrap, { top: insets.top + 8 }]}
        pointerEvents="box-none"
      >
        <OfflineStrip />
        <SocketStrip />
      </View>

      {/* Top overlay — back, live badge, recenter. The back button
          is the user's only way OUT of the Track screen now that the
          tab bar is hidden everywhere in the (track) group. Routes
          to Home rather than `router.back()` because the customer
          could have arrived here from any tab and we want a stable
          escape path that always lands somewhere sensible. */}
      <View style={[styles.topOverlay, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.replace("/(customer)/(home)" as never)}
          accessibilityRole="button"
          accessibilityLabel="Back to home"
          accessibilityHint="Leaves the tracking screen. Your order keeps running in the background."
          style={({ pressed }) => [
            styles.roundBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color={theme.fg}
          />
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
        onChange={handleSheetChange}
        enablePanDownToClose={false}
        // Keep the sheet visible whenever the screen is mounted —
        // the design assumes it's always present, just at varying
        // heights. enableDynamicSizing must stay off so our explicit
        // snap points control the height (gorhom v5 default flips
        // to dynamic-sized which renders the sheet at its content
        // height and IGNORES `index`/`snapPoints` — the most common
        // cause of "the sheet is missing" reports in v5).
        enableDynamicSizing={false}
        backgroundStyle={{
          backgroundColor: theme.surfaceElevated,
          borderTopLeftRadius: theme.radius.xl,
          borderTopRightRadius: theme.radius.xl,
        }}
        handleIndicatorStyle={{
          backgroundColor: theme.borderStrong,
        }}
      >
        {/* `BottomSheetView` (not a plain View) is what the
            gesture-handler driver expects as the immediate child.
            Plain View works on iOS but on Android v5 the sheet's
            internal scroll & drag detection breaks, often leaving
            the sheet rendered off-screen until the user manually
            drags it up. */}
        <BottomSheetView style={styles.sheetContent}>
          <TrackingSheetContent
            mode={hasActiveOrder ? "active" : "empty"}
            status={status}
            trackPhase={trackPhase}
            orderId={effectiveOrderId ?? "—"}
            etaMinutes={eta}
            qty={draft.qty ?? 0}
            unit={draft.unit ?? "L"}
            fuelLabel={draft.fuelTypeId ?? ""}
            stationName={
              draft.station?.shortName ??
              draft.station?.name
            }
            totalNaira={(draft.station?.totalKobo ?? 0) / 100}
            unitPriceNaira={
              draft.station?.perUnitKobo != null
                ? draft.station.perUnitKobo / 100
                : undefined
            }
            addressLabel={draft.deliveryLabel}
            rider={rider}
            onCall={handleCall}
            onChat={handleChat}
            showRefillLoader={showRefillLoader}
            onPlaceOrderPress={() =>
              router.push("/(customer)/(home)" as never)
            }
          />
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1 },
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
    /**
     * Pickup station pin — small green circle with brand letters.
     * Matches the design's NN/TE/MO style monogram-on-green pin.
     * Sized smaller than the destination pin so the pickup reads
     * as "starting point" while the customer's address gets the
     * visual weight.
     */
    stationPin: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.primary,
      borderWidth: 2,
      borderColor: "#fff",
      alignItems: "center",
      justifyContent: "center",
      ...theme.elevation.card,
    },
    stationPinText: {
      fontSize: 10,
      fontWeight: "800",
      color: "#fff",
      ...theme.type.money,
    },
    sheetContent: {
      paddingHorizontal: theme.space.s4,
      paddingTop: theme.space.s2,
    },

  });
