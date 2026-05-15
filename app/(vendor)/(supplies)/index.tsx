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
  BulkInFlightCard,
  FilterPills,
  type FilterPillOption,
  Skel,
  SkelStack,
  VendorEmptyState,
  VendorScreenShell,
} from "@/components/ui/vendor";
import { useVendorStationStore } from "@/store/useVendorStationStore";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";

type FilterValue = "in-flight" | "history";

interface BulkApiRow {
  id: string;
  plantName: string;
  product: string;
  qty: string;
  totalCost: number;
  totalCostFormatted: string;
  status: "pending" | "confirmed" | "in-transit" | "delivered" | "cancelled";
  step: string | null;
  stepIndex: number;
  stepLabel: string | null;
  progressPct: number;
  truckPlate: string | null;
  estimatedDelivery: string | null;
  stationName: string | null;
  createdAt: string;
}

interface BulkApiResponse {
  orders: BulkApiRow[];
  total: number;
  page: number;
  pages: number;
}

const FILTERS: FilterPillOption<FilterValue>[] = [
  { value: "in-flight", label: "In flight" },
  { value: "history", label: "History" },
];

export default function VendorSuppliesScreen() {
  const router = useRouter();
  const theme = useTheme();
  const activeStationId = useVendorStationStore((s) => s.activeStationId);

  const [filter, setFilter] = useState<FilterValue>("in-flight");
  const [data, setData] = useState<BulkApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const styles = useMemo(() => makeStyles(theme), [theme]);

  const fetch = useCallback(async () => {
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
      const res = await api.get<BulkApiResponse>(
        `/api/vendor/bulk-purchases?${params.toString()}`,
        { timeoutMs: 12_000 },
      );
      setData(res);
    } catch {
      // Keep prior snapshot on transient failure.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeStationId, filter]);

  useEffect(() => {
    setLoading(true);
    fetch();
  }, [fetch]);

  useFocusEffect(
    useCallback(() => {
      fetch();
    }, [fetch]),
  );

  // Live updates — every bulk:update event refetches.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const refetch = () => fetch();
    socket.on("bulk:update", refetch);
    return () => {
      socket.off("bulk:update", refetch);
    };
  }, [fetch]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetch();
  }, [fetch]);

  const handleNew = useCallback(() => {
    router.push("/(vendor)/(supplies)/new" as never);
  }, [router]);

  const handleOpen = useCallback(
    (id: string) => {
      router.push(`/(vendor)/(supplies)/${id}` as never);
    },
    [router],
  );

  return (
    <VendorScreenShell
      title="Supplies"
      rightSlot={
        <Pressable
          onPress={handleNew}
          accessibilityRole="button"
          accessibilityLabel="New bulk purchase"
          hitSlop={6}
          style={({ pressed }) => [
            styles.newBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons name="add" size={16} color={theme.fgOnPrimary} />
          <Text style={styles.newBtnText}>New</Text>
        </Pressable>
      }
    >
      <View style={styles.filterRow}>
        <FilterPills<FilterValue>
          value={filter}
          options={FILTERS}
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
            <Skel height={130} radius={16} />
            <Skel height={130} radius={16} />
            <Skel height={130} radius={16} />
          </SkelStack>
        ) : !activeStationId ? (
          <VendorEmptyState
            icon="business-outline"
            headline="No station yet"
            body="Add a station to start buying bulk."
            ctaLabel="Add station"
            onCta={() => router.push("/(vendor)/(profile)" as never)}
          />
        ) : !data || data.orders.length === 0 ? (
          <VendorEmptyState
            icon="cube-outline"
            headline={
              filter === "in-flight"
                ? "Nothing in flight"
                : "No history yet"
            }
            body={
              filter === "in-flight"
                ? "Tap New to order fuel from a depot."
                : "Closed purchases show up here."
            }
            ctaLabel={filter === "in-flight" ? "New purchase" : undefined}
            onCta={filter === "in-flight" ? handleNew : undefined}
          />
        ) : (
          <View style={styles.list}>
            {data.orders.map((row) => (
              <BulkInFlightCard
                key={row.id}
                plantName={row.plantName}
                product={row.product}
                qty={row.qty}
                totalCostFormatted={row.totalCostFormatted}
                stepLabel={row.stepLabel}
                progressPct={row.progressPct}
                status={row.status}
                truckPlate={row.truckPlate}
                onPress={() => handleOpen(row.id)}
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
    newBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.primary,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: theme.radius.pill,
    },
    newBtnText: {
      ...theme.type.bodySm,
      color: theme.fgOnPrimary,
      fontWeight: "800",
    },
  });
