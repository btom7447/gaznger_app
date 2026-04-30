import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { toast } from "sonner-native";
import { Theme, useTheme } from "@/constants/theme";
import { api } from "@/lib/api";
import { useSessionStore } from "@/store/useSessionStore";
import {
  ScreenContainer,
  ScreenHeader,
} from "@/components/ui/primitives";

/**
 * Active sessions — v3.
 *
 * Lists every refresh-token row for the current user (each = one
 * active sign-in) and lets the user revoke individual rows OR every
 * row except the current one. Wiring:
 *
 *   GET    /auth/sessions?current=<refreshToken>  → list w/ current flag
 *   DELETE /auth/sessions/:id                     → revoke one
 *   DELETE /auth/sessions { currentRefreshToken } → revoke all others
 *
 * The "current" row is locked (no revoke button). Revoking others
 * doesn't sign the user out of this device.
 */

interface SessionItem {
  _id: string;
  userAgent?: string;
  device?: string;
  ip?: string;
  lastUsedAt?: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

/** Best-effort "iPhone · Safari" extraction from a UA string. */
function summariseUA(ua?: string): { device: string; browser?: string } {
  if (!ua) return { device: "Unknown device" };
  const lower = ua.toLowerCase();
  let device = "Device";
  if (lower.includes("iphone")) device = "iPhone";
  else if (lower.includes("ipad")) device = "iPad";
  else if (lower.includes("android")) {
    const m = ua.match(/Android[^;]*;\s*([^;)]+)/);
    device = m?.[1]?.trim() ?? "Android";
  } else if (lower.includes("mac os") || lower.includes("macintosh"))
    device = "Mac";
  else if (lower.includes("windows")) device = "Windows PC";
  else if (lower.includes("linux")) device = "Linux";

  let browser: string | undefined;
  if (lower.includes("expo")) browser = "Gaznger app";
  else if (lower.includes("chrome")) browser = "Chrome";
  else if (lower.includes("safari")) browser = "Safari";
  else if (lower.includes("firefox")) browser = "Firefox";

  return { device, browser };
}

function relativeTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

