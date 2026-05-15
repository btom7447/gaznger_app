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
import { useRouter } from "expo-router";
import { toast } from "sonner-native";
import {
  AlertChip,
  BarChart,
  FilterPills,
  type FilterPillOption,
  Skel,
  SkelStack,
  VendorCard,
  VendorEmptyState,
  VendorScreenShell,
} from "@/components/ui/vendor";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";

type Period = "today" | "week" | "month";

interface EarningsApiResponse {
  period: Period;
  buckets: { label: string; value: number }[];
  total: number;
  periodAvg: number;
  breakdown: { label: string; value: number }[];
}

const PERIODS: FilterPillOption<Period>[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

function fmtNaira(n: number): string {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

export default function EarningsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [period, setPeriod] = useState<Period>("today");
  const [data, setData] = useState<EarningsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);

  const styles = useMemo(() => makeStyles(theme), [theme]);

  const fetch = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      try {
        const res = await api.get<EarningsApiResponse>(
          `/api/vendor/earnings/periods?period=${period}`,
          { timeoutMs: 10_000 },
        );
        setData(res);
        setHasError(false);
      } catch (err: any) {
        if (!opts.silent) {
          toast.error(err?.message ?? "Couldn't load earnings");
        }
        setHasError(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [period],
  );

  useEffect(() => {
    setLoading(true);
    fetch({ silent: true });
  }, [fetch]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetch();
  }, [fetch]);

  return (
    <VendorScreenShell title="Earnings">
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
        <FilterPills<Period>
          value={period}
          options={PERIODS}
          onChange={setPeriod}
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
          <SkelStack gap={12}>
            <Skel height={180} radius={16} />
            <Skel height={120} radius={16} />
          </SkelStack>
        ) : !data ? (
          <VendorEmptyState
            icon="cloud-offline-outline"
            iconTone="error"
            headline="Couldn't load earnings"
            body="Check your connection and try again."
            ctaLabel="Retry"
            onCta={() => {
              setLoading(true);
              fetch();
            }}
          />
        ) : (
          <>
            {hasError ? (
              <AlertChip
                tone="warning"
                title="Showing last known data"
                sub="Pull to refresh once you're back online."
              />
            ) : null}
            <VendorCard>
              <Text style={styles.cardLabel}>Total</Text>
              <Text
                style={styles.total}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {fmtNaira(data.total)}
              </Text>
              <Text style={styles.avg}>
                Avg / bucket: {fmtNaira(data.periodAvg)}
              </Text>
              <View style={styles.chartWrap}>
                <BarChart buckets={data.buckets} />
              </View>
            </VendorCard>

            {data.breakdown.length > 0 ? (
              <VendorCard>
                <Text style={styles.cardLabel}>By product</Text>
                <View style={styles.breakdownList}>
                  {data.breakdown.map((b) => (
                    <View key={b.label} style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel} numberOfLines={1}>
                        {b.label}
                      </Text>
                      <Text style={styles.breakdownValue} numberOfLines={1}>
                        {fmtNaira(b.value)}
                      </Text>
                    </View>
                  ))}
                </View>
              </VendorCard>
            ) : null}
          </>
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
      gap: 14,
      paddingBottom: 80,
    },
    cardLabel: {
      ...theme.type.caption,
      color: theme.fgMuted,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginBottom: 8,
    },
    total: {
      fontSize: 32,
      fontWeight: "800",
      letterSpacing: -0.6,
      color: theme.fg,
    },
    avg: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      marginTop: 2,
    },
    chartWrap: {
      marginTop: 14,
    },
    breakdownList: { gap: 10 },
    breakdownRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    breakdownLabel: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
    },
    breakdownValue: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "800",
    },
  });
