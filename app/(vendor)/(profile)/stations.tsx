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
import { useRouter, useFocusEffect } from "expo-router";
import {
  Skel,
  SkelStack,
  VendorEmptyState,
  VendorPill,
  VendorScreenShell,
} from "@/components/ui/vendor";
import {
  useVendorStationStore,
  type VendorStationLite,
} from "@/store/useVendorStationStore";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";

interface StationApiRow {
  _id: string;
  name: string;
  address: string;
  state: string;
  lga?: string;
  isActive: boolean;
  verified: boolean;
}

export default function VendorStationsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const setStoreStations = useVendorStationStore((s) => s.setStations);
  const activeStationId = useVendorStationStore((s) => s.activeStationId);

  const [stations, setStations] = useState<StationApiRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const styles = useMemo(() => makeStyles(theme), [theme]);

  const fetchStations = useCallback(async () => {
    try {
      const res = await api.get<{ stations: StationApiRow[] }>(
        "/api/vendor/stations",
        { timeoutMs: 10_000 },
      );
      setStations(res.stations ?? []);
      const list: VendorStationLite[] = (res.stations ?? []).map((s) => ({
        id: s._id,
        name: s.name,
      }));
      setStoreStations(list);
    } catch {
      // keep prior
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setStoreStations]);

  useEffect(() => {
    setLoading(true);
    fetchStations();
  }, [fetchStations]);

  useFocusEffect(
    useCallback(() => {
      fetchStations();
    }, [fetchStations]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStations();
  }, [fetchStations]);

  return (
    <VendorScreenShell
      title="Stations"
      rightSlot={
        <Pressable
          onPress={() => router.push("/(vendor)/(profile)/station-add" as never)}
          accessibilityRole="button"
          accessibilityLabel="Add station"
          hitSlop={6}
          style={({ pressed }) => [
            styles.addBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons name="add" size={16} color={theme.fgOnPrimary} />
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      }
    >
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
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={6}
          style={({ pressed }) => [
            styles.backRow,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons name="chevron-back" size={18} color={theme.fgMuted} />
          <Text style={styles.backText}>Back to profile</Text>
        </Pressable>

        {loading && !stations ? (
          <SkelStack gap={10}>
            <Skel height={92} radius={16} />
            <Skel height={92} radius={16} />
          </SkelStack>
        ) : !stations || stations.length === 0 ? (
          <VendorEmptyState
            icon="business-outline"
            headline="No stations yet"
            body="Add your first station to start receiving orders."
            ctaLabel="Add station"
            onCta={() =>
              router.push("/(vendor)/(profile)/station-add" as never)
            }
          />
        ) : (
          <View style={styles.list}>
            {stations.map((s) => {
              const isActive = s._id === activeStationId;
              return (
                <Pressable
                  key={s._id}
                  onPress={() =>
                    router.push(`/(vendor)/(profile)/station/${s._id}` as never)
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${s.name}`}
                  style={({ pressed }) => [
                    styles.card,
                    isActive && { borderColor: theme.primary, borderWidth: 2 },
                    pressed && { opacity: 0.92 },
                  ]}
                >
                  <View style={styles.iconWrap}>
                    <Ionicons name="business" size={18} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={styles.titleRow}>
                      <Text style={styles.name} numberOfLines={1}>
                        {s.name}
                      </Text>
                      {s.verified ? (
                        <VendorPill tone="success" size="sm">
                          Verified
                        </VendorPill>
                      ) : null}
                      {!s.isActive ? (
                        <VendorPill tone="neutral" size="sm">
                          Closed
                        </VendorPill>
                      ) : null}
                      {isActive ? (
                        <VendorPill tone="primary" size="sm" dot>
                          Active
                        </VendorPill>
                      ) : null}
                    </View>
                    <Text style={styles.addr} numberOfLines={1}>
                      {s.address}
                    </Text>
                    <Text style={styles.sub} numberOfLines={1}>
                      {[s.lga, s.state].filter(Boolean).join(", ")}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={theme.fgSubtle}
                  />
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </VendorScreenShell>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    scroll: {
      padding: 20,
      gap: 14,
      paddingBottom: 80,
    },
    backRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginBottom: -4,
    },
    backText: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      fontWeight: "600",
    },
    list: { gap: 10 },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.primaryTint,
      alignItems: "center",
      justifyContent: "center",
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
    },
    name: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
      flexShrink: 1,
    },
    addr: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    sub: {
      ...theme.type.caption,
      color: theme.fgSubtle,
    },
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.primary,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: theme.radius.pill,
    },
    addBtnText: {
      ...theme.type.bodySm,
      color: theme.fgOnPrimary,
      fontWeight: "800",
    },
  });
