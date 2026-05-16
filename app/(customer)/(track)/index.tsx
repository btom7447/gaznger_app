import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { toast } from "sonner-native";
import MapView, { Circle, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Theme, useTheme } from "@/constants/theme";
import { useOrderStore } from "@/store/useOrderStore";
import { useActiveOrder } from "@/hooks/useActiveOrder";
import { getSocket, subscribeReconnect, useSocketStatus } from "@/lib/socket";
import { api } from "@/lib/api";
import {
  LiveBadge,
  OfflineStrip,
} from "@/components/ui/primitives";
import {
  DestinationMapPin,
  RiderMapPin,
  StationMapPin,
} from "@/components/ui/customer/track/MapPins";
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
  /** Populated delivery address — read for the destination map pin.
   *  `icon` is the Ionicon glyph the user picked when saving this
   *  address (home-outline / briefcase-outline / etc.); we surface
   *  it so the destination pin matches the address-book row. */
  deliveryAddress?: {
    latitude?: number;
    longitude?: number;
    icon?: string;
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
  const resetOrder = useOrderStore((s) => s.resetOrder);

  // Socket status — used as a re-bind trigger for the socket
  // subscription effect below. Critical: getSocket() returns null
  // until the socket connects, so without this dep the effect runs
  // once with a null socket on first mount, bails, and never re-runs.
  // That was the root cause of "events aren't arriving" — every
  // screen with a socket listener missed its first attach.
  const socketStatus = useSocketStatus();

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
  // Per-leg distance + duration mirrored from the server. Drives the
  // route ETA chip (e.g. "8 min to station") so the customer sees a
  // truthful, route-aware estimate instead of the older minute-based
  // server `eta` which was a coarse haversine guess.
  const [routeMeta, setRouteMeta] = useState<{
    distanceMeters?: number;
    durationSeconds?: number;
  } | null>(null);
  // Continuous halo around the rider's pin — same machinery as the
  // Stations destination pulse. Map-native Circle so the bitmap stays
  // sharp at every zoom level (no react-native-maps tracksViewChanges
  // bitmap blur).
  const riderPulseRef = useRef(new Animated.Value(0));
  const [riderPulseProgress, setRiderPulseProgress] = useState(0);
  // Server-provided delivery coords (populated by refreshOrderState
  // from the order doc's deliveryAddress). Falls back to the local
  // draft's deliveryCoords when reaching Track from a hot order
  // flow. Without this, customers reaching Track via the tab after
  // an app restart see a default Lagos pin instead of their actual
  // delivery address.
  const [serverDeliveryCoord, setServerDeliveryCoord] = useState<
    { latitude: number; longitude: number } | null
  >(null);
  // Destination pin glyph from the populated Address doc. Stored
  // separately from coords because the server populate may return an
  // address with an icon but a missing lat/lng (legacy rows), and
  // vice-versa.
  const [serverDeliveryIcon, setServerDeliveryIcon] = useState<string | null>(
    null
  );
  const mapRef = useRef<MapView>(null);
  const sheetRef = useRef<BottomSheet>(null);

  const destinationCoord = useMemo(() => {
    if (serverDeliveryCoord) return serverDeliveryCoord;
    if (draft.deliveryCoords?.lat && draft.deliveryCoords?.lng) {
      return {
        latitude: draft.deliveryCoords.lat,
        longitude: draft.deliveryCoords.lng,
      };
    }
    // Last-resort fallback (Lagos) — only hit when the user reached
    // Track without a hot draft AND the server fetch hasn't returned
    // yet. The map will re-center as soon as the data lands.
    return { latitude: 6.5244, longitude: 3.3792 };
  }, [serverDeliveryCoord, draft.deliveryCoords]);

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
  const refreshOrderState = useCallback(async (overrideOrderId?: string) => {
    const oid = overrideOrderId ?? effectiveOrderId;
    if (!oid) return;
    try {
      const order = await api.get<ServerOrder>(
        `/api/orders/${oid}`,
        { timeoutMs: 10_000 }
      );
      if (order.status) setServerStatus(order.status);
      if (typeof order.eta === "number") setEta(order.eta);
      if (order.riderId) {
        const r = order.riderId;
        const display = r.displayName ?? "Your rider";
        const [first, ...rest] = display.split(/\s+/);
        const riderInfo: RiderInfo = {
          _id: r._id,
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
      // Populate the delivery destination from the server when
      // available — covers the "user reached Track via tab without
      // a hot draft" case.
      if (
        order.deliveryAddress?.latitude &&
        order.deliveryAddress?.longitude
      ) {
        setServerDeliveryCoord({
          latitude: order.deliveryAddress.latitude,
          longitude: order.deliveryAddress.longitude,
        });
      }
      if (order.deliveryAddress?.icon) {
        setServerDeliveryIcon(order.deliveryAddress.icon);
      }
    } catch {
      // Non-fatal — socket events will fill us in.
    }
  }, [effectiveOrderId, setRiderInStore]);

  // Initial fetch on mount + on any orderId change.
  useEffect(() => {
    refreshOrderState();
  }, [refreshOrderState]);

  // Rider GPS halo loop — listens to the Animated.Value and mirrors
  // each tick into state so the non-Animated `Circle` re-renders.
  // Same shape used on the Stations destination halo.
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

  // 4-second poll while the order is active — guarantees the screen
  // catches up even when socket events are missed (navigation drops,
  // Expo Go bridge suspensions, reconnect race). Stops once the order
  // reaches a terminal status (delivered/cancelled) or the component
  // unmounts. Socket events remain the primary path; this is the net.
  useEffect(() => {
    if (!effectiveOrderId) return;
    const TERMINAL = ["delivered", "rated", "closed"];
    if (TERMINAL.includes(serverStatus) || serverStatus.startsWith("cancelled")) return;
    const id = setInterval(() => refreshOrderStateRef.current(), 4000);
    return () => clearInterval(id);
  }, [effectiveOrderId, serverStatus]);

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

  // Keep a ref to the latest effectiveOrderId so socket handlers can
  // filter without being in the effect dep array — avoids unbind/rebind
  // on every orderId change while still rejecting cross-order events.
  const effectiveOrderIdRef = useRef<string | null>(null);
  useEffect(() => {
    effectiveOrderIdRef.current = effectiveOrderId;
  }, [effectiveOrderId]);

  // Stable ref to refreshOrderState so socket handlers can call it
  // without being in the effect dep array (avoids unbind/rebind on
  // every effectiveOrderId change while keeping the call fresh).
  const refreshOrderStateRef = useRef(refreshOrderState);
  useEffect(() => {
    refreshOrderStateRef.current = refreshOrderState;
  }, [refreshOrderState]);


  /* ───────────────── Socket subscriptions ───────────────── */
  useEffect(() => {
    const socket = getSocket();
    // Bind as soon as the socket exists — don't gate on effectiveOrderId
    // here. The handlers filter by orderId via ref so events that arrive
    // before useActiveOrder resolves are NOT missed. Previously this bail
    // caused a blind window on screens opened before the active-order
    // fetch returned.
    if (!socket) return;
    const onUpdate = (data: {
      orderId?: string;
      status?: string;
      eta?: number;
      rider?: RiderInfo;
      deliveredAt?: string;
      totalCharged?: number;
      pointsEarned?: number;
      weighIn?: { emptyKg: number; fullKg: number; netKg: number };
    }) => {
      // Filter: ignore events for other orders once we know our id.
      const oid = effectiveOrderIdRef.current;
      if (oid && data.orderId && String(data.orderId) !== oid) return;
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
      // Granular status events don't carry RiderInfo — refetch the order
      // doc to hydrate rider when we know a rider must exist but don't
      // have one locally yet. Pass orderId from the event payload so the
      // fetch works even before effectiveOrderId lands in the closure.
      const riderRequiredStatuses = [
        "assigned", "at_plant", "refilling", "returning",
        "arrived", "dispensing", "awaiting_confirmation",
        "in-transit", "in_transit", "picked_up",
      ];
      if (data.status && riderRequiredStatuses.includes(data.status) && !data.rider) {
        refreshOrderStateRef.current(data.orderId ?? effectiveOrderIdRef.current ?? undefined);
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
      distanceM?: number;
      durationS?: number;
    }) => {
      if (!data.polyline) return;
      // Filter by orderId via ref — same pattern as onUpdate above.
      const oid = effectiveOrderIdRef.current;
      if (oid && data.orderId && data.orderId !== oid) return;
      const points = data.polyline.map(([lat, lng]) => ({
        latitude: lat,
        longitude: lng,
      }));
      setRoutePolyline(points);
      setRouteMeta({
        distanceMeters: data.distanceM,
        durationSeconds: data.durationS,
      });
    };
    socket.on("order:update", onUpdate);
    socket.on("rider:location", onLocation);
    socket.on("route:update", onRouteUpdate);
    return () => {
      socket.off("order:update", onUpdate);
      socket.off("rider:location", onLocation);
      socket.off("route:update", onRouteUpdate);
    };
    // socketStatus is a re-bind trigger — when the socket flips from
    // disconnected → live, this effect re-runs and attaches listeners
    // to the freshly-connected socket instance. Without it, screens
    // mounted before the socket connects never bind their listeners.
    // effectiveOrderId removed from deps — filtering now via ref.
  }, [socketStatus, setRiderInStore, setDeliveryConfirmation, setWeighIn]);

  /**
   * Refill loader trigger — fires only on * → returning (rider tapped
   * "Heading back to customer"). The bar plays for 5s while the phase
   * is still "at-pickup", giving the customer a "filling done, on the
   * way" moment before the status flips to in-transit.
   */
  useEffect(() => {
    const prev = prevServerStatusRef.current;
    prevServerStatusRef.current = serverStatus;

    if (serverStatus === "returning" && prev !== "returning" && prev !== null) {
      setShowRefillLoader(true);
      const t = setTimeout(() => setShowRefillLoader(false), 5000);
      return () => clearTimeout(t);
    }

    // Clear if the status jumped past at-pickup without going through
    // returning (e.g. poll skipped a step) so the bar never stays stuck.
    if (
      serverStatus !== "at_plant" &&
      serverStatus !== "refilling" &&
      serverStatus !== "returning"
    ) {
      setShowRefillLoader(false);
    }
  }, [serverStatus]);

  // When order reaches a terminal status, clear the persisted draft so
  // `hasActiveOrder` flips to false and the sheet shows the empty state
  // instead of the stale rider card. Must run AFTER navigation effects
  // (arrived/dispensing route to Arrival) so we don't wipe the draft
  // before those screens read it.
  useEffect(() => {
    const isTerminal =
      serverStatus === "delivered" ||
      serverStatus === "rated" ||
      serverStatus === "closed" ||
      serverStatus.startsWith("cancelled");
    if (isTerminal) resetOrder();
  }, [serverStatus, resetOrder]);

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
        // SECURITY (audit A.9): customer no longer passes rider coords.
        // Server resolves the rider's last-known GPS from RiderProfile
        // server-side. Passing client-supplied coords was a Directions
        // API spend vector. The route:update socket push still arrives
        // independently of this fetch; this is just the cold-start
        // pull on phase change.
        const data = await api.get<RouteResponse>(
          `/api/orders/${effectiveOrderId}/route?target=${routeTarget}`,
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
    // Defer the navigation by ~350ms so a mid-drag bottom-sheet pan
    // gesture has time to settle before the screen swap (audit G.3).
    // Without this, the user's drag is cancelled mid-flight, the
    // sheet snaps to a random position, and the next screen
    // re-mounts with a confusing layout glitch.
    const t = setTimeout(() => {
      if (draft.product === "lpg") {
        router.replace("/(customer)/(track)/handoff" as never);
      } else {
        router.replace("/(customer)/(track)/arrival" as never);
      }
    }, 350);
    return () => clearTimeout(t);
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
  // Display ETA prefers the route-derived duration (real driving time
  // from Google Directions) over the server's coarse eta field, which
  // is haversine-based and doesn't account for roads/traffic. Round
  // up to the nearest minute so we never show "0 min" while there's
  // still distance left. Falls back to the legacy `eta` when route
  // data isn't loaded yet.
  const displayEta = useMemo(() => {
    if (routeMeta?.durationSeconds != null && routeMeta.durationSeconds > 0) {
      return Math.max(1, Math.round(routeMeta.durationSeconds / 60));
    }
    return eta;
  }, [routeMeta?.durationSeconds, eta]);

  const trackPhase: TrackPhase = useMemo(
    () =>
      getTrackPhase({
        status: serverStatus,
        hasRider: !!rider,
        etaMinutes: displayEta,
      }),
    [serverStatus, rider, displayEta]
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
    // fitToCoordinates encloses everything visible (rider + station +
    // destination) so long-distance orders don't land off-screen on
    // re-center. Same call as the initial-fit effect below; manual
    // re-center reuses it.
    const coords: { latitude: number; longitude: number }[] = [];
    if (riderCoord) coords.push(riderCoord);
    if (station?.coord) coords.push(station.coord);
    coords.push(destinationCoord);
    if (coords.length >= 2) {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 120, bottom: 380, left: 60, right: 60 },
        animated: true,
      });
    } else {
      mapRef.current?.animateToRegion(
        {
          ...destinationCoord,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        },
        320
      );
    }
  }, [riderCoord, destinationCoord, station]);

  /**
   * Initial fit — fires once when the rider's first GPS lands AND we
   * have a destination + (optionally) a station. The fixed
   * `latitudeDelta: 0.04` initialRegion below was ~4 km, which on a
   * long-distance order put one of the pins off-screen on first
   * paint. fitToCoordinates encloses everything correctly. Audit D.5.
   */
  const initialFitDoneRef = useRef(false);
  useEffect(() => {
    if (initialFitDoneRef.current) return;
    if (!riderCoord) return; // wait for first GPS
    const coords: { latitude: number; longitude: number }[] = [riderCoord];
    if (station?.coord) coords.push(station.coord);
    coords.push(destinationCoord);
    // Defer one frame — the MapView's bounds aren't laid out until
    // after first render, and fitToCoordinates is a no-op against a
    // 0×0 map.
    const t = setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 120, bottom: 380, left: 60, right: 60 },
        animated: true,
      });
      initialFitDoneRef.current = true;
    }, 250);
    return () => clearTimeout(t);
  }, [riderCoord, destinationCoord, station]);

  const handleCall = useCallback(() => {
    if (rider?.phone) Linking.openURL(`tel:${rider.phone}`);
  }, [rider?.phone]);

  const handleChat = useCallback(async () => {
    if (!rider?._id) return;
    try {
      const res = await api.post<{ chat: { _id: string } }>(
        "/api/chats",
        {
          peerUserId: rider._id,
          peerRole: "rider",
          orderRef: effectiveOrderId,
        },
      );
      router.push({
        pathname: "/(screens)/chat/[id]" as never,
        params: { id: res.chat._id } as never,
      });
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't open chat");
    }
  }, [rider?._id, effectiveOrderId, router]);

  /**
   * Stable snap-point array. gorhom/bottom-sheet v5 compares this
   * by reference internally — recreating it on every render
   * resets the sheet's animated state and (on Android) can leave
   * it visually missing despite being mounted.
   */
  // Peek snap bumped to 22% on phones shorter than ~720dp (audit
  // G.5). At 18% on a Pixel 4a / iPhone SE the peek strip is < 130px
  // and the FloatingCTA overlay clipped the sheet's drag handle. 22%
  // gives the handle clearance without losing the "tiny peek"
  // affordance on bigger screens.
  const { height: windowHeight } = useWindowDimensions();
  const snapPoints = useMemo<(string | number)[]>(() => {
    const peek = windowHeight < 720 ? "22%" : "18%";
    return [peek, "45%", "85%"];
  }, [windowHeight]);

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

  // Rider halo geometry — same numbers as the rider screen so the
  // pulse reads identically on both sides. Two concentric rings 0.5
  // cycles apart for a continuous "alive" feel; both centred on the
  // rider's pin coord so they sit dead-centre on the motorbike glyph.
  const riderPulseRadiusM = 25 + 75 * riderPulseProgress;
  const riderPulseOpacity = 0.5 * (1 - riderPulseProgress);
  const offsetProgress = (riderPulseProgress + 0.5) % 1;
  const riderPulseRadiusM2 = 25 + 75 * offsetProgress;
  const riderPulseOpacity2 = 0.5 * (1 - offsetProgress);

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
        {/* Rider GPS halo — two concentric pulses 0.5 cycles apart so
            the user always sees a ring expanding around the pin. Both
            Circles share the rider's coord with the Marker, so the
            halo sits dead-centre on the motorbike glyph at all zooms. */}
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

        {/* Station pin — fades during almost-there + pre-assignment
            per the design (focus shifts to rider→customer leg). */}
        {station &&
        trackPhase !== "almost-there" &&
        trackPhase !== "pre-assignment" ? (
          <StationMapPin coordinate={station.coord} />
        ) : null}

        {/* Destination — uses the saved address's icon glyph so the
            customer recognises which of their addresses it is.
            Source priority: server-populated Address.icon (covers the
            "fresh app open, no hot draft" case) → in-flight draft
            value (covers reaching Track from a hot order flow) →
            generic location-sharp fallback handled by the pin. */}
        <DestinationMapPin
          coordinate={destinationCoord}
          iconName={serverDeliveryIcon ?? draft.deliveryIcon}
        />

        {/* Rider — keyed on rounded coords so Android's marker cache
            picks up position changes (a static `Marker`'s bitmap
            doesn't update when the coord prop alone shifts). */}
        {riderCoord ? (
          <RiderMapPin
            key={`rider-${riderCoord.latitude.toFixed(3)}-${riderCoord.longitude.toFixed(3)}`}
            coordinate={riderCoord}
          />
        ) : null}
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
          hitSlop={8}
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
          accessibilityHint="Brings the rider's position back into view"
          hitSlop={8}
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
            etaMinutes={displayEta}
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
    sheetContent: {
      paddingHorizontal: theme.space.s4,
      paddingTop: theme.space.s2,
    },

  });
