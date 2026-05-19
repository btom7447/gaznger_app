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
  AlertChip,
  type AlertTone,
  OrderRow,
  Skel,
  SkelStack,
  TodayHeroCarousel,
  TodayMiniGrid,
  type TodayNextOrder,
  type TodayTeamStatus,
  VendorEmptyState,
  VendorScreenShell,
} from "@/components/ui/vendor";
import { useVendorStationStore } from "@/store/useVendorStationStore";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { type OrderStatus } from "@/components/ui/vendor/OrderRow";

/**
 * Vendor Today — hero layout (v6).
 *
 * Server endpoint: GET /api/vendor/today?stationId=<active>
 * Returns one round-trip with everything the screen renders:
 *   - revenueToday + 3-cell breakdown
 *   - alerts derived from queue + inventory state
 *   - nextOrder + teamStatus mini-grid
 *   - queue preview (last 3 active orders)
 *
 * Refresh strategy:
 *   - Initial fetch on mount + on stationId change
 *   - Pull-to-refresh
 *   - Socket events (`order:new`, `order:update`) trigger a refetch
 *     so the hero stays live without polling.
 */

interface TodayApiAlert {
  id: string;
  tone: AlertTone;
  title: string;
  sub?: string;
  cta?: string;
  route?: string;
}

interface TodayApiQueueRow {
  id: string;
  customer: string;
  fuel: string;
  qty: string;
  price: string;
  status: OrderStatus;
  etaMin?: number | null;
  addr?: string | null;
}

interface TodayApiPerStation {
  stationId: string;
  stationName: string;
  revenueToday: number;
  revenueYesterday: number;
  ordersTotal: number;
  ordersQueue: number;
  ordersInFlight: number;
  ordersDone: number;
}

interface TodayApiResponse {
  stationName: string | null;
  revenueToday: number;
  revenueYesterday: number;
  prevDayLabel: string;
  ordersTotal: number;
  breakdown: {
    ordersQueue: number;
    ordersDone: number;
    ordersInFlight: number;
    bulkInTransit: number;
  };
  perStation: TodayApiPerStation[];
  alerts: TodayApiAlert[];
  nextOrder: TodayApiQueueRow | null;
  teamStatus: TodayTeamStatus;
  queue: TodayApiQueueRow[];
}

