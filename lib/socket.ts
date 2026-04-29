import { io, Socket } from "socket.io-client";

const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL ?? "http://localhost:5000";

let socket: Socket | null = null;

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

  socket.on("connect", () => {
    console.log("[Socket] connected:", socket?.id);
  });

  socket.on("connect_error", (err) => {
    console.warn("[Socket] connect_error:", err.message);
  });

  socket.on("disconnect", (reason) => {
    console.log("[Socket] disconnected:", reason);
  });

  return socket;
}

/** Disconnect and destroy the current socket (called on logout). */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/** Get the current socket instance (null if not connected). */
export function getSocket(): Socket | null {
  return socket;
}
