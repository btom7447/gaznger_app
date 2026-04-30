import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import {
  getSocket,
  subscribeReconnect,
  useSocketStatus,
  type SocketStatus,
} from "@/lib/socket";
import type { OrderUpdatePayload } from "@/_shared/socketEvents";

/**
 * Phase 7 — single source of truth for "what's the current state of
 * order :id?" Used by Track / Arrival / Handoff / Delivered / Complete
 * so the five screens don't each maintain their own copy of
 * serverStatus + eta + rider + deliveredAt + totalCharged.
 *
 * Lifecycle on mount:
 *   1. Snap to cached value if present (no flash on remount).
 *   2. Fire one GET /api/orders/:id if cache is empty or stale (>30s).
 *   3. Subscribe to order:update for real-time patches.
 *   4. Subscribe to rider:location for the GPS pin.
 *   5. Register a reconnect listener that re-fetches on socket
 *      reconnect after a drop.
 *
 * Cleanup on unmount: unsubscribes from socket events but leaves the
 * cache in place so the next mount can snap-render. Cache invalidates
 * automatically when the orderId changes.
 *
 * Why a hook and not a zustand slice: zustand's global store is
 * great for cross-screen shared state (auth session, wallet) but
 * overkill here — the order state is screen-scoped (only screens
 * inside the (track) flow read it) and the lifecycle is naturally
 * tied to a component mount.
 */

export interface OrderStateSnapshot {
  orderId: string;
  status: string;
  eta: number | null;
  rider: OrderUpdatePayload["rider"] | null;
  riderCoord: { latitude: number; longitude: number } | null;
  deliveredAt?: string;
  totalCharged?: number;
  pointsEarned?: number;
  /** Money fields populated from the GET /api/orders/:id response. */
  fuelCost?: number;
  deliveryFee?: number;
  totalPrice?: number;
  /** True after the first GET has resolved at least once. */
  hydrated: boolean;
}

interface CacheEntry {
  snapshot: OrderStateSnapshot;
  fetchedAt: number;
}

const STALE_MS = 30_000;

// Module-level cache so the snapshot survives a quick unmount/remount
// (e.g. tab switch + back). Keyed by orderId.
const cache = new Map<string, CacheEntry>();

interface ServerOrderResponse {
  _id: string;
  status: string;
  eta?: number;
  fuelCost?: number;
  deliveryFee?: number;
  totalPrice?: number;
  riderId?: {
    _id: string;
    displayName?: string;
    phone?: string;
    profileImage?: string;
  } | null;
  riderProfile?: { plate?: string; rating?: number } | null;
  deliveredAt?: string;
  totalCharged?: number;
  pointsEarned?: number;
}

function snapshotFromServer(
  orderId: string,
  o: ServerOrderResponse,
  prior: OrderStateSnapshot | null
): OrderStateSnapshot {
  const display = o.riderId?.displayName ?? "";
  const [first, ...rest] = display.split(/\s+/);
  const rider: OrderStateSnapshot["rider"] = o.riderId
    ? {
        firstName: first || "Rider",
        lastName: rest.join(" "),
        plate: o.riderProfile?.plate,
        rating: o.riderProfile?.rating,
        phone: o.riderId.phone,
        profileImage: o.riderId.profileImage,
        initials: display
          .split(/\s+/)
          .filter(Boolean)
          .map((p) => p.charAt(0))
          .join("")
          .slice(0, 2)
          .toUpperCase(),
      }
    : null;
  return {
    orderId,
    status: o.status,
    eta: typeof o.eta === "number" ? o.eta : prior?.eta ?? null,
    rider: rider ?? prior?.rider ?? null,
    riderCoord: prior?.riderCoord ?? null, // GPS only comes from socket
    deliveredAt: o.deliveredAt ?? prior?.deliveredAt,
    totalCharged: o.totalCharged ?? prior?.totalCharged,
    pointsEarned: o.pointsEarned ?? prior?.pointsEarned,
    fuelCost: o.fuelCost ?? prior?.fuelCost,
    deliveryFee: o.deliveryFee ?? prior?.deliveryFee,
    totalPrice: o.totalPrice ?? prior?.totalPrice,
    hydrated: true,
  };
}

