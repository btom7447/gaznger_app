import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import {
  AlertChip,
  type AlertTone,
  OrderRow,
  Skel,
  SkelStack,
  TodayHeroCard,
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

interface TodayApiResponse {
  stationName: string | null;
  revenueToday: number;
  breakdown: {
    ordersDone: number;
    ordersInFlight: number;
    bulkInTransit: number;
  };
  alerts: TodayApiAlert[];
  nextOrder: TodayApiQueueRow | null;
  teamStatus: TodayTeamStatus;
  queue: TodayApiQueueRow[];
}

export default function VendorTodayScreen() {
  const router = useRouter();
  const theme = useTheme();
  const activeStationId = useVendorStationStore((s) => s.activeStationId);

  const [data, setData] = useState<TodayApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchToday = useCallback(async () => {
    if (!activeStationId) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get<TodayApiResponse>(
        `/api/vendor/today?stationId=${encodeURIComponent(activeStationId)}`,
        { timeoutMs: 10_000 },
      );
      setData(res);
    } catch {
      // Non-fatal — keep prior snapshot on transient failure.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeStationId]);

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
    return () => {
      socket.off("order:new", refetch);
      socket.off("order:update", refetch);
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

  return (
    <VendorScreenShell title="Today">
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
        ) : !activeStationId ? (
          <VendorEmptyState
            icon="business-outline"
            headline="No station yet"
            body="Add a station to start receiving orders."
            ctaLabel="Add station"
            onCta={() => router.push("/(vendor)/(profile)" as never)}
          />
        ) : !data ? (
          <VendorEmptyState
            icon="cloud-offline-outline"
            headline="Couldn't load Today"
            body="Pull down to retry."
          />
        ) : (
          <>
            <TodayHeroCard
              revenueToday={data.revenueToday}
              ordersDone={data.breakdown.ordersDone}
              ordersInFlight={data.breakdown.ordersInFlight}
              bulkInTransit={data.breakdown.bulkInTransit}
              stationName={data.stationName}
            />

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

            <TodayMiniGrid
              nextOrder={data.nextOrder as TodayNextOrder | null}
              team={data.teamStatus}
              onNextOrderPress={handleOrderPress}
              onTeamPress={handleTeamPress}
            />

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
      padding: 20,
      gap: 14,
      paddingBottom: 80,
    },
    alertsCol: {
      gap: 8,
    },
    queueWrap: {
      gap: 10,
      marginTop: 8,
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
