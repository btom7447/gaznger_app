import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { ACTIVE_ORDER_STATUSES } from "@/_shared";

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
 * Polls /api/orders for the user's most-recent active order every 30s
 * and on mount. Used by:
 *   - Tab bar dot (just needs the boolean)
 *   - Track screen (uses the order id + status so it can hydrate from
 *     the server when the local order draft is empty — e.g. after
 *     restart, deep-link, or tab switch from elsewhere)
 *
 * The status set spans both the legacy (`in-transit`, `awaiting_confirmation`)
 * and v3 granular (`at_plant`, `arrived`, etc.) enums so it works
 * regardless of which rider-app version produced the order.
 */
// Comma-joined whitelist for the polling query. Sourced from the
// shared module so adding a new in-flight status updates this hook
// AND the server's matching whitelists in lockstep.
const ACTIVE_QUERY = ACTIVE_ORDER_STATUSES.join(",");

export function useActiveOrder() {
  const [hasActiveOrder, setHasActiveOrder] = useState(false);
  const [activeOrder, setActiveOrder] = useState<ActiveOrderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = useCallback(async () => {
    try {
      const res = await api.get<{ data: ActiveOrderInfo[]; total: number }>(
        `/api/orders?status=${ACTIVE_QUERY}&page=1&limit=1`
      );
      const first = res.data?.[0] ?? null;
      setActiveOrder(first);
      setHasActiveOrder(!!first || (res.total ?? 0) > 0);
    } catch {
      // keep last known state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    check();
    intervalRef.current = setInterval(check, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [check]);

  return { hasActiveOrder, activeOrder, loading, refresh: check };
}
