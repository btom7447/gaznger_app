import React, { useCallback, useEffect, useMemo } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { Theme, useTheme, formatCurrency } from "@/constants/theme";
import { useWalletStore, WalletTransaction } from "@/store/useWalletStore";
import {
  Button,
  EmptyState,
  ScreenContainer,
  ScreenHeader,
} from "@/components/ui/primitives";

/**
 * Customer wallet hub. Three sections:
 *   1. Hero balance card (Available + Pending). Pending only renders
 *      when > 0 — most customer accounts have no pending balance.
 *   2. Top up + Transfer out CTA row. Transfer out is hidden until we
 *      ship the customer-side withdraw flow (post-v1).
 *   3. Recent transactions list (server-driven, cursor paginated).
 */
export default function WalletHome() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const available = useWalletStore((s) => s.available);
  const pending = useWalletStore((s) => s.pending);
  const isLoading = useWalletStore((s) => s.isLoading);
  const transactions = useWalletStore((s) => s.transactions);
  const isLoadingTx = useWalletStore((s) => s.isLoadingTx);
  const refresh = useWalletStore((s) => s.refresh);
  const loadMoreTransactions = useWalletStore((s) => s.loadMoreTransactions);

  useFocusEffect(
    useCallback(() => {
      refresh();
      loadMoreTransactions();
    }, [refresh, loadMoreTransactions])
  );

  const onRefresh = useCallback(() => {
    refresh();
    // Reset cursor by triggering a new load.
    loadMoreTransactions();
  }, [refresh, loadMoreTransactions]);

  return (
    <ScreenContainer
      edges={["top", "bottom"]}
      header={<ScreenHeader title="Wallet" />}
    >
      <FlatList
        data={transactions}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => <TxRow tx={item} theme={theme} />}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        ListHeaderComponent={
          <View>
            <View style={styles.hero}>
              <Text style={styles.heroLabel}>Available balance</Text>
              <Text style={styles.heroAmount}>{formatCurrency(available)}</Text>
              {pending > 0 ? (
                <View style={styles.pendingChip}>
                  <Ionicons name="time-outline" size={12} color={theme.fgMuted} />
                  <Text style={styles.pendingText}>
                    {formatCurrency(pending)} pending
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.ctaRow}>
              <Button
                variant="primary"
                size="md"
                full
                onPress={() => router.push("/(customer)/wallet/topup" as never)}
              >
                Top up
              </Button>
            </View>

            <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
          </View>
        }
        ListEmptyComponent={
          isLoadingTx ? null : (
            <EmptyState
              icon="wallet-outline"
              title="No activity yet"
              body="Top up your wallet or pay for an order to see transactions here."
            />
          )
        }
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        onEndReached={() => loadMoreTransactions()}
        onEndReachedThreshold={0.4}
      />
    </ScreenContainer>
  );
}

/* ─────────────────────── Transaction row ─────────────────────────── */

const KIND_LABEL: Record<WalletTransaction["kind"], string> = {
  topup_credit: "Top-up",
  order_charge_credit: "Order charge",
  order_wallet_debit: "Paid order",
  points_redeem: "Points redeemed",
  refund_credit: "Refund",
  escrow_release_debit: "Escrow released",
  vendor_earning_credit: "Earnings",
  rider_earning_credit: "Earnings",
  platform_commission_credit: "Platform commission",
  withdraw_debit: "Withdrawal",
  withdraw_fee_debit: "Withdrawal fee",
  withdraw_reversal_credit: "Withdrawal reversed",
  admin_adjust: "Adjustment",
};

const KIND_ICON: Record<WalletTransaction["kind"], string> = {
  topup_credit: "arrow-down-circle-outline",
  order_charge_credit: "card-outline",
  order_wallet_debit: "cart-outline",
  points_redeem: "star-outline",
  refund_credit: "return-down-back-outline",
  escrow_release_debit: "lock-open-outline",
  vendor_earning_credit: "cash-outline",
  rider_earning_credit: "cash-outline",
  platform_commission_credit: "business-outline",
  withdraw_debit: "arrow-up-circle-outline",
  withdraw_fee_debit: "pricetag-outline",
  withdraw_reversal_credit: "refresh-outline",
  admin_adjust: "construct-outline",
};

function TxRow({ tx, theme }: { tx: WalletTransaction; theme: Theme }) {
  const isCredit = tx.amount >= 0;
  const sign = isCredit ? "+" : "−";
  // Credit amounts use the semantic success token so the colour
  // adjusts with the theme; debits stay on default foreground.
  const color = isCredit ? theme.success : theme.fg;
  const icon = (KIND_ICON[tx.kind] ?? "swap-horizontal-outline") as any;
  const label = KIND_LABEL[tx.kind] ?? "Transaction";
  const date = new Date(tx.createdAt).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <View style={txStyles.row}>
      <View style={[txStyles.iconWrap, { backgroundColor: theme.bgMuted }]}>
        <Ionicons name={icon} size={18} color={theme.fgMuted} />
      </View>
      <View style={txStyles.body}>
        <Text style={[txStyles.label, { color: theme.fg }]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[txStyles.sub, { color: theme.fgMuted }]} numberOfLines={1}>
          {tx.description || date}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[txStyles.amount, { color }]}>
          {sign}
          {formatCurrency(Math.abs(tx.amount))}
        </Text>
        {tx.state === "pending" ? (
          <Text style={[txStyles.sub, { color: theme.fgMuted }]}>pending</Text>
        ) : null}
      </View>
    </View>
  );
}

const txStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: 2 },
  label: { fontSize: 14, fontWeight: "700" },
  sub: { fontSize: 12 },
  amount: { fontSize: 14, fontWeight: "800" },
});

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    listContent: {
      paddingHorizontal: theme.space.s4,
      paddingBottom: theme.space.s5,
    },
    hero: {
      backgroundColor: theme.primaryTint,
      borderRadius: theme.radius.lg,
      padding: theme.space.s4,
      gap: 4,
      marginTop: theme.space.s2,
    },
    heroLabel: {
      ...theme.type.caption,
      color: theme.fgMuted,
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },
    heroAmount: {
      ...theme.type.h1,
      color: theme.primary,
      fontWeight: "800",
    },
    pendingChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.surface,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.space.s2 + 2,
      paddingVertical: 2,
      alignSelf: "flex-start",
      marginTop: 6,
    },
    pendingText: {
      ...theme.type.caption,
      color: theme.fgMuted,
    },
    ctaRow: {
      marginTop: theme.space.s3,
      marginBottom: theme.space.s4,
    },
    sectionLabel: {
      ...theme.type.micro,
      fontSize: 13,
      letterSpacing: 0.6,
      color: theme.fgMuted,
      marginBottom: theme.space.s2,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.border,
    },
  });
