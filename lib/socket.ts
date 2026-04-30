import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL ?? "http://localhost:5000";

let socket: Socket | null = null;

/** Public socket connectivity states for the LiveBadge primitive. */
export type SocketStatus = "live" | "reconnecting" | "offline";

/**
 * Reconnect listeners — fired exactly once each time the socket
 * goes live AFTER a previous disconnect (not on the first connect).
 *
 * Phase 2 use case: hooks like `useOrderState` register a callback
 * that does a single `GET /api/orders/:id` to catch up on any
 * `order:update` events that fired while the socket was down.
 */
type ReconnectListener = () => void;
const reconnectListeners = new Set<ReconnectListener>();
let hasConnectedBefore = false;

export function subscribeReconnect(listener: ReconnectListener): () => void {
  reconnectListeners.add(listener);
  return () => {
    reconnectListeners.delete(listener);
  };
}

/**
 * Recent socket event ring buffer — populated by client-side
 * listeners and surfaced through the debug overlay (Phase 6).
 *
 * Anything we want to debug ad-hoc gets logged here. Keep the buffer
 * small (default 20) so the memory footprint is bounded; old entries
 * fall off as new ones land.
 */
export interface SocketLogEntry {
  ts: number;
  direction: "in" | "out";
  event: string;
  payload?: unknown;
}

const LOG_MAX = 20;
const eventLog: SocketLogEntry[] = [];
type LogListener = (snapshot: SocketLogEntry[]) => void;
const logListeners = new Set<LogListener>();

export function logSocketEvent(entry: SocketLogEntry): void {
  eventLog.unshift(entry);
  if (eventLog.length > LOG_MAX) eventLog.length = LOG_MAX;
  // Snapshot for subscribers — they get a frozen copy so they can
  // safely render without worrying about mid-render mutations.
  const snap = eventLog.slice();
  logListeners.forEach((l) => l(snap));
}

export function getSocketEventLog(): SocketLogEntry[] {
  return eventLog.slice();
}

export function subscribeSocketEventLog(listener: LogListener): () => void {
  logListeners.add(listener);
  return () => {
    logListeners.delete(listener);
  };
}

/**
 * Lightweight pub/sub for socket status — survives module reload, lives outside
 * React. The LiveBadge subscribes via `useSocketStatus()`.
 */
type StatusListener = (s: SocketStatus) => void;
const statusListeners = new Set<StatusListener>();
let currentStatus: SocketStatus = "offline";
let offlineTimer: ReturnType<typeof setTimeout> | null = null;

function setStatus(next: SocketStatus) {
  if (next === currentStatus) return;
  currentStatus = next;
  statusListeners.forEach((l) => l(next));
}

function scheduleOffline() {
  if (offlineTimer) clearTimeout(offlineTimer);
  // Per spec: only flip to "offline" after >5s disconnected.
  offlineTimer = setTimeout(() => setStatus("offline"), 5_000);
}

function clearOfflineTimer() {
  if (offlineTimer) {
    clearTimeout(offlineTimer);
    offlineTimer = null;
  }
}

export function getSocketStatus(): SocketStatus {
  return currentStatus;
}

export function subscribeSocketStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

/**
 * React hook for the LiveBadge. Returns the current socket status and
 * re-renders the consumer on change without re-rendering its parent.
 */
export function useSocketStatus(): SocketStatus {
  const [status, set] = useState<SocketStatus>(currentStatus);
  useEffect(() => {
    const unsub = subscribeSocketStatus(set);
    return unsub;
  }, []);
  return status;
}

/**
 * Connect (or reconnect) the socket.
 * Token is passed by the caller to avoid a circular import with useSessionStore.
 */
export function connectSocket(token?: string | null): Socket | null {
  if (!token) return null; // No token yet — caller will retry after login

  if (socket?.connected) {
    // Update auth token in case it was refreshed
    socket.auth = { token };
    return socket;
  }

  // Tear down any stale disconnected socket before creating a new one
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }

  socket = io(BASE_URL, {
    auth: { token },
    transports: ["websocket"],
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionAttempts: 10,
  });

  setStatus("reconnecting");

  socket.on("connect", () => {
    console.log("[Socket] connected:", socket?.id);
    clearOfflineTimer();
    setStatus("live");
    logSocketEvent({ ts: Date.now(), direction: "in", event: "connect" });

    // Fire reconnect listeners on every connect AFTER the first.
    // The first connect is just initial bootstrap — there's nothing
    // to "catch up on" because the screen subscriber is itself
    // about to fetch initial state. On subsequent connects (i.e. a
    // reconnect after a drop), listeners catch up missed events.
    if (hasConnectedBefore) {
      reconnectListeners.forEach((l) => {
        try {
          l();
        } catch {
          // listener errors must not break socket flow
        }
      });
    }
    hasConnectedBefore = true;
  });

  // Log every inbound application event (not transport plumbing).
  // We use socket.onAny so new event types get logged without
  // having to add explicit listeners here.
  socket.onAny((event: string, payload: unknown) => {
    if (
      event === "connect" ||
      event === "disconnect" ||
      event === "reconnect_attempt" ||
      event === "connect_error"
    ) {
      return; // already logged in their explicit handlers
    }
    logSocketEvent({ ts: Date.now(), direction: "in", event, payload });
  });

  socket.on("reconnect_attempt", () => {
    setStatus("reconnecting");
  });

  socket.on("connect_error", (err) => {
    console.warn("[Socket] connect_error:", err.message);
    if (currentStatus === "live") setStatus("reconnecting");
    scheduleOffline();
  });

  socket.on("disconnect", (reason) => {
    console.log("[Socket] disconnected:", reason);
    setStatus("reconnecting");
    scheduleOffline();
    logSocketEvent({
      ts: Date.now(),
      direction: "in",
      event: "disconnect",
      payload: { reason },
    });
  });

  return socket;
}

/** Disconnect and destroy the current socket (called on logout). */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  clearOfflineTimer();
  setStatus("offline");
  hasConnectedBefore = false;
  reconnectListeners.clear();
}

/** Get the current socket instance (null if not connected). */
export function getSocket(): Socket | null {
  return socket;
}
