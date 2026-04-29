import React, { useEffect, useRef, useState } from "react";
import { ViewStyle } from "react-native";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import ErrorStrip from "./ErrorStrip";

interface OfflineStripProps {
  /** Override the message rendered when offline. */
  message?: string;
  /** Override the brief "back online" reassurance message. */
  recoveredMessage?: string;
  /** When true, render the strip even if the device reports online (test/preview). */
  forceVisible?: boolean;
  /** How long the "back online" strip lingers after recovery. Default 2500ms. */
  recoveredDurationMs?: number;
  style?: ViewStyle;
}

type Status = "online" | "offline" | "recovered";

/**
 * Subscribes to NetInfo and renders/hides automatically when network state changes.
 * - Per AC: appears within 1s of disconnect.
 * - On recovery, briefly flashes a "Back online" strip, then hides.
 *
 * Treats `isInternetReachable === null` as still-online (it lingers as null on
 * Android/Expo Go after wifi reconnects until traffic confirms).
 */
function isOffline(state: NetInfoState | null): boolean {
  if (!state) return false;
  if (state.isConnected === false) return true;
  // Only treat reachable=false as offline. `null` = unknown → trust isConnected.
  if (state.isInternetReachable === false) return true;
  return false;
}

export default function OfflineStrip({
  message = "You're offline. Some actions may not work.",
  recoveredMessage = "Back online.",
  forceVisible = false,
  recoveredDurationMs = 2500,
  style,
}: OfflineStripProps) {
  const [status, setStatus] = useState<Status>("online");
  const recoveryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    const apply = (state: NetInfoState) => {
      const offline = isOffline(state);
      if (offline) {
        wasOfflineRef.current = true;
        if (recoveryTimer.current) {
          clearTimeout(recoveryTimer.current);
          recoveryTimer.current = null;
        }
        setStatus("offline");
      } else if (wasOfflineRef.current) {
        setStatus("recovered");
        if (recoveryTimer.current) clearTimeout(recoveryTimer.current);
        recoveryTimer.current = setTimeout(() => {
          wasOfflineRef.current = false;
          setStatus("online");
        }, recoveredDurationMs);
      } else {
        setStatus("online");
      }
    };

    const unsub = NetInfo.addEventListener(apply);
    NetInfo.fetch().then(apply);
    return () => {
      unsub();
      if (recoveryTimer.current) {
        clearTimeout(recoveryTimer.current);
      }
    };
  }, [recoveredDurationMs]);

  const showOffline = status === "offline" || forceVisible;
  const showRecovered = status === "recovered";

  if (!showOffline && !showRecovered) return null;

  if (showRecovered) {
    return (
      <ErrorStrip
        variant="info"
        icon="cloud-done-outline"
        message={recoveredMessage}
        animated
        style={style}
      />
    );
  }

  return (
    <ErrorStrip
      variant="warning"
      icon="cloud-offline-outline"
      message={message}
      animated
      style={style}
    />
  );
}