export function useOrderState(orderId: string | null) {
  const [snapshot, setSnapshot] = useState<OrderStateSnapshot | null>(() => {
    if (!orderId) return null;
    return cache.get(orderId)?.snapshot ?? null;
  });
  const status: SocketStatus = useSocketStatus();
  // Stash latest snapshot in a ref so socket handlers always see the
  // freshest value without going through stale React state closures.
  const snapshotRef = useRef<OrderStateSnapshot | null>(snapshot);
  snapshotRef.current = snapshot;

  /**
   * Patches the snapshot in-place + writes through to the cache. Used
   * by both the GET path and the socket handlers. Always passes the
   * RIDER COORD through unchanged unless the patch explicitly sets it.
   */
  const patch = useCallback(
    (next: Partial<OrderStateSnapshot>) => {
      if (!orderId) return;
      const prior = snapshotRef.current;
      const merged: OrderStateSnapshot = {
        ...(prior ?? {
          orderId,
          status: "pending",
          eta: null,
          rider: null,
          riderCoord: null,
          hydrated: false,
        }),
        ...next,
      };
      snapshotRef.current = merged;
      setSnapshot(merged);
      cache.set(orderId, { snapshot: merged, fetchedAt: Date.now() });
    },
    [orderId]
  );

  /**
   * Fetch the order from the server and merge into the snapshot.
   * Idempotent — safe to call multiple times.
   */
  const fetchFresh = useCallback(async () => {
    if (!orderId) return;
    try {
      const o = await api.get<ServerOrderResponse>(
        `/api/orders/${orderId}`,
        { timeoutMs: 10_000 }
      );
      const prior = snapshotRef.current;
      const next = snapshotFromServer(orderId, o, prior);
      snapshotRef.current = next;
      setSnapshot(next);
      cache.set(orderId, { snapshot: next, fetchedAt: Date.now() });
    } catch {
      // Non-fatal — socket events fill in later.
    }
  }, [orderId]);

  // Mount-time hydration. Three branches:
  //   - Cache hit + fresh: render immediately, skip the GET.
  //   - Cache hit + stale: render the cached value (no flash) and
  //     fire a GET in the background to refresh.
  //   - Cache miss: render null and fire a GET.
  useEffect(() => {
    if (!orderId) return;
    const cached = cache.get(orderId);
    if (!cached || Date.now() - cached.fetchedAt > STALE_MS) {
      fetchFresh();
    }
  }, [orderId, fetchFresh]);

  // Socket subscriptions. Re-binds whenever the socket goes live
  // (status flips false → true), so handlers attach to the freshly-
  // connected socket instance.
  useEffect(() => {
    if (!orderId) return;
    const socket = getSocket();
    if (!socket) return;

    const onUpdate = (data: OrderUpdatePayload) => {
      if (data.orderId && data.orderId !== orderId) return;
      const updates: Partial<OrderStateSnapshot> = {};
      if (data.status) updates.status = data.status;
      if (typeof data.eta === "number") updates.eta = data.eta;
      if (data.rider) updates.rider = data.rider;
      if (data.deliveredAt) updates.deliveredAt = data.deliveredAt;
      if (data.totalCharged != null) updates.totalCharged = data.totalCharged;
      if (data.pointsEarned != null) updates.pointsEarned = data.pointsEarned;
      // Status flipped to a "rider gone" terminal — clear rider state.
      if (data.status === "confirmed" || data.status === "cancelled") {
        updates.rider = null;
        updates.riderCoord = null;
      }
      patch(updates);
    };

    const onLocation = (data: { lat: number; lng: number }) => {
      patch({ riderCoord: { latitude: data.lat, longitude: data.lng } });
    };

    socket.on("order:update", onUpdate);
    socket.on("rider:location", onLocation);
    return () => {
      socket.off("order:update", onUpdate);
      socket.off("rider:location", onLocation);
    };
    // socketStatus is a re-bind trigger, not a logical dep.
  }, [orderId, patch, status]);

  // Reconnect catch-up — fetch fresh whenever the socket reconnects
  // after a drop, in case order:update events fired while offline.
  useEffect(() => subscribeReconnect(fetchFresh), [fetchFresh]);

  // Convenience derived values — memoized so consumers get stable
  // references (cuts down on dependent effect re-fires).
  const value = useMemo(
    () => ({
      snapshot,
      hydrated: snapshot?.hydrated ?? false,
      refresh: fetchFresh,
      patch,
    }),
    [snapshot, fetchFresh, patch]
  );

  return value;
}
