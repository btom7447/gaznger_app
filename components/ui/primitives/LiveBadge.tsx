import React from "react";
import StatusBadge, { StatusKind } from "./StatusBadge";
import { useSocketStatus, SocketStatus } from "@/lib/socket";

export type LiveStatus = SocketStatus | "onSite";

interface LiveBadgeProps {
  /** Override the auto-resolved socket status (e.g. for previews). */
  status?: LiveStatus;
  /** Override the rendered label. */
  label?: string;
}

const KIND_BY_STATUS: Record<LiveStatus, StatusKind> = {
  live: "success",
  onSite: "success",
  reconnecting: "warning",
  // Red, not neutral — when the customer is on Track and the socket
  // drops, the badge should communicate "your live data is stale" loud
  // and clear. The grey neutral previously was too easy to miss.
  offline: "error",
};

const LABEL_BY_STATUS: Record<LiveStatus, string> = {
  live: "LIVE",
  onSite: "RIDER ON-SITE",
  reconnecting: "RECONNECTING",
  offline: "OFFLINE",
};

/**
 * Socket-state-aware "LIVE / Reconnecting / Offline" pill.
 * - With no `status` prop, auto-subscribes to the socket connection state.
 * - Pass `status="onSite"` for the Arrival/Handoff variant.
 *
 * Live + on-site dots pulse; reconnecting + offline are static so the
 * customer doesn't read the pulse as "data still flowing".
 */
export default function LiveBadge({ status, label }: LiveBadgeProps) {
  const auto = useSocketStatus();
  const resolved: LiveStatus = status ?? auto;
  const kind = KIND_BY_STATUS[resolved];
  const text = label ?? LABEL_BY_STATUS[resolved];
  const pulsing = resolved === "live" || resolved === "onSite";

  return (
    <StatusBadge kind={kind} pulse={pulsing} withDot compact>
      {text}
    </StatusBadge>
  );
}
