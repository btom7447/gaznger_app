import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";
import { useSocketStatus, type SocketStatus } from "@/lib/socket";

/**
 * Thin strip surfaced at the top of long-running real-time screens
 * (Track index, rider Track) when the socket connection is unhealthy.
 *
 * Hidden when status === "live". Slides down from above when state
 * goes "reconnecting" or "offline" so the user knows the live data
 * they're seeing is stale.
 *
 * Why a strip and not a toast: the connection state can persist for
 * minutes (rider in a basement, customer on a train). Toasts are
 * for transient feedback, not persistent state.
 *
 * Phase 2 of the execution plan — pairs with the per-delivery socket
 * rooms server-side. When the socket reconnects after a drop, the
 * `subscribeReconnect` listeners fire a one-shot GET to catch up on
 * any events missed during the dropout.
 */
export function SocketStrip() {
  const theme = useTheme();
  const status = useSocketStatus();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // Slide-in animation. We only mount when status !== "live" so the
  // strip doesn't take layout space during normal operation.
  const translateY = useRef(new Animated.Value(-40)).current;
  const visible = status !== "live";

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : -40,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, translateY]);

  if (!visible) return null;

  const copy = labelFor(status);
  const tone = toneFor(theme, status);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        { backgroundColor: tone.bg, transform: [{ translateY }] },
      ]}
    >
      <Ionicons
        name={status === "offline" ? "cloud-offline" : "sync"}
        size={14}
        color={tone.fg}
      />
      <Text style={[styles.text, { color: tone.fg }]} numberOfLines={1}>
        {copy}
      </Text>
    </Animated.View>
  );
}

function labelFor(status: SocketStatus): string {
  switch (status) {
    case "reconnecting":
      return "Reconnecting…";
    case "offline":
      return "You're offline — updates will resume when you reconnect.";
    case "live":
      return "";
  }
}

function toneFor(theme: Theme, status: SocketStatus) {
  if (status === "offline") {
    return {
      bg:
        theme.mode === "dark"
          ? "rgba(209,69,59,0.18)"
          : theme.palette.error100,
      fg: theme.mode === "dark" ? "#fff" : theme.palette.error700,
    };
  }
  // reconnecting
  return {
    bg:
      theme.mode === "dark"
        ? "rgba(159,111,10,0.22)"
        : theme.palette.warning100,
    fg: theme.mode === "dark" ? "#fff" : theme.palette.warning700,
  };
}

const makeStyles = (_theme: Theme) =>
  StyleSheet.create({
    wrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      alignSelf: "center",
    },
    text: {
      fontSize: 11.5,
      fontWeight: "700",
    },
  });

export default SocketStrip;
