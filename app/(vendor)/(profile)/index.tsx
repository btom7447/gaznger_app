import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { toast } from "sonner-native";
import {
  SettingsRow,
  Skel,
  SkelStack,
  VendorCard,
  VendorScreenShell,
} from "@/components/ui/vendor";
import { useSessionStore } from "@/store/useSessionStore";
import {
  useVendorStationStore,
  type VendorStationLite,
} from "@/store/useVendorStationStore";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";

interface ProfileApiStation {
  _id: string;
  name: string;
}

interface ProfileApiResponse {
  user: {
    displayName?: string;
    phone?: string;
    email?: string;
    profileImage?: string;
  };
  stations: ProfileApiStation[];
}

interface TeamApiRow {
  kind: "rider" | "invite";
  id: string;
  status: "active" | "idle" | "offline" | "pending";
}

interface TankApiRow {
  _id: string;
  capacity: number;
  currentLevel: number;
  lowThresholdPct: number;
  fuelType?: { name?: string };
}

/**
 * Vendor Profile main — entry point to the rest of the vendor's
 * config: team, stations, tanks, plus account / logout.
 *
 * Counts on the rows pull live so vendors see at a glance whether
 * a surface has anything to manage.
 */
export default function VendorProfileScreen() {
  const router = useRouter();
  const theme = useTheme();
  const user = useSessionStore((s) => s.user);
  const sessionLogout = useSessionStore((s) => s.logout);
  const setStations = useVendorStationStore((s) => s.setStations);
  const cachedStations = useVendorStationStore((s) => s.stations);

  const [profile, setProfile] = useState<ProfileApiResponse | null>(null);
  const [team, setTeam] = useState<TeamApiRow[] | null>(null);
  const [tanks, setTanks] = useState<TankApiRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const styles = useMemo(() => makeStyles(theme), [theme]);

  const fetchAll = useCallback(async () => {
    try {
      const [p, t, k] = await Promise.allSettled([
        api.get<ProfileApiResponse>("/api/vendor/profile", { timeoutMs: 10_000 }),
        api.get<{ team: TeamApiRow[] }>("/api/vendor/team", { timeoutMs: 10_000 }),
        api.get<{ tanks: TankApiRow[] }>("/api/vendor/tanks", { timeoutMs: 10_000 }),
      ]);
      if (p.status === "fulfilled") {
        setProfile(p.value);
        // Mirror stations into the vendor-station store so other
        // screens can scope by activeStationId.
        const list: VendorStationLite[] = (p.value.stations ?? []).map((s) => ({
          id: s._id,
          name: s.name,
        }));
        setStations(list);
      }
      if (t.status === "fulfilled") setTeam(t.value.team ?? []);
      if (k.status === "fulfilled") setTanks(k.value.tanks ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setStations]);

  useEffect(() => {
    setLoading(true);
    fetchAll();
  }, [fetchAll]);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAll();
  }, [fetchAll]);

  const stationCount = profile?.stations.length ?? cachedStations.length;
  const teamCount = team?.length ?? 0;
  const tankLow =
    tanks?.filter(
      (t) => (t.currentLevel / t.capacity) * 100 <= t.lowThresholdPct,
    ).length ?? 0;
  const tankCount = tanks?.length ?? 0;

  const handleLogout = useCallback(() => {
    sessionLogout();
    router.replace("/(auth)/welcome" as never);
    toast.success("Signed out");
  }, [router, sessionLogout]);

  return (
    <VendorScreenShell title="Profile">
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Identity */}
        {loading && !profile ? (
          <Skel height={92} radius={16} />
        ) : (
          <VendorCard>
            <View style={styles.identityRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(profile?.user.displayName ?? user?.displayName ?? "V")
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {profile?.user.displayName ?? user?.displayName ?? "Vendor"}
                </Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {profile?.user.phone ?? user?.phone ?? ""}
                </Text>
                {profile?.user.email ? (
                  <Text style={styles.sub} numberOfLines={1}>
                    {profile.user.email}
                  </Text>
                ) : null}
              </View>
            </View>
          </VendorCard>
        )}

        {loading && !profile ? (
          <SkelStack gap={10}>
            <Skel height={66} radius={16} />
            <Skel height={66} radius={16} />
            <Skel height={66} radius={16} />
            <Skel height={66} radius={16} />
          </SkelStack>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Operations</Text>
              <View style={styles.list}>
                <SettingsRow
                  icon="people"
                  iconTone="primary"
                  title="Team"
                  sub={teamCount > 0 ? `${teamCount} rider${teamCount === 1 ? "" : "s"}` : "No riders yet"}
                  value={teamCount > 0 ? String(teamCount) : undefined}
                  onPress={() => router.push("/(vendor)/(profile)/team" as never)}
                />
                <SettingsRow
                  icon="business"
                  iconTone="primary"
                  title="Stations"
                  sub={stationCount > 0 ? `${stationCount} station${stationCount === 1 ? "" : "s"}` : "Add your first"}
                  value={stationCount > 0 ? String(stationCount) : undefined}
                  onPress={() =>
                    router.push("/(vendor)/(profile)/stations" as never)
                  }
                />
                <SettingsRow
                  icon="speedometer"
                  iconTone={tankLow > 0 ? "warning" : "primary"}
                  title="Tank levels"
                  sub={
                    tankLow > 0
                      ? `${tankLow} tank${tankLow === 1 ? "" : "s"} below threshold`
                      : tankCount > 0
                        ? "All tanks above threshold"
                        : "Set up tanks"
                  }
                  value={tankCount > 0 ? String(tankCount) : undefined}
                  onPress={() => router.push("/(vendor)/(profile)/tanks" as never)}
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Account</Text>
              <View style={styles.list}>
                <SettingsRow
                  icon="lock-closed"
                  iconTone="neutral"
                  title="Change PIN"
                  onPress={() =>
                    router.push("/(screens)/change-pin" as never)
                  }
                />
                <SettingsRow
                  icon="shield-checkmark"
                  iconTone="neutral"
                  title="Security & privacy"
                  onPress={() =>
                    router.push("/(screens)/security-privacy" as never)
                  }
                />
                <SettingsRow
                  icon="help-circle"
                  iconTone="neutral"
                  title="Help & support"
                  onPress={() =>
                    router.push("/(screens)/help-support" as never)
                  }
                />
                <SettingsRow
                  icon="log-out"
                  destructive
                  title="Sign out"
                  onPress={handleLogout}
                />
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </VendorScreenShell>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    scroll: {
      padding: 20,
      gap: 16,
      paddingBottom: 80,
    },
    identityRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.primaryTint,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      fontSize: 24,
      fontWeight: "800",
      color: theme.primary,
    },
    name: {
      ...theme.type.h2,
      color: theme.fg,
    },
    sub: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    section: {
      gap: 8,
    },
    sectionLabel: {
      ...theme.type.caption,
      color: theme.fgMuted,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      paddingHorizontal: 2,
    },
    list: { gap: 8 },
  });
