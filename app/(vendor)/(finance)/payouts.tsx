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

  return (
    <VendorScreenShell
      title="Payouts"
      rightSlot={
        <Pressable
          onPress={() => router.push("/(vendor)/(finance)/withdraw" as never)}
          accessibilityRole="button"
          accessibilityLabel="New withdraw"
          hitSlop={6}
          style={({ pressed }) => [
            styles.newBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons name="add" size={16} color={theme.fgOnPrimary} />
          <Text style={styles.newBtnText}>Withdraw</Text>
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
          <View style={styles.list}>
            {data.payouts.map((p) => (
              <Pressable
                key={p.id}
                onPress={() =>
                  router.push(`/(vendor)/(finance)/payout/${p.id}` as never)
                }
                accessibilityRole="button"
                accessibilityLabel={`${p.amountFormatted} to ${p.bankName}, ${STATUS_LABEL[p.status]}`}
                style={({ pressed }) => [
                  styles.card,
                  pressed && { opacity: 0.92 },
                ]}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name="paper-plane" size={18} color={theme.primary} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.headerRow}>
                    <Text style={styles.amount} numberOfLines={1}>
                      {p.amountFormatted}
                    </Text>
                    <VendorPill tone={STATUS_TONE[p.status]} size="sm" dot>
                      {STATUS_LABEL[p.status]}
                    </VendorPill>
                  </View>
                  <Text style={styles.sub} numberOfLines={1}>
                    {p.bankName}
                    {p.accountNumber ? `  ·  ${p.accountNumber}` : ""}
                  </Text>
                  <Text style={styles.date}>
                    {fmtDate(p.processedAt ?? p.createdAt)}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={theme.fgSubtle}
                />
              </Pressable>
            ))}
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
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: theme.primaryTint,
      alignItems: "center",
      justifyContent: "center",
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    amount: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "800",
      flexShrink: 1,
    },
    sub: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    date: {
      ...theme.type.caption,
      color: theme.fgSubtle,
    },
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
