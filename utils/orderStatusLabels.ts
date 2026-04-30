/**
 * Single source of truth for translating server `OrderStatus` enums into
 * customer-facing labels and the 4-step UI on Track / Arrival.
 *
 * This file is the only place these strings live. Screens consume via
 * `getStatusLabel(order)` and `getProgressStep(order)`.
 */

/** Canonical server-side enum (mirrors `04-flow-diagram.md`). */
export type OrderStatus =
  | "draft"
  | "pending_payment"
  | "confirmed"
  | "assigning"
  | "assigned"
  | "picked_up"
  | "at_plant"
  | "refilling"
  | "returning"
  | "arrived"
  | "dispensing"
  | "delivered"
  | "rated"
  | "closed"
  | "failed_payment"
  | "cancelled_by_customer"
  | "cancelled_by_vendor"
  | "cancelled_by_rider";

/** Customer-facing label kinds (used by StatusBadge). */
export type StatusKind =
  | "success"
  | "warning"
  | "error"
  | "info"
  | "primary"
  | "neutral";

export interface CustomerStatus {
  label: string;
  kind: StatusKind;
  /** Whether the indicator should pulse (e.g. "Rider arrived"). */
  pulse?: boolean;
}

interface OrderLike {
  status: OrderStatus | string;
  product?: "liquid" | "lpg";
}

/**
 * Map a raw server status (+ optional product context) into the customer label.
 * Order is the priority: liquid- and LPG-only branches resolve first, then
 * shared statuses fall through.
 */
export function getStatusLabel(order: OrderLike): CustomerStatus {
  const status = String(order.status) as OrderStatus;
  const isLpg = order.product === "lpg";

  switch (status) {
    case "confirmed":
      return { label: "Confirmed", kind: "success" };
    case "assigning":
      return { label: "Matching rider", kind: "info" };
    case "assigned":
      return {
        label: isLpg ? "Rider assigned" : "Heading to station",
        kind: "info",
      };
    case "picked_up":
      return { label: "Picked up", kind: "info" };
    case "at_plant":
      return { label: "At plant", kind: "info" };
    case "refilling":
      return { label: "Refilling", kind: "info" };
    case "returning":
      return { label: "Heading back", kind: "info" };
    case "arrived":
      return {
        label: "At your gate",
        kind: "success",
        pulse: true,
      };
    case "dispensing":
      return { label: "Dispensing", kind: "primary" };
    case "delivered":
      return { label: "Delivered", kind: "success" };
    case "rated":
    case "closed":
      return { label: "Closed", kind: "neutral" };
    case "failed_payment":
      return { label: "Payment failed", kind: "error" };
    case "cancelled_by_customer":
    case "cancelled_by_vendor":
    case "cancelled_by_rider":
      return { label: "Cancelled", kind: "error" };
    case "pending_payment":
      return { label: "Pending payment", kind: "warning" };
    case "draft":
    default:
      return { label: "In progress", kind: "neutral" };
  }
}

/**
 * Aggregate the server status into the 4-step UI used on Track + Arrival:
 *   1 Confirmed · 2 Picked up · 3 Out · 4 Delivered
 * Returns 0-indexed step (0..3). For terminal cancellations returns -1.
 */
export function getProgressStep(status: OrderStatus | string): number {
  const s = String(status) as OrderStatus;
  if (s === "confirmed" || s === "assigning" || s === "assigned") return 0;
  if (s === "picked_up" || s === "at_plant" || s === "refilling") return 1;
  if (s === "returning" || s === "arrived") return 2;
  if (s === "dispensing" || s === "delivered" || s === "rated" || s === "closed")
    return 3;
  if (
    s === "failed_payment" ||
    s === "cancelled_by_customer" ||
    s === "cancelled_by_vendor" ||
    s === "cancelled_by_rider"
  )
    return -1;
  return 0;
}

