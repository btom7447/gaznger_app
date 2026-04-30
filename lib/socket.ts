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