export default function VendorTodayScreen() {
  const router = useRouter();
  const theme = useTheme();
  const hasStations = useVendorStationStore(
    (s) => s.stations.length > 0,
  );

  const [data, setData] = useState<TodayApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchToday = useCallback(async () => {
    try {
      // No stationId param — Today is always the all-stations aggregate.
      // Per-station cards live in the carousel.
      const res = await api.get<TodayApiResponse>(
        "/api/vendor/today",
        { timeoutMs: 10_000 },
      );
      setData(res);
    } catch {
      // Non-fatal — keep prior snapshot on transient failure.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial + station-change fetch.
  useEffect(() => {
    setLoading(true);
    fetchToday();
  }, [fetchToday]);

  // Refresh on focus (e.g. coming back from Orders after assigning).
  useFocusEffect(
    useCallback(() => {
      fetchToday();
    }, [fetchToday]),
  );

  // Socket-driven liveness. The vendor app subscribes to order:new
  // and order:update via the existing socket connection; every event
  // triggers a refetch (cheap — single endpoint).
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const refetch = () => {
      fetchToday();
    };
    socket.on("order:new", refetch);
    socket.on("order:update", refetch);
    // Phase 2 — wire new granular vendor events. All three are
    // currently best-served by a refetch (Today is a wide aggregate
    // — splitting would mean granular cache patching across
    // alerts[] + KPIs which isn't worth the churn).
    socket.on("order:rider-assigned", refetch);
    socket.on("order:confirmed", refetch);
    socket.on("order:rejected", refetch);
    socket.on("rating:submitted", refetch);
    socket.on("stock:alert", refetch);
    return () => {
      socket.off("order:new", refetch);
      socket.off("order:update", refetch);
      socket.off("order:rider-assigned", refetch);
      socket.off("order:confirmed", refetch);
      socket.off("order:rejected", refetch);
      socket.off("rating:submitted", refetch);
      socket.off("stock:alert", refetch);
    };
  }, [fetchToday]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchToday();
  }, [fetchToday]);

  const handleAlertPress = useCallback(
    (alert: TodayApiAlert) => {
      if (alert.route) router.push(alert.route as never);
    },
    [router],
  );

  const handleOrderPress = useCallback(
    (orderId: string) => {
      // Order detail lands in Phase 3. For now, route to the Orders
      // tab and let the queue screen surface the detail.
      router.push("/(vendor)/(orders)" as never);
    },
    [router],
  );

  const handleTeamPress = useCallback(() => {
    router.push("/(vendor)/(profile)" as never);
  }, [router]);

  const styles = useMemo(() => makeStyles(theme), [theme]);

  const handleNotifsPress = useCallback(() => {
    // Vendor + customer share the same notifications surface — same UI
    // language, same /api/notifications backend, role-agnostic.
    router.push("/(screens)/notifications-customer" as never);
  }, [router]);

  return (
    <VendorScreenShell
      title="Today"
      hideStationSwitcher
      rightSlot={
        <Pressable
          onPress={handleNotifsPress}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          hitSlop={6}
          style={({ pressed }) => [
            styles.notifsBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons
            name="notifications-outline"
            size={20}
            color={theme.fg}
          />
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
        {loading && !data ? (
          <View style={styles.paddedSlot}>
            <SkelStack gap={14}>
              <Skel height={160} radius={24} />
              <Skel height={56} radius={16} />
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Skel height={130} radius={16} style={{ flex: 1 } as never} />
                <Skel height={130} radius={16} style={{ flex: 1 } as never} />
              </View>
              <Skel height={86} radius={16} />
              <Skel height={86} radius={16} />
            </SkelStack>
          </View>
        ) : !hasStations ? (
          <View style={styles.paddedSlot}>
            <VendorEmptyState
              icon="business-outline"
              headline="No station yet"
              body="Add a station to start receiving orders."
              ctaLabel="Add station"
              onCta={() => router.push("/(vendor)/(profile)" as never)}
            />
          </View>
        ) : !data ? (
          <View style={styles.paddedSlot}>
            <VendorEmptyState
              icon="cloud-offline-outline"
              headline="Couldn't load Today"
              body="Pull down to retry."
            />
          </View>
        ) : (
          <>
            <View style={styles.heroSlot}>
              <TodayHeroCarousel
                aggregate={{
                  revenueToday: data.revenueToday,
                  revenueYesterday: data.revenueYesterday,
                  prevDayLabel: data.prevDayLabel,
                  ordersTotal: data.ordersTotal,
                  ordersQueue: data.breakdown.ordersQueue,
                  ordersInFlight: data.breakdown.ordersInFlight,
                  ordersDone: data.breakdown.ordersDone,
                  eyebrow:
                    data.perStation.length > 0
                      ? "All stations · Today"
                      : "Revenue · Today",
                }}
                perStation={data.perStation.map((s) => ({
                  stationId: s.stationId,
                  revenueToday: s.revenueToday,
                  revenueYesterday: s.revenueYesterday,
                  prevDayLabel: data.prevDayLabel,
                  ordersTotal: s.ordersTotal,
                  ordersQueue: s.ordersQueue,
                  ordersInFlight: s.ordersInFlight,
                  ordersDone: s.ordersDone,
                  eyebrow: `${s.stationName} · Today`,
                }))}
              />
            </View>

            {data.alerts.length > 0 ? (
              <View style={styles.alertsCol}>
                {data.alerts.map((alert) => (
                  <AlertChip
                    key={alert.id}
                    tone={alert.tone}
                    title={alert.title}
                    sub={alert.sub}
                    cta={alert.cta}
                    onPress={alert.route ? () => handleAlertPress(alert) : undefined}
                  />
                ))}
              </View>
            ) : null}

            <View style={styles.gridSlot}>
              <TodayMiniGrid
                nextOrder={data.nextOrder as TodayNextOrder | null}
                team={data.teamStatus}
                onNextOrderPress={handleOrderPress}
                onTeamPress={handleTeamPress}
              />
            </View>

            <View style={styles.queueWrap}>
              <Text style={styles.queueLabel}>In queue</Text>
              {data.queue.length === 0 ? (
                <VendorEmptyState
                  icon="checkmark-done-outline"
                  iconTone="success"
                  headline="All caught up"
                  body="No orders in flight."
                />
              ) : (
                <View style={styles.queueList}>
                  {data.queue.map((row) => (
                    <OrderRow
                      key={row.id}
                      customer={row.customer}
                      fuel={row.fuel}
                      qty={row.qty}
                      price={row.price}
                      status={row.status}
                      etaMin={row.etaMin}
                      addr={row.addr ?? undefined}
                      onPress={() => handleOrderPress(row.id)}
                    />
                  ))}
                </View>
              )}
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
      paddingTop: 8,
      paddingBottom: 80,
      gap: 14,
    },
    notifsBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.bgMuted,
    },
    // The carousel needs to bleed to the screen's left edge so cards
    // align with the 20pt rail used by the rest of the screen. We add
    // paddingLeft here; the carousel itself handles the right peek.
    heroSlot: {
      paddingLeft: 20,
    },
    gridSlot: {
      paddingHorizontal: 20,
    },
    paddedSlot: {
      paddingHorizontal: 20,
    },
    alertsCol: {
      gap: 8,
      paddingHorizontal: 20,
    },
    queueWrap: {
      gap: 10,
      marginTop: 8,
      paddingHorizontal: 20,
    },
    queueLabel: {
      ...theme.type.caption,
      color: theme.fgMuted,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      paddingHorizontal: 2,
    },
    queueList: { gap: 10 },
  });