/** Active statuses the customer flow treats as "in flight". */
export const ACTIVE_STATUSES: OrderStatus[] = [
  "confirmed",
  "assigning",
  "assigned",
  "picked_up",
  "at_plant",
  "refilling",
  "returning",
  "arrived",
  "dispensing",
];

export function isActiveStatus(status: OrderStatus | string): boolean {
  return (ACTIVE_STATUSES as string[]).includes(String(status));
}

export function isTerminalStatus(status: OrderStatus | string): boolean {
  const s = String(status);
  return (
    s === "delivered" ||
    s === "rated" ||
    s === "closed" ||
    s === "failed_payment" ||
    s.startsWith("cancelled_")
  );
}

/**
 * Customer-side track phase used by the Track screen's per-phase
 * sheet body + map content. Folds BOTH the legacy enum (what the
 * rider app emits today) AND the v3 granular enum (what the rider
 * app will emit after upgrade) into the same five customer-facing
 * phases — so the customer screen lands the right design without
 * waiting for the rider app to upgrade.
 *
 * Mapping rationale:
 *   - pre-assignment: order paid, no rider yet (`pending` |
 *     `pending_payment` | `confirmed` | `assigning`).
 *   - assigned: rider accepted, possibly heading to pickup
 *     (`assigned`). v3 splits this into `assigned` (heading to
 *     station) — same key.
 *   - at-pickup: rider at the station refilling. Granular v3 emits
 *     `at_plant` / `refilling`; legacy collapses these into
 *     `assigned` so we currently can't see them. When the rider app
 *     upgrades, the customer's body flips automatically.
 *   - in-transit: rider has the fuel and is heading to the customer
 *     (`in-transit` / `in_transit` / `picked_up` / `returning`).
 *   - almost-there: rider is at the customer's gate or seconds away.
 *     v3 emits `arrived`; legacy collapses to `awaiting_confirmation`.
 *     We also derive almost-there client-side when in-transit ETA
 *     drops to ≤ 1 min, so the design's "< 1 min" + I'm-here CTA
 *     state still surfaces today.
 *
 * The fall-throughs default to `pre-assignment` so any unknown
 * status from a future server doesn't crash the screen.
 */
export type TrackPhase =
  | "pre-assignment"
  | "assigned"
  | "at-pickup"
  | "in-transit"
  | "almost-there";

export function getTrackPhase(input: {
  status: OrderStatus | string;
  hasRider: boolean;
  /** ETA in minutes. Drives the almost-there client-side derivation. */
  etaMinutes?: number | null;
}): TrackPhase {
  const s = String(input.status);

  // No rider yet — sheet shows the matching skeleton regardless of
  // server status nuance. `assigning` covers the dispatch window;
  // `pending` / `pending_payment` / `confirmed` cover the pre-dispatch
  // window after payment lands.
  if (
    !input.hasRider ||
    s === "pending" ||
    s === "pending_payment" ||
    s === "confirmed" ||
    s === "assigning"
  ) {
    return "pre-assignment";
  }

  // v3 granular — rider at the station.
  if (s === "at_plant" || s === "refilling") return "at-pickup";

  // v3 granular — rider arriving / dispensing on the customer side.
  if (s === "arrived" || s === "dispensing") return "almost-there";

  // Legacy + v3 in-transit — rider has the fuel, heading to customer.
  // We derive almost-there from a short ETA so the design's "< 1 min"
  // state still surfaces with the legacy rider app (it never emits
  // `arrived`).
  if (
    s === "in-transit" ||
    s === "in_transit" ||
    s === "picked_up" ||
    s === "returning"
  ) {
    if (typeof input.etaMinutes === "number" && input.etaMinutes <= 1) {
      return "almost-there";
    }
    return "in-transit";
  }

  // Legacy `awaiting_confirmation` — rider has marked delivery; we
  // route the customer off Track to the Arrival/Handoff screen, but
  // if we're still on Track for a render or two, present as
  // almost-there so the layout doesn't flash back to in-transit.
  if (s === "awaiting_confirmation") return "almost-there";

  // Default: rider exists, status unknown → assigned.
  return "assigned";
}
