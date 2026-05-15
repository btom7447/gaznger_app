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
  SettingsRow,
  Skel,
  SkelStack,
  TxRow,
  VendorEmptyState,
  VendorScreenShell,
  WalletHero,
} from "@/components/ui/vendor";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";

interface WalletApiResponse {
  available: number;
  pending: number;
  escrow: number;
  currency: "NGN";
}

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

const LOW_BALANCE_NAIRA = 5_000;

/**
 * Vendor Finance hub — wallet hero + activity preview + jump-tos to
 * Earnings / Payouts / Withdraw / Banks.
 */
export default function VendorFinanceScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [wallet, setWallet] = useState<WalletApiResponse | null>(null);
  const [recent, setRecent] = useState<TxApiRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [walletErrored, setWalletErrored] = useState(false);
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const fetchAll = useCallback(async () => {
    try {
      const [w, t] = await Promise.allSettled([
        api.get<WalletApiResponse>("/api/vendor/wallet", { timeoutMs: 10_000 }),
        api.get<TxApiResponse>("/api/vendor/transactions?limit=4", {
          timeoutMs: 10_000,
        }),
      ]);
      if (w.status === "fulfilled") {
        setWallet(w.value);
        setWalletErrored(false);
      } else {
        setWalletErrored(true);
      }
      if (t.status === "fulfilled") setRecent(t.value.transactions ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAll();
  }, [fetchAll]);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAll();
  }, [fetchAll]);

  const handleTxPress = useCallback(
    (id: string) => {
      router.push(`/(vendor)/(finance)/transaction/${id}` as never);
    },
    [router],
  );

  const lowBalance = (wallet?.available ?? Infinity) < LOW_BALANCE_NAIRA;

  return (
    <VendorScreenShell title="Finance">
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
        {loading && !wallet ? (
          <SkelStack gap={14}>
            <Skel height={170} radius={24} />
            <Skel height={56} radius={16} />
            <Skel height={56} radius={16} />
            <Skel height={56} radius={16} />
          </SkelStack>
        ) : !wallet ? (
          <VendorEmptyState
            icon="cloud-offline-outline"
            iconTone="error"
            headline="Couldn't load wallet"
            body="Check your connection and try again."
            ctaLabel="Retry"
            onCta={() => {
              setLoading(true);
              fetchAll();
            }}
          />
        ) : (
          <>
            <WalletHero
              available={wallet.available}
              escrow={wallet.escrow}
              pending={wallet.pending}
            />

            {walletErrored ? (
              <AlertChip
                tone="warning"
                title="Showing last known balance"
                sub="Pull to refresh once you're back online."
              />
            ) : null}

            {lowBalance ? (
              <AlertChip
                tone="warning"
                title="Wallet running low"
                sub="Top up your wallet to keep operating smoothly."
                cta="Top up"
                onPress={() =>
                  router.push("/(vendor)/(finance)/low-balance" as never)
                }
              />
            ) : null}

            <View style={styles.actionsRow}>
              <Pressable
                onPress={() =>
                  router.push("/(vendor)/(finance)/withdraw" as never)
                }
                accessibilityRole="button"
                accessibilityLabel="Withdraw to bank"
                hitSlop={4}
                style={({ pressed }) => [
                  styles.actionPrimary,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Ionicons name="arrow-up" size={16} color={theme.fgOnPrimary} />
                <Text style={styles.actionPrimaryText}>Withdraw</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  router.push("/(vendor)/(finance)/earnings" as never)
                }
                accessibilityRole="button"
                accessibilityLabel="Open earnings"
                hitSlop={4}
                style={({ pressed }) => [
                  styles.actionGhost,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Ionicons name="stats-chart" size={16} color={theme.fg} />
                <Text style={styles.actionGhostText}>Earnings</Text>
              </Pressable>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Manage</Text>
              <View style={styles.list}>
                <SettingsRow
                  icon="list"
                  iconTone="primary"
                  title="Activity"
                  sub="All transactions"
                  onPress={() =>
                    router.push("/(vendor)/(finance)/transactions" as never)
                  }
                />
                <SettingsRow
                  icon="paper-plane"
                  iconTone="primary"
                  title="Payouts"
                  sub="Withdrawal history"
                  onPress={() =>
                    router.push("/(vendor)/(finance)/payouts" as never)
                  }
                />
                <SettingsRow
                  icon="card"
                  iconTone="primary"
                  title="Banks"
                  sub="Linked accounts"
                  onPress={() =>
                    router.push("/(vendor)/(finance)/banks" as never)
                  }
                />
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.recentHeader}>
                <Text style={styles.sectionLabel}>Recent activity</Text>
                <Pressable
                  onPress={() =>
                    router.push("/(vendor)/(finance)/transactions" as never)
                  }
                  accessibilityRole="button"
                  accessibilityLabel="See all transactions"
                  hitSlop={6}
                >
                  <Text style={styles.seeAll}>See all</Text>
                </Pressable>
              </View>
              {recent && recent.length > 0 ? (
                <View style={styles.list}>
                  {recent.map((tx) => (
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
                      onPress={() => handleTxPress(tx.id)}
                    />
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>
                  No transactions yet. Earnings show up here.
                </Text>
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
    actionsRow: {
      flexDirection: "row",
      gap: 10,
    },
    actionPrimary: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: theme.primary,
      paddingVertical: 12,
      borderRadius: theme.radius.pill,
    },
    actionPrimaryText: {
      ...theme.type.body,
      color: theme.fgOnPrimary,
      fontWeight: "800",
    },
    actionGhost: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 12,
      borderRadius: theme.radius.pill,
    },
    actionGhostText: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
    },
    section: {
      gap: 8,
    },
    sectionLabel: {
      ...theme.type.caption,
      color: theme.fgMuted,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      paddingHorizontal: 2,
    },
    recentHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingRight: 2,
    },
    seeAll: {
      ...theme.type.bodySm,
      color: theme.primary,
      fontWeight: "700",
    },
    list: { gap: 8 },
    emptyText: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      paddingHorizontal: 4,
      paddingVertical: 8,
    },
  });
