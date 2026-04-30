/**
 * Customer-facing labels + StatusBadge kind mapping. The OrderStatus
 * enum, TrackPhase type, and getTrackPhase function all live in the
 * shared module (`@/_shared`) — re-exported here so existing
 * imports of `@/utils/orderStatusLabels` keep working.
 */
import type { OrderStatus } from "@/_shared/status";
export type { OrderStatus };

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

// TrackPhase + getTrackPhase live in the shared module so the
// server can derive customer phase too if needed (e.g. for analytics).
export { type TrackPhase, getTrackPhase } from "@/_shared/trackPhase";
