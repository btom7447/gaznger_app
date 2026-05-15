import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import {
  FilterPills,
  type FilterPillOption,
  OrderRow,
  type OrderStatus,
  Skel,
  SkelStack,
  VendorEmptyState,
  VendorScreenShell,
} from "@/components/ui/vendor";
import { useVendorStationStore } from "@/store/useVendorStationStore";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";

/**
 * Vendor Orders queue (v6).
 *
 * 3 filter pills: All / New / In-flight.
 *   - All:       every status (default)
 *   - New:       pending | confirmed — needs a rider
 *   - In-flight: assigned through awaiting_confirmation
 *
 * Live updates: order:new and order:update sockets refetch.
 */

type FilterValue = "all" | "new" | "in-flight";

interface OrderApiRow {
  id: string;
  customer: string;
  phone: string | null;
  fuel: string;
  qty: string;
  price: string;
  priceKobo: number;
  status: OrderStatus;
  addr: string | null;
  riderId: string | null;
  createdAt: string;
  stationName: string | null;
  etaMin: number | null;
}

interface OrdersApiResponse {
  orders: OrderApiRow[];
  total: number;
  page: number;
  pages: number;
}

const FILTERS: FilterPillOption<FilterValue>[] = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "in-flight", label: "In-flight" },
];

export default function VendorOrdersScreen() {
  const router = useRouter();
  const theme = useTheme();
  const activeStationId = useVendorStationStore((s) => s.activeStationId);

  const [filter, setFilter] = useState<FilterValue>("all");
  const [data, setData] = useState<OrdersApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!activeStationId) {
      setLoading(false);
      return;
    }
    try {
      const params = new URLSearchParams({
        stationId: activeStationId,
        filter,
        limit: "30",
      });
      const res = await api.get<OrdersApiResponse>(
        `/api/vendor/orders?${params.toString()}`,
        { timeoutMs: 12_000 },
      );
      setData(res);
    } catch {
      // Non-fatal — keep prior snapshot on transient failure.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeStationId, filter]);

  // Initial + filter/station change.
  useEffect(() => {
    setLoading(true);
    fetchOrders();
  }, [fetchOrders]);

  // Refocus refetch.
  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, [fetchOrders]),
  );

  // Socket-driven liveness.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const refetch = () => fetchOrders();
    socket.on("order:new", refetch);
    socket.on("order:update", refetch);
    return () => {
      socket.off("order:new", refetch);
      socket.off("order:update", refetch);
    };
  }, [fetchOrders]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOrders();
  }, [fetchOrders]);

  const handleOrderPress = useCallback(
    (orderId: string) => {
      router.push(`/(vendor)/(orders)/${orderId}` as never);
    },
    [router],
  );

  const styles = useMemo(() => makeStyles(theme), [theme]);

  const filtersWithCounts: FilterPillOption<FilterValue>[] = useMemo(() => {
    if (!data) return FILTERS;
    return FILTERS.map((f) => ({
      ...f,
      count: f.value === filter ? data.total : undefined,
    }));
  }, [data, filter]);

  return (
    <VendorScreenShell title="Orders">
      <View style={styles.filterRow}>
        <FilterPills<FilterValue>
          value={filter}
          options={filtersWithCounts}
          onChange={setFilter}
        />
      </View>

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
          <SkelStack gap={10}>
            <Skel height={84} radius={16} />
            <Skel height={84} radius={16} />
            <Skel height={84} radius={16} />
            <Skel height={84} radius={16} />
          </SkelStack>
        ) : !activeStationId ? (
          <VendorEmptyState
            icon="business-outline"
            headline="No station yet"
            body="Add a station to start receiving orders."
            ctaLabel="Add station"
            onCta={() => router.push("/(vendor)/(profile)" as never)}
          />
        ) : !data || data.orders.length === 0 ? (
          <VendorEmptyState
            icon="list-outline"
            headline={
              filter === "all"
                ? "No orders yet"
                : filter === "new"
                  ? "Nothing new"
                  : "Nothing in flight"
            }
            body={
              filter === "all"
                ? "Orders will land here when customers buy."
                : filter === "new"
                  ? "All caught up. New orders show here."
                  : "When riders are en route they show here."
            }
          />
        ) : (
          <View style={styles.list}>
            {data.orders.map((row) => (
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
      </ScrollView>
    </VendorScreenShell>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    filterRow: {
      paddingHorizontal: 20,
      paddingTop: 6,
      paddingBottom: 8,
    },
    scroll: {
      padding: 20,
      paddingTop: 4,
      gap: 10,
      paddingBottom: 80,
    },
    list: { gap: 10 },
  });
