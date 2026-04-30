import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import {
  getSocket,
  subscribeReconnect,
  type SocketStatus,
  useSocketStatus,
} from "@/lib/socket";
import { ACTIVE_ORDER_STATUSES, isActiveOrder } from "@/_shared";

/**
 * Minimal active-order shape that callers commonly need. We
 * intentionally don't widen this to the full Order document — when a
 * caller needs the rest, it should fetch by id (the GET /api/orders/:id
 * route already populates rider, station, and address).
 */
export interface ActiveOrderInfo {
  _id: string;
  status: string;
  eta?: number | null;
  product?: "liquid" | "lpg";
  station?: { _id?: string; name?: string; shortName?: string } | null;
  /**
   * Money fields the receipt views (Arrival / Delivered / Complete)
   * read so they don't have to make a follow-up GET /:id when the
   * local draft is empty post-restart. Naira values, not kobo —
   * these come straight from Order.fuelCost / deliveryFee / totalPrice.
   */
  fuelCost?: number;
  deliveryFee?: number;
  totalPrice?: number;
  paymentStatus?: "unpaid" | "paid" | "refunded";
  /** Quantity + unit so receipts can render line items. */
  quantity?: number;
  unit?: string;
}

/**
 * Single source of truth for "does the user have an order in flight?"
 *
 * Phase 3: push-not-poll. The hook fetches once on mount, then
 * subscribes to the relevant socket events to keep state fresh. The
 * polling timer is demoted to a 5-minute safety net (catches edge
 * cases where the socket missed an event AND the reconnect
 * catch-up didn't fire).
 *
 * Used by:
 *   - Tab bar dot (just needs the boolean)
 *   - Track screen (uses the full ActiveOrderInfo to hydrate from
 *     the server when the local order draft is empty)
 *   - Arrival / Delivered / Complete (read money fields from here)
 *
 * The status set spans both legacy and v3 granular enums (sourced
 * from `_shared/status.ts`) so it works regardless of which
 * rider-app version produced the order.
 */
const ACTIVE_QUERY = ACTIVE_ORDER_STATUSES.join(",");

// Long fallback poll. 5 minutes balances catching missed events with
// not hammering the API for users who genuinely have no orders.
const SAFETY_POLL_MS = 5 * 60 * 1000;

export function useActiveOrder() {
  const [hasActiveOrder, setHasActiveOrder] = useState(false);
  const [activeOrder, setActiveOrder] = useState<ActiveOrderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const socketStatus: SocketStatus = useSocketStatus();
  // Stash the latest active order in a ref so socket handlers can
  // reconcile incoming updates without going through React state
  // closures (which would otherwise stale-close).
  const latestRef = useRef<ActiveOrderInfo | null>(null);

  const check = useCallback(async () => {
    try {
      const res = await api.get<{ data: ActiveOrderInfo[]; total: number }>(
        `/api/orders?status=${ACTIVE_QUERY}&page=1&limit=1`
      );
      const first = res.data?.[0] ?? null;
      latestRef.current = first;
      setActiveOrder(first);
      setHasActiveOrder(!!first || (res.total ?? 0) > 0);
    } catch {
      // keep last known state
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch on mount + 5-minute safety net. The safety poll is
  // ONLY a backstop for the socket: when the socket is "live", we
  // expect order:update to keep state fresh in real time.
  useEffect(() => {
    check();
    intervalRef.current = setInterval(check, SAFETY_POLL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [check]);

  // Reconnect catch-up — fire one fetch when the socket comes back
  // live after a drop. Belt-and-braces with the safety poll above.
  useEffect(() => subscribeReconnect(check), [check]);

  // Socket subscription — drives the hook in real time when the
  // socket is connected. Three event flavors:
  //   - order:update with a status change. If the new status is
  //     active and matches our cached order, patch in place. If the
  //     new status is terminal (delivered / cancelled / closed), clear
  //     the cache. If the orderId doesn't match what we're tracking
  //     (e.g. a brand-new order just got created), fetch fresh.
  //   - active-order:set — explicit "you have a new active order."
  //     Phase 3.x server emits this on order create / paid.
  //   - active-order:clear — explicit "your active order is gone."
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onOrderUpdate = (data: {
      orderId?: string;
      status?: string;
    }) => {
      if (!data.status) return;
      const cached = latestRef.current;
      // Status flipped to terminal — clear cache.
      if (!isActiveOrder(data.status)) {
        if (cached && data.orderId && cached._id === data.orderId) {
          latestRef.current = null;
          setActiveOrder(null);
          setHasActiveOrder(false);
        }
        return;
      }
      // Status active. If we already track this order, patch status.
      if (cached && data.orderId && cached._id === data.orderId) {
        const next = { ...cached, status: data.status };
        latestRef.current = next;
        setActiveOrder(next);
        setHasActiveOrder(true);
        return;
      }
      // Active order we don't yet know about — fetch fresh to populate
      // the full shape (money fields, station, etc.).
      if (data.orderId) {
        check();
      }
    };

    const onActiveOrderSet = () => check();
    const onActiveOrderClear = () => {
      latestRef.current = null;
      setActiveOrder(null);
      setHasActiveOrder(false);
    };

    socket.on("order:update", onOrderUpdate);
    socket.on("active-order:set", onActiveOrderSet);
    socket.on("active-order:clear", onActiveOrderClear);

    return () => {
      socket.off("order:update", onOrderUpdate);
      socket.off("active-order:set", onActiveOrderSet);
      socket.off("active-order:clear", onActiveOrderClear);
    };
    // socketStatus is a render trigger — when the socket goes live
    // for the first time, this effect re-runs and binds listeners
    // to the freshly-connected socket instance.
  }, [check, socketStatus]);

  return { hasActiveOrder, activeOrder, loading, refresh: check };
}
