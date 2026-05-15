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
  FilterPills,
  type FilterPillOption,
  Skel,
  SkelStack,
  TxRow,
  VendorEmptyState,
  VendorScreenShell,
} from "@/components/ui/vendor";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";

type TxFilter = "all" | "orders" | "bulk" | "payouts" | "topups";

interface TxApiRow {
  id: string;
  dateIso: string;
  kind: string;
  type: string;
  description: string;
  amount: number;
  amountFormatted: string;
  signed: "credit" | "debit";
  state: "pending" | "available";
}

interface TxApiResponse {
  transactions: TxApiRow[];
  total: number;
  page: number;
  pages: number;
}

const FILTERS: FilterPillOption<TxFilter>[] = [
  { value: "all", label: "All" },
  { value: "orders", label: "Orders" },
  { value: "bulk", label: "Bulk" },
  { value: "payouts", label: "Payouts" },
  { value: "topups", label: "Top-ups" },
];

export default function VendorTransactionsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [filter, setFilter] = useState<TxFilter>("all");
  const [data, setData] = useState<TxApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const fetch = useCallback(async () => {
    try {
      const res = await api.get<TxApiResponse>(
        `/api/vendor/transactions?filter=${filter}&limit=50`,
        { timeoutMs: 12_000 },
      );
      setData(res);
    } catch {
      // keep prior
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    fetch();
  }, [fetch]);

  useFocusEffect(
    useCallback(() => {
      fetch();
    }, [fetch]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetch();
  }, [fetch]);

  return (
    <VendorScreenShell title="Activity">
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
        <Text style={styles.backText}>Back to finance</Text>
      </Pressable>

      <View style={styles.filterRow}>
        <FilterPills<TxFilter>
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
          <SkelStack gap={8}>
            <Skel height={64} radius={16} />
            <Skel height={64} radius={16} />
            <Skel height={64} radius={16} />
            <Skel height={64} radius={16} />
          </SkelStack>
        ) : !data || data.transactions.length === 0 ? (
          <VendorEmptyState
            icon="receipt-outline"
            headline={
              filter === "all"
                ? "No transactions yet"
                : "Nothing here"
            }
            body={
              filter === "all"
                ? "Earnings, payouts, and top-ups show up here."
                : "Switch filter to see other activity."
            }
          />
        ) : (
          <View style={styles.list}>
            {data.transactions.map((tx) => (
              <TxRow
                key={tx.id}
                description={tx.description}
                type={tx.type}
                kind={tx.kind}
                dateIso={tx.dateIso}
                amount={tx.amount}
                amountFormatted={tx.amountFormatted}
                signed={tx.signed}
                state={tx.state}
                onPress={() =>
                  router.push(
                    `/(vendor)/(finance)/transaction/${tx.id}` as never,
                  )
                }
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
    backRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 20,
      paddingTop: 4,
    },
    backText: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      fontWeight: "600",
    },
    filterRow: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 4,
    },
    scroll: {
      padding: 20,
      paddingTop: 8,
      gap: 8,
      paddingBottom: 80,
    },
    list: { gap: 8 },
  });
