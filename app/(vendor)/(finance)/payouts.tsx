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
  VendorCard,
  VendorEmptyState,
  VendorPill,
  type PillTone,
  VendorScreenShell,
} from "@/components/ui/vendor";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";

interface PayoutRow {
  id: string;
  amount: number;
  amountFormatted: string;
  status: "pending" | "approved" | "rejected" | "processing" | "failed";
  bankName: string;
  accountNumber: string | null;
  processedAt: string | null;
  createdAt: string;
}

interface PayoutsApiResponse {
  payouts: PayoutRow[];
  total: number;
  page: number;
  pages: number;
}

const STATUS_TONE: Record<PayoutRow["status"], PillTone> = {
  pending: "warning",
  approved: "info",
  processing: "primary",
  rejected: "error",
  failed: "error",
};

const STATUS_LABEL: Record<PayoutRow["status"], string> = {
  pending: "Pending",
  approved: "Approved",
  processing: "Processing",
  rejected: "Rejected",
  failed: "Failed",
};

const STATUS_DOT: Record<PayoutRow["status"], "primary" | "success" | "error"> =
  {
    pending: "primary",
    approved: "primary",
    processing: "primary",
    rejected: "error",
    failed: "error",
  };

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function PayoutsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [data, setData] = useState<PayoutsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const fetch = useCallback(async () => {
    try {
      const res = await api.get<PayoutsApiResponse>(
        "/api/vendor/payouts?limit=50",
        { timeoutMs: 12_000 },
      );
      setData(res);
    } catch {
      // keep prior
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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

  // The next scheduled / approved-but-not-paid payout, if any. Drives
  // the primary-tinted card up top.
  const nextPayout = data?.payouts.find(
    (p) => p.status === "approved" || p.status === "pending",
  );

  return (
    <VendorScreenShell
      title="Payouts"
      rightSlot={
        <Pressable
          onPress={() => router.push("/(vendor)/(finance)/banks" as never)}
          accessibilityRole="button"
          accessibilityLabel="Manage banks"
          hitSlop={6}
          style={({ pressed }) => [
            styles.iconBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons name="card" size={18} color={theme.fg} />
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
          <Text style={styles.backText}>Back to finance</Text>
        </Pressable>

        {loading && !data ? (
          <SkelStack gap={10}>
            <Skel height={86} radius={16} />
            <Skel height={86} radius={16} />
            <Skel height={86} radius={16} />
          </SkelStack>
        ) : !data || data.payouts.length === 0 ? (
          <VendorEmptyState
            icon="paper-plane-outline"
            headline="No payouts yet"
            body="Withdraw to your bank to see history here."
            ctaLabel="Withdraw"
            onCta={() =>
              router.push("/(vendor)/(finance)/withdraw" as never)
            }
          />
        ) : (
          <>
            {/* Daily schedule explainer */}
            <VendorCard>
              <View style={styles.scheduleRow}>
                <View style={styles.scheduleIconWrap}>
                  <Ionicons name="refresh" size={20} color={theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.scheduleTitle}>Instant payouts</Text>
                  <Text style={styles.scheduleSub}>
                    Settled wallet balance lands in your bank within 60 sec.
                  </Text>
                </View>
              </View>
            </VendorCard>

            {/* Next payout (primary-tinted) */}
            {nextPayout ? (
              <VendorCard tone="primary">
                <View style={styles.scheduleRow}>
                  <View style={styles.nextIconWrap}>
                    <Ionicons name="paper-plane" size={18} color="#fff" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.nextEyebrow}>Next payout</Text>
                    <Text style={styles.nextAmount} numberOfLines={1}>
                      {nextPayout.amountFormatted}
                    </Text>
                    <Text style={styles.nextSub} numberOfLines={1}>
                      {STATUS_LABEL[nextPayout.status]} ·{" "}
                      {nextPayout.bankName}
                      {nextPayout.accountNumber
                        ? ` ••${nextPayout.accountNumber.slice(-4)}`
                        : ""}
                    </Text>
                  </View>
                </View>
              </VendorCard>
            ) : null}

            <Text style={styles.sectionHeader}>History</Text>
            <VendorCard noPadding>
              {data.payouts.map((p, i, arr) => (
                <PayoutListRow
                  key={p.id}
                  payout={p}
                  last={i === arr.length - 1}
                  onPress={() =>
                    router.push(
                      `/(vendor)/(finance)/payout/${p.id}` as never,
                    )
                  }
                />
              ))}
            </VendorCard>
          </>
        )}
      </ScrollView>
    </VendorScreenShell>
  );
}

function PayoutListRow({
  payout,
  last,
  onPress,
}: {
  payout: PayoutRow;
  last?: boolean;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const dotColor =
    STATUS_DOT[payout.status] === "error"
      ? theme.error
      : STATUS_DOT[payout.status] === "success"
        ? theme.success
        : theme.primary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${payout.amountFormatted} to ${payout.bankName}, ${STATUS_LABEL[payout.status]}`}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 14,
          paddingVertical: 14,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: theme.divider,
        },
        pressed && { opacity: 0.92 },
      ]}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          backgroundColor: dotColor,
        }}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Text
            style={{
              ...theme.type.body,
              color: theme.fg,
              fontWeight: "800",
              flexShrink: 1,
            }}
            numberOfLines={1}
          >
            {payout.amountFormatted}
          </Text>
          <VendorPill tone={STATUS_TONE[payout.status]} size="sm">
            {STATUS_LABEL[payout.status]}
          </VendorPill>
        </View>
        <Text
          style={{
            ...theme.type.bodySm,
            color: theme.fgMuted,
            marginTop: 2,
          }}
          numberOfLines={1}
        >
          {fmtDate(payout.processedAt ?? payout.createdAt)} ·{" "}
          {payout.bankName}
          {payout.accountNumber
            ? ` ••${payout.accountNumber.slice(-4)}`
            : ""}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={theme.fgSubtle} />
    </Pressable>
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
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.bgMuted,
    },
    scheduleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    scheduleIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: theme.primaryTint,
      alignItems: "center",
      justifyContent: "center",
    },
    scheduleTitle: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "800",
    },
    scheduleSub: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      marginTop: 2,
    },
    nextIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 11,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    nextEyebrow: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.primary,
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },
    nextAmount: {
      fontSize: 22,
      fontWeight: "800",
      color: theme.primary,
      marginTop: 2,
    },
    nextSub: {
      ...theme.type.bodySm,
      color: theme.primary,
      opacity: 0.85,
      marginTop: 2,
    },
    sectionHeader: {
      ...theme.type.caption,
      color: theme.fgMuted,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginTop: 4,
      paddingHorizontal: 2,
    },
  });
