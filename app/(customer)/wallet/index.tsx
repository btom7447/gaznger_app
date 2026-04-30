import React, { useCallback, useMemo } from "react";
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
  ScreenContainer,
  ScreenHeader,
} from "@/components/ui/primitives";

/**
 * Customer wallet hub — v3.
 *
 * Layout:
 *   1. Primary-green hero card with watermark circles, "Available
 *      balance" eyebrow, big tabular-nums amount, optional Pending
 *      pill, and a 2-CTA grid (Top up + Withdraw "Coming soon"). Per
 *      locked decision (7) the Withdraw button is HIDDEN entirely on
 *      the customer wallet — customers don't withdraw, only top up
 *      and spend. Top up takes the full row.
 *   2. "Recent activity" section header with a "See all" affordance
 *      that scrolls to the activity card (no-op for now since the list
 *      already shows them; reserved for the eventual full-history
 *      route).
 *   3. Activity card — rounded surface with internal hairline dividers
 *      between TxRows. Empty state inside the card. Loading shimmers
 *      for the first hydration.
 *   4. "Powered by Paystack · funds settled in Naira" footnote.
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
  const resetTransactions = useWalletStore((s) => s.resetTransactions);

  useFocusEffect(
    useCallback(() => {
      refresh();
      loadMoreTransactions();
    }, [refresh, loadMoreTransactions])
  );

  // Pull-to-refresh resets the cursor so the next loadMoreTransactions
  // pulls a fresh first page rather than respecting the "exhausted"
  // short-circuit that prevents the infinite-fetch loop.
  const onRefresh = useCallback(() => {
    refresh();
    resetTransactions();
    loadMoreTransactions();
  }, [refresh, resetTransactions, loadMoreTransactions]);

  const isEmpty = !isLoadingTx && transactions.length === 0;

  return (
    <ScreenContainer
      edges={["top", "bottom"]}
      noScroll
      header={<ScreenHeader title="Wallet" />}
    >
      <FlatList
        data={transactions}
        keyExtractor={(t) => t.id}
        renderItem={({ item, index }) => (
          <TxRow
            tx={item}
            theme={theme}
            divider={index < transactions.length - 1}
          />
        )}
        ListHeaderComponent={
          <View>
            {/* Hero */}
            <View style={styles.hero}>
              <View style={styles.heroWatermarkA} />
              <View style={styles.heroWatermarkB} />
              <Text style={styles.heroLabel}>AVAILABLE BALANCE</Text>
              <Text style={styles.heroAmount}>
                {formatCurrency(available)}
              </Text>
              {pending > 0 ? (
                <View style={styles.pendingPill}>
                  <Ionicons name="lock-closed" size={11} color="#fff" />
                  <Text style={styles.pendingText}>
                    Pending: {formatCurrency(pending)}
                  </Text>
                </View>
              ) : null}

              <View style={styles.heroCtaRow}>
                <Pressable
                  onPress={() =>
                    router.push("/(customer)/wallet/topup" as never)
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Top up wallet"
                  style={({ pressed }) => [
                    styles.heroPrimaryCta,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Ionicons
                    name="add"
                    size={16}
                    color={theme.palette.green700}
                  />
                  <Text style={styles.heroPrimaryCtaText}>Top up</Text>
                </Pressable>
              </View>
            </View>

            {/* Section header */}
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Recent activity</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          isLoadingTx ? (
            <ActivityLoading theme={theme} />
          ) : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Ionicons
                  name="receipt-outline"
                  size={26}
                  color={theme.fgMuted}
                />
              </View>
              <Text style={styles.emptyTitle}>No activity yet</Text>
              <Text style={styles.emptyBody}>
                Top up your wallet or pay for an order to see transactions
                here.
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          <Text style={styles.footnote}>
            Powered by Paystack · funds settled in Naira
          </Text>
        }
        // The card chrome is supplied by per-section wrappers, not the
        // FlatList. We use CellRendererComponent to wrap each row in the
        // shared activity card; first/last get rounded corners and the
        // group gets a single border.
        CellRendererComponent={({ children, index }) => (
          <View
            style={[
              styles.activityCell,
              index === 0 && styles.activityCellFirst,
              index === transactions.length - 1 && styles.activityCellLast,
            ]}
          >
            {children}
          </View>
        )}
        contentContainerStyle={[
          styles.listContent,
          isEmpty && { paddingHorizontal: 0 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        onEndReached={() => loadMoreTransactions()}
        onEndReachedThreshold={0.4}
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}

/* ─────────────────────── Transaction row ─────────────────────────── */

const KIND_LABEL: Record<WalletTransaction["kind"], string> = {
  topup_credit: "Wallet top-up",
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

interface TxKindStyle {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  bg: string;
  fg: string;
}

function getKindStyle(
  kind: WalletTransaction["kind"],
  theme: Theme
): TxKindStyle {
  const dark = theme.mode === "dark";
  const muted = dark ? "rgba(255,255,255,0.06)" : theme.bgMuted;

  switch (kind) {
    case "topup_credit":
      return {
        icon: "add",
        bg: dark ? muted : theme.palette.success50,
        fg: dark ? "#fff" : theme.palette.success700,
      };
    case "order_charge_credit":
    case "order_wallet_debit":
      return {
        icon: "flame",
        bg: dark ? muted : theme.palette.error50,
        fg: dark ? "#fff" : theme.palette.error700,
      };
    case "refund_credit":
    case "withdraw_reversal_credit":
      return {
        icon: "refresh",
        bg: dark ? muted : theme.palette.success50,
        fg: dark ? "#fff" : theme.palette.success700,
      };
    case "points_redeem":
      return {
        icon: "star",
        bg: dark ? muted : theme.palette.gold50,
        fg: dark ? "#fff" : theme.palette.gold700,
      };
    case "vendor_earning_credit":
    case "rider_earning_credit":
      return {
        icon: "cash",
        bg: dark ? muted : theme.palette.success50,
        fg: dark ? "#fff" : theme.palette.success700,
      };
    case "platform_commission_credit":
      return {
        icon: "business",
        bg: dark ? muted : theme.palette.info50,
        fg: dark ? "#fff" : theme.palette.info700,
      };
    case "escrow_release_debit":
      return {
        icon: "lock-open",
        bg: dark ? muted : theme.palette.success50,
        fg: dark ? "#fff" : theme.palette.success700,
      };
    case "withdraw_debit":
      return {
        icon: "arrow-up",
        bg: muted,
        fg: dark ? "#fff" : theme.palette.neutral700,
      };
    case "withdraw_fee_debit":
      return {
        icon: "card",
        bg: muted,
        fg: dark ? "#fff" : theme.palette.neutral700,
      };
    case "admin_adjust":
      return {
        icon: "shield-checkmark",
        bg: dark ? muted : theme.palette.info50,
        fg: dark ? "#fff" : theme.palette.info700,
      };
  }
}

function TxRow({
  tx,
  theme,
  divider,
}: {
  tx: WalletTransaction;
  theme: Theme;
  divider: boolean;
}) {
  const isCredit = tx.amount >= 0;
  const sign = isCredit ? "+" : "−";
  const amountColor = isCredit ? theme.success : theme.fg;
  const { icon, bg, fg } = getKindStyle(tx.kind, theme);
  const label = KIND_LABEL[tx.kind] ?? "Transaction";

  // Date format: "Today · 09:14" / "Yesterday · 18:42" / "Mon · 18:42" / "Oct 4"
  const meta = useMemo(() => {
    const d = new Date(tx.createdAt);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    const time = d.toLocaleTimeString("en-NG", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    let prefix: string;
    if (sameDay) prefix = "Today";
    else if (isYesterday) prefix = "Yesterday";
    else if (now.getTime() - d.getTime() < 7 * 24 * 60 * 60 * 1000)
      prefix = d.toLocaleDateString("en-NG", { weekday: "short" });
    else
      prefix = d.toLocaleDateString("en-NG", {
        month: "short",
        day: "numeric",
      });
    const head = `${prefix} · ${time}`;
    return tx.description ? `${head} · ${tx.description}` : head;
  }, [tx.createdAt, tx.description]);

  return (
    <View
      style={[
        txStyles.row,
        divider && {
          borderBottomColor: theme.divider,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View style={[txStyles.iconWrap, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={16} color={fg} />
      </View>
      <View style={txStyles.body}>
        <Text style={[txStyles.label, { color: theme.fg }]} numberOfLines={1}>
          {label}
        </Text>
        <Text
          style={[txStyles.sub, { color: theme.fgMuted }]}
          numberOfLines={1}
        >
          {meta}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[txStyles.amount, { color: amountColor }]}>
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

/* ─────────────────────── Activity loading state ──────────────────── */

function ActivityLoading({ theme }: { theme: Theme }) {
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.loadingCard}>
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={[
            txStyles.row,
            i < 3 && {
              borderBottomColor: theme.divider,
              borderBottomWidth: StyleSheet.hairlineWidth,
            },
          ]}
        >
          <View style={[txStyles.iconWrap, { backgroundColor: theme.bgMuted }]} />
          <View style={txStyles.body}>
            <View
              style={[
                styles.skel,
                { width: "60%", height: 12, marginBottom: 6 },
              ]}
            />
            <View style={[styles.skel, { width: "40%", height: 10 }]} />
          </View>
          <View style={[styles.skel, { width: 64, height: 14 }]} />
        </View>
      ))}
    </View>
  );
}

const txStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: 2, minWidth: 0 },
  label: { fontSize: 13.5, fontWeight: "700" },
  sub: { fontSize: 11.5 },
  amount: { fontSize: 14, fontWeight: "800" },
});

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    listContent: {
      paddingHorizontal: theme.space.s4,
      paddingBottom: theme.space.s5,
    },

    /* Hero */
    hero: {
      backgroundColor: theme.primary,
      borderRadius: 20,
      paddingHorizontal: 22,
      paddingTop: 22,
      paddingBottom: 22,
      marginTop: theme.space.s1,
      marginBottom: theme.space.s4,
      overflow: "hidden",
      // soft cast shadow on light mode; subtle on dark
      shadowColor: theme.palette.green700,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: theme.mode === "dark" ? 0.3 : 0.25,
      shadowRadius: 20,
      elevation: 6,
    },
    heroWatermarkA: {
      position: "absolute",
      top: -30,
      right: -30,
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: "rgba(255,255,255,0.08)",
    },
    heroWatermarkB: {
      position: "absolute",
      bottom: -50,
      right: 30,
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: "rgba(255,255,255,0.06)",
    },
    heroLabel: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.6,
      color: "#fff",
      opacity: 0.85,
    },
    heroAmount: {
      fontSize: 42,
      fontWeight: "800",
      color: "#fff",
      letterSpacing: -0.8,
      marginTop: 4,
      ...theme.type.money,
    },
    pendingPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "rgba(255,255,255,0.15)",
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      alignSelf: "flex-start",
      marginTop: 8,
    },
    pendingText: {
      fontSize: 11,
      fontWeight: "700",
      color: "#fff",
    },
    heroCtaRow: {
      marginTop: 18,
    },
    heroPrimaryCta: {
      height: 44,
      borderRadius: 12,
      backgroundColor: "#fff",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    heroPrimaryCtaText: {
      fontSize: 13.5,
      fontWeight: "800",
      color: theme.palette.green700,
    },

    /* Section header */
    sectionRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
      paddingBottom: theme.space.s2,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "800",
      color: theme.fg,
    },

    /* Empty + loading cards */
    emptyCard: {
      backgroundColor: theme.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.divider,
      paddingVertical: 40,
      paddingHorizontal: 20,
      alignItems: "center",
      marginHorizontal: theme.space.s4,
    },
    emptyIconWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.bgMuted,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    emptyTitle: {
      fontSize: 14,
      fontWeight: "800",
      color: theme.fg,
      marginBottom: 6,
    },
    emptyBody: {
      fontSize: 12,
      color: theme.fgMuted,
      textAlign: "center",
      lineHeight: 18,
      maxWidth: 240,
    },
    loadingCard: {
      backgroundColor: theme.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.divider,
      overflow: "hidden",
    },
    skel: {
      backgroundColor: theme.skeleton,
      borderRadius: 4,
    },

    /* Activity card chrome (CellRendererComponent wraps each TxRow) */
    activityCell: {
      backgroundColor: theme.surface,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: theme.divider,
    },
    activityCellFirst: {
      borderTopWidth: 1,
      borderTopLeftRadius: 14,
      borderTopRightRadius: 14,
    },
    activityCellLast: {
      borderBottomWidth: 1,
      borderBottomLeftRadius: 14,
      borderBottomRightRadius: 14,
    },

    footnote: {
      textAlign: "center",
      fontSize: 11,
      color: theme.fgMuted,
      lineHeight: 18,
      paddingVertical: 20,
    },
  });
