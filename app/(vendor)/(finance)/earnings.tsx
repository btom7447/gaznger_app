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
  /** Sum across the same-length window immediately before this one. */
  prevTotal?: number;
  breakdown: { label: string; value: number }[];
}

interface PeriodOption {
  value: Period;
  label: string;
}

const PERIODS: PeriodOption[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
];

const PREV_LABEL: Record<Period, string> = {
  today: "vs yesterday",
  week: "vs last week",
  month: "vs last month",
};

function fmtNaira(n: number): string {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

export default function EarningsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [period, setPeriod] = useState<Period>("week");
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

  // Delta vs previous same-length window. Server returns prevTotal — if
  // missing we render 0% and skip the comparison line.
  const prevTotal = data?.prevTotal ?? 0;
  const delta =
    data && prevTotal > 0
      ? ((data.total - prevTotal) / prevTotal) * 100
      : null;

  const breakdownTotal = useMemo(
    () => (data?.breakdown ?? []).reduce((acc, b) => acc + b.value, 0),
    [data?.breakdown],
  );

  return (
    <VendorScreenShell title="Earnings" hideStationSwitcher>
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

      <View style={styles.segmentedWrap}>
        <View style={styles.segmented}>
          {PERIODS.map((p) => {
            const active = p.value === period;
            return (
              <Pressable
                key={p.value}
                onPress={() => setPeriod(p.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={p.label}
                style={({ pressed }) => [
                  styles.segment,
                  active && styles.segmentActive,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    active && styles.segmentTextActive,
                  ]}
                >
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
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
            <Skel height={220} radius={16} />
            <Skel height={140} radius={16} />
            <Skel height={140} radius={16} />
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
              <Text style={styles.heroEyebrow}>
                Revenue · {periodLabelFor(period)}
              </Text>
              <Text
                style={styles.heroAmount}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {fmtNaira(data.total)}
              </Text>
              {delta !== null ? (
                <Text
                  style={[
                    styles.heroDelta,
                    {
                      color: delta >= 0 ? theme.success : theme.error,
                    },
                  ]}
                >
                  {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%{" "}
                  {PREV_LABEL[period]}
                </Text>
              ) : (
                <Text style={styles.heroDeltaMuted}>
                  {PREV_LABEL[period]} — no prior data
                </Text>
              )}
              <View style={styles.chartWrap}>
                <BarChart buckets={data.buckets} />
              </View>
            </VendorCard>

            {data.breakdown.length > 0 ? (
              <View>
                <Text style={styles.sectionHeader}>By product</Text>
                <VendorCard>
                  {data.breakdown.map((b, i, arr) => (
                    <ProductRow
                      key={b.label}
                      label={b.label}
                      value={b.value}
                      pct={
                        breakdownTotal > 0
                          ? Math.round((b.value / breakdownTotal) * 100)
                          : 0
                      }
                      last={i === arr.length - 1}
                    />
                  ))}
                </VendorCard>
              </View>
            ) : null}

            <AlertChip
              tone="info"
              icon="information-circle"
              title="Earnings are revenue after Gaznger fees"
              sub="Bulk-purchase costs and tank top-ups aren't deducted here — see the P&L report in the admin web."
            />
          </>
        )}
      </ScrollView>
    </VendorScreenShell>
  );
}

function periodLabelFor(p: Period): string {
  return p === "today"
    ? "today"
    : p === "week"
      ? "this week"
      : "this month";
}

function ProductRow({
  label,
  value,
  pct,
  last,
}: {
  label: string;
  value: number;
  pct: number;
  last?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        paddingBottom: last ? 0 : 12,
        marginBottom: last ? 0 : 12,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: theme.divider,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <Text
          style={{
            ...theme.type.body,
            color: theme.fg,
            fontWeight: "700",
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
        <View
          style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}
        >
          <Text
            style={{
              ...theme.type.body,
              color: theme.fg,
              fontWeight: "800",
            }}
          >
            {`₦${Math.round(value).toLocaleString("en-NG")}`}
          </Text>
          <Text
            style={{
              ...theme.type.bodySm,
              color: theme.fgMuted,
              fontWeight: "700",
            }}
          >
            {pct}%
          </Text>
        </View>
      </View>
      <View
        style={{
          height: 6,
          backgroundColor: theme.bgMuted,
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${Math.max(3, pct)}%`,
            height: "100%",
            backgroundColor: theme.primary,
            borderRadius: 999,
          }}
        />
      </View>
    </View>
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
    segmentedWrap: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 6,
    },
    segmented: {
      flexDirection: "row",
      gap: 4,
      padding: 4,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.divider,
    },
    segment: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    segmentActive: {
      backgroundColor: theme.primary,
    },
    segmentText: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      fontWeight: "800",
    },
    segmentTextActive: {
      color: theme.fgOnPrimary,
    },
    scroll: {
      padding: 20,
      paddingTop: 8,
      gap: 14,
      paddingBottom: 80,
    },
    heroEyebrow: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.fgMuted,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    heroAmount: {
      fontSize: 32,
      fontWeight: "800",
      letterSpacing: -0.5,
      color: theme.fg,
      marginTop: 4,
    },
    heroDelta: {
      ...theme.type.bodySm,
      fontWeight: "800",
      marginTop: 2,
    },
    heroDeltaMuted: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      fontWeight: "600",
      marginTop: 2,
    },
    chartWrap: {
      marginTop: 16,
    },
    sectionHeader: {
      ...theme.type.caption,
      color: theme.fgMuted,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginBottom: 8,
      paddingHorizontal: 2,
    },
  });
