import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Theme, useTheme } from "@/constants/theme";
import {
  getSocketEventLog,
  subscribeSocketEventLog,
  useSocketStatus,
  type SocketLogEntry,
} from "@/lib/socket";

/**
 * Hidden debug overlay (Phase 6 of the execution plan).
 *
 * Long-press a small invisible hit-area at the top-left corner to
 * open. Surfaces:
 *   - Current socket status (live / reconnecting / offline)
 *   - Last 20 socket events (timestamped, with payload)
 *
 * Why: when a user reports "rider pin not showing" or "stuck on
 * status X", debugging without these logs meant adding console.logs
 * and waiting for the next repro. The overlay is always there, only
 * activated by a deliberate long-press, so it doesn't interfere with
 * normal UX.
 *
 * Mount once near the app root. The hit-area is 24×24px in the top-
 * left corner — big enough for a deliberate long-press, small enough
 * to never be hit by accident.
 */
export default function DebugOverlay() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [open, setOpen] = useState(false);
  const status = useSocketStatus();
  const [log, setLog] = useState<SocketLogEntry[]>(() => getSocketEventLog());

  useEffect(() => {
    if (!open) return;
    return subscribeSocketEventLog(setLog);
  }, [open]);

  return (
    <>
      {/* Invisible hit-area — long-press to open. */}
      <Pressable
        onLongPress={() => setOpen(true)}
        delayLongPress={1500}
        style={[
          styles.hitArea,
          { top: insets.top + 4, left: 4 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Open debug overlay"
        accessibilityHint="Long-press to view socket connection diagnostics"
      />

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modalRoot}>
          <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
            <Text style={styles.title}>Debug</Text>
            <Pressable
              onPress={() => setOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Close debug overlay"
              style={({ pressed }) => [
                styles.closeBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Ionicons name="close" size={22} color={theme.fg} />
            </Pressable>
          </View>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>SOCKET</Text>
            <View style={[styles.statusPill, statusPillStyle(theme, status)]}>
              <View style={[styles.statusDot, { backgroundColor: dotColor(theme, status) }]} />
              <Text style={[styles.statusText, { color: dotColor(theme, status) }]}>
                {status.toUpperCase()}
              </Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>RECENT EVENTS</Text>
          <ScrollView style={styles.logScroll} contentContainerStyle={styles.logContent}>
            {log.length === 0 ? (
              <Text style={styles.empty}>No events yet.</Text>
            ) : (
              log.map((entry, i) => (
                <View key={`${entry.ts}-${i}`} style={styles.logRow}>
                  <Text style={styles.logTs}>
                    {formatHHMMSS(entry.ts)}
                  </Text>
                  <Text
                    style={[
                      styles.logArrow,
                      { color: entry.direction === "in" ? theme.success : theme.fgMuted },
                    ]}
                  >
                    {entry.direction === "in" ? "←" : "→"}
                  </Text>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.logEvent} numberOfLines={1}>
                      {entry.event}
                    </Text>
                    {entry.payload != null ? (
                      <Text style={styles.logPayload} numberOfLines={3}>
                        {safeStringify(entry.payload)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function formatHHMMSS(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function dotColor(theme: Theme, status: string): string {
  if (status === "live") return theme.success;
  if (status === "reconnecting") return theme.palette.warning500;
  return theme.error;
}

function statusPillStyle(theme: Theme, status: string) {
  if (status === "live") return { backgroundColor: theme.successTint };
  if (status === "reconnecting") return { backgroundColor: theme.palette.warning100 };
  return { backgroundColor: theme.errorTint };
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    hitArea: {
      position: "absolute",
      width: 28,
      height: 28,
      zIndex: 9999,
      // Transparent — only responds to long-press.
    },
    modalRoot: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.divider,
    },
    title: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.fg,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.bgMuted,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    statusLabel: {
      fontSize: 11.5,
      fontWeight: "800",
      color: theme.fgMuted,
      letterSpacing: 0.5,
    },
    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusText: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.4,
    },
    sectionLabel: {
      fontSize: 11.5,
      fontWeight: "800",
      color: theme.fgMuted,
      letterSpacing: 0.5,
      paddingHorizontal: 16,
      marginTop: 8,
    },
    logScroll: {
      flex: 1,
    },
    logContent: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      gap: 8,
    },
    empty: {
      fontSize: 13,
      color: theme.fgMuted,
      fontStyle: "italic",
    },
    logRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      paddingVertical: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.divider,
    },
    logTs: {
      fontSize: 11,
      color: theme.fgMuted,
      ...theme.type.money,
      width: 64,
    },
    logArrow: {
      fontSize: 12,
      fontWeight: "800",
      width: 14,
    },
    logEvent: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.fg,
    },
    logPayload: {
      fontSize: 10.5,
      color: theme.fgMuted,
      marginTop: 2,
      ...theme.type.money,
    },
  });
