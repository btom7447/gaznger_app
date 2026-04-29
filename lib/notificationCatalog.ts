/**
 * Notification catalog — single source of truth for every push the app emits.
 *
 * Each entry defines the rendering kind (drives icon + accent), title/body
 * templates, meta line, and behavior flags. Server-driven copy still wins
 * at runtime for `title`/`body` (server may interpolate user-specific
 * values); the catalog provides the visual mapping + a fallback.
 *
 * IMPORTANT — pricing rule:
 *  - `priceDrop` and any other promo notification mentioning fuel price
 *    MUST use "near you" or station-scoped phrasing. Never globalize.
 */

export type NotificationKind =
  | "order"
  | "payment"
  | "reminder"
  | "lpg"
  | "promo"
  | "system";

export interface CatalogEntry {
  kind: NotificationKind;
  /** Default title (template — server may override). */
  title: string;
  /** Default body (template — server may override). */
  body: string;
  /** Meta line under the body. */
  meta?: string;
  /** Surface as the "pinned urgent" banner when unread. */
  urgent?: boolean;
  /** Show a colored dot accent on the row. */
  accentDot?: boolean;
  /** OS-level loud (sound + heads-up) hint. */
  loud?: boolean;
}

export const NotificationCatalog = {
  // ── Order lifecycle ─────────────────────────────────────────
  riderAssigned: {
    kind: "order",
    title: "Rider assigned",
    body: "Emeka is heading to pick up your 15 L Petrol.",
    meta: "Order {orderId} · ETA {eta}",
  },
  enRoute: {
    kind: "order",
    title: "On the way",
    body: "Emeka left {station} · {dist} out.",
    meta: "Order {orderId} · {eta} away",
    accentDot: true,
  },
  arrived: {
    kind: "order",
    title: "Rider has arrived",
    body: "Emeka is at your gate. Open the app to confirm.",
    meta: "Order {orderId} · now",
    loud: true,
    urgent: true,
  },
  delivered: {
    kind: "order",
    title: "Delivered",
    body: "{qty} delivered. Receipt sent to your email.",
    meta: "Order {orderId} · {ago}",
  },

  // ── Payment ────────────────────────────────────────────────
  paymentOk: {
    kind: "payment",
    title: "Payment received",
    body: "{amount} settled to {method}.",
    meta: "Receipt · {refId}",
  },
  paymentFail: {
    kind: "payment",
    title: "Payment failed — action needed",
    body: "Card declined. Tap to retry with another method.",
    meta: "Order {orderId} · pending",
    urgent: true,
  },
  refundIssued: {
    kind: "payment",
    title: "Refund issued",
    body: "{amount} refunded for {reason} on order {orderId}.",
    meta: "{ago} · {method}",
  },

  // ── Reminders ──────────────────────────────────────────────
  refillSoon: {
    kind: "reminder",
    title: "Tank running low?",
    body: "Based on usage, you usually refill around now.",
    meta: "Tip · dismissable",
  },
  schedulePrep: {
    kind: "reminder",
    title: "Pickup tomorrow at {time}",
    body: "Place your empty {size} cylinder outside, valve closed.",
    meta: "Order {orderId} · LPG",
  },

  // ── LPG safety ─────────────────────────────────────────────
  lpgValveAlert: {
    kind: "lpg",
    title: "Cylinder verification needed",
    body: "Your photo was unclear. Re-take a close-up of the valve.",
    meta: "Order {orderId} · 24 h to retry",
    urgent: true,
  },
  swapReady: {
    kind: "lpg",
    title: "Swap-ready cylinder available",
    body: "{brand} {size} in stock at {station} · {price}.",
    meta: "Save {discount} vs refill",
  },

  // ── Promo (price copy MUST stay station-scoped or "near you") ──
  priceDrop: {
    kind: "promo",
    title: "{fuel} dropped to {price}/{unit} near you",
    body: "Down {delta} at {n} stations near {area}.",
    meta: "Today · expires {expiry}",
  },

  // ── System ─────────────────────────────────────────────────
  rated: {
    kind: "system",
    title: "Thanks for rating {rider}",
    body: "Your {stars}-star helps fellow customers find great riders.",
    meta: "{ago}",
  },
} satisfies Record<string, CatalogEntry>;

export type NotificationCatalogKey = keyof typeof NotificationCatalog;

/**
 * Map a server-side `type` string (legacy — see (screens)/notification.tsx
 * for the full vendor/rider set) to a customer-facing kind. Falls back to
 * `system` for anything unrecognized.
 */
export function mapServerTypeToKind(serverType?: string): NotificationKind {
  switch ((serverType ?? "").toLowerCase()) {
    case "order":
    case "delivery":
    case "in_transit":
    case "delivered":
    case "cancelled":
    case "rider_assigned":
    case "arrived":
    case "en_route":
      return "order";
    case "payment":
    case "payment_ok":
    case "payment_fail":
    case "refund":
    case "refund_issued":
      return "payment";
    case "reminder":
    case "schedule":
    case "schedule_prep":
    case "refill_soon":
      return "reminder";
    case "lpg":
    case "lpg_valve_alert":
    case "swap_ready":
      return "lpg";
    case "promo":
    case "promotion":
    case "price_drop":
      return "promo";
    case "rated":
    case "system":
    case "info":
    case "points":
      return "system";
    default:
      return "system";
  }
}