export default function ActiveSessionsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const refreshToken = useSessionStore((s) => s.refreshToken);

  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revokingAll, setRevokingAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const qs = refreshToken
        ? `?current=${encodeURIComponent(refreshToken)}`
        : "";
      const res = await api.get<{ sessions: SessionItem[] }>(
        `/auth/sessions${qs}`
      );
      setSessions(res.sessions ?? []);
    } catch (err: any) {
      toast.error("Couldn't load sessions", {
        description: err?.message ?? "Try again in a moment.",
      });
    }
  }, [refreshToken]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const revokeOne = useCallback(
    (s: SessionItem) => {
      const { device } = summariseUA(s.device ?? s.userAgent);
      Alert.alert(
        "Sign out this session?",
        `This will sign out ${device} immediately.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Sign out",
            style: "destructive",
            onPress: async () => {
              try {
                await api.delete(`/auth/sessions/${s._id}`);
                setSessions((prev) => prev.filter((x) => x._id !== s._id));
                toast.success("Session revoked");
              } catch (err: any) {
                toast.error("Couldn't revoke", {
                  description: err?.message ?? "Try again in a moment.",
                });
              }
            },
          },
        ]
      );
    },
    []
  );

  const revokeAllOthers = useCallback(() => {
    const others = sessions.filter((s) => !s.current);
    if (others.length === 0) {
      toast.info("Nothing to revoke", {
        description: "You're only signed in on this device.",
      });
      return;
    }
    Alert.alert(
      "Sign out all other sessions?",
      `${others.length} other ${
        others.length === 1 ? "device" : "devices"
      } will be signed out. You'll stay signed in here.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out all",
          style: "destructive",
          onPress: async () => {
            setRevokingAll(true);
            try {
              await api.delete(
                "/auth/sessions",
                refreshToken ? { currentRefreshToken: refreshToken } : undefined
              );
              setSessions((prev) => prev.filter((s) => s.current));
              toast.success("Other sessions revoked");
            } catch (err: any) {
              toast.error("Couldn't revoke", {
                description: err?.message ?? "Try again in a moment.",
              });
            } finally {
              setRevokingAll(false);
            }
          },
        },
      ]
    );
  }, [sessions, refreshToken]);

  return (
    <ScreenContainer
      edges={["top", "bottom"]}
      header={
        <ScreenHeader
          title="Active sessions"
          subtitle={
            sessions.length > 0
              ? `${sessions.length} ${
                  sessions.length === 1 ? "session" : "sessions"
                }`
              : undefined
          }
          onBack={() => router.back()}
        />
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={theme.primary} />
          </View>
        ) : sessions.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Ionicons name="time-outline" size={26} color={theme.fgMuted} />
            </View>
            <Text style={styles.emptyTitle}>No active sessions</Text>
            <Text style={styles.emptyBody}>
              Sign in on another device to see it listed here.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.lead}>
              We track every device signed in to your account. Sign out
              of any you don't recognise.
            </Text>

            {sessions.map((s) => {
              const { device, browser } = summariseUA(s.device ?? s.userAgent);
              return (
                <View
                  key={s._id}
                  style={[
                    styles.sessionCard,
                    s.current && styles.sessionCardCurrent,
                  ]}
                >
                  <View style={styles.iconTile}>
                    <Ionicons
                      name={
                        device === "iPhone" || device === "iPad"
                          ? "phone-portrait-outline"
                          : device.includes("Mac") || device.includes("PC")
                          ? "desktop-outline"
                          : "phone-portrait-outline"
                      }
                      size={18}
                      color={
                        s.current
                          ? theme.mode === "dark"
                            ? "#fff"
                            : theme.palette.green700
                          : theme.fgMuted
                      }
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.titleRow}>
                      <Text style={styles.deviceName} numberOfLines={1}>
                        {device}
                      </Text>
                      {s.current ? (
                        <View style={styles.currentPill}>
                          <Text style={styles.currentPillText}>
                            THIS DEVICE
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.metaLine} numberOfLines={1}>
                      {[browser, s.ip].filter(Boolean).join(" · ")}
                    </Text>
                    <Text style={styles.metaLine} numberOfLines={1}>
                      Last active {relativeTime(s.lastUsedAt ?? s.createdAt)}
                    </Text>
                  </View>
                  {!s.current ? (
                    <Pressable
                      onPress={() => revokeOne(s)}
                      accessibilityRole="button"
                      accessibilityLabel={`Sign out ${device}`}
                      style={({ pressed }) => [
                        styles.revokeBtn,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text style={styles.revokeText}>Sign out</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}

            {sessions.some((s) => !s.current) ? (
              <Pressable
                onPress={revokeAllOthers}
                disabled={revokingAll}
                accessibilityRole="button"
                accessibilityLabel="Sign out of all other sessions"
                style={({ pressed }) => [
                  styles.revokeAllBtn,
                  pressed && { opacity: 0.85 },
                  revokingAll && { opacity: 0.5 },
                ]}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={16}
                  color={theme.error}
                />
                <Text style={styles.revokeAllText}>
                  {revokingAll
                    ? "Signing out…"
                    : "Sign out of all other sessions"}
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    scroll: {
      paddingHorizontal: theme.space.s4,
      paddingTop: theme.space.s2,
      paddingBottom: theme.space.s5,
    },
    loadingWrap: {
      paddingVertical: 60,
      alignItems: "center",
    },
    emptyWrap: {
      alignItems: "center",
      paddingVertical: 60,
    },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.bgMuted,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    emptyTitle: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "800",
      marginBottom: 4,
    },
    emptyBody: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      textAlign: "center",
      maxWidth: 240,
      lineHeight: 18,
    },

    lead: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      marginBottom: theme.space.s3,
    },

    sessionCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.divider,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
    },
    sessionCardCurrent: {
      borderColor: theme.primary,
      backgroundColor: theme.primaryTint,
    },
    iconTile: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: theme.bgMuted,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 2,
    },
    deviceName: {
      fontSize: 14,
      fontWeight: "800",
      color: theme.fg,
      flexShrink: 1,
    },
    currentPill: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: theme.radius.pill,
      backgroundColor:
        theme.mode === "dark" ? "rgba(255,255,255,0.14)" : theme.bg,
    },
    currentPillText: {
      fontSize: 9,
      fontWeight: "800",
      color: theme.mode === "dark" ? "#fff" : theme.palette.green700,
      letterSpacing: 0.4,
    },
    metaLine: {
      ...theme.type.caption,
      color: theme.fgMuted,
    },
    revokeBtn: {
      paddingHorizontal: 10,
      height: 32,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.bgMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    revokeText: {
      fontSize: 11.5,
      fontWeight: "800",
      color: theme.error,
    },

    revokeAllBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      marginTop: theme.space.s3,
      height: 50,
      borderRadius: theme.radius.md + 2,
      backgroundColor: theme.errorTint,
      borderWidth: 1,
      borderColor:
        theme.mode === "dark"
          ? "rgba(209,69,59,0.20)"
          : theme.palette.error100,
    },
    revokeAllText: {
      ...theme.type.body,
      color: theme.error,
      fontWeight: "800",
    },
  });
