import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { toast } from "sonner-native";
import { Theme, useTheme, formatCurrency } from "@/constants/theme";
import { api } from "@/lib/api";
import { useSessionStore } from "@/store/useSessionStore";
import {
  Row,
  ScreenContainer,
  ScreenHeader,
} from "@/components/ui/primitives";

/**
 * Points hub — v3.
 *
 * Layout:
 *   1. Gold gradient hero with Ionicon star, "YOUR POINTS" eyebrow,
 *      big tabular-nums balance, "≈ ₦X to spend" sub, and a primary
 *      "Redeem at next order" CTA that routes to the Order entry so
 *      the next checkout will use the points balance.
 *   2. Empty-state encouragement card if balance == 0 and no history.
 *   3. "How you earn" three info cards (order completed / referral /
 *      seasonal promo) with primary-tinted icon tiles.
 *   4. "Settings" Row group with the auto-redeem-at-checkout switch
 *      (mirrors Settings screen; lets users toggle from this hub too).
 *   5. "Recent activity" Row group with TxRow-style ledger items.
 *      Empty if no history.
 *   6. "Common questions" disclosure cards (FAQ).
 *
 * Per locked decision (8): points expire after 90 days. Server returns
 * `expiresAt` on each Point — we surface the soonest-expiring batch in
 * the hero subtitle when relevant.
 */

const POINTS_TO_NAIRA = 1;

interface PointHistoryItem {
  _id: string;
  change: number;
  type: "earn" | "redeem" | "adjust";
  description?: string;
  status: "pending" | "available" | "expired";
  createdAt: string;
  expiresAt?: string;
}

interface PointsHistoryResponse {
  data: PointHistoryItem[];
  total: number;
  page: number;
  totalPages: number;
}

export default function PointsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const user = useSessionStore((s) => s.user);
  const updateUser = useSessionStore((s) => s.updateUser);
  const balance = user?.points ?? 0;
  const autoRedeem = user?.preferences?.autoRedeemPoints ?? false;

  const [history, setHistory] = useState<PointHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const data = await api.get<PointsHistoryResponse>(
        "/api/points/history?limit=20"
      );
      setHistory(data.data ?? []);
    } catch {
      // Non-fatal — keep prior list
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  }, [loadHistory]);

  const toggleAutoRedeem = useCallback(
    async (next: boolean) => {
      const previous = !next;
      // Optimistic local update first.
      updateUser({
        preferences: { ...user?.preferences, autoRedeemPoints: next },
      });
      try {
        await api.put("/auth/me", {
          preferences: { autoRedeemPoints: next },
        });
      } catch (err: any) {
        updateUser({
          preferences: { ...user?.preferences, autoRedeemPoints: previous },
        });
        toast.error("Couldn't save", {
          description: err?.message ?? "Try again in a moment.",
        });
      }
    },
    [user?.preferences, updateUser]
  );

  const isEmpty = balance === 0 && history.length === 0;

  return (
    <ScreenContainer
      edges={["top", "bottom"]}
      noScroll
      header={<ScreenHeader title="Points" onBack={() => router.back()} />}
    >
      <FlatList
        data={history}
        keyExtractor={(p) => p._id}
        renderItem={({ item, index }) => (
          <ActivityRow
            item={item}
            theme={theme}
            divider={index < history.length - 1}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Gold hero */}
            <View style={styles.hero}>
              <View style={styles.heroBurst}>
                <Ionicons
                  name="star"
                  size={140}
                  color={theme.palette.gold700}
                />
              </View>
              <View style={styles.heroEyebrow}>
                <Ionicons
                  name="star"
                  size={14}
                  color={
                    theme.mode === "dark"
                      ? theme.palette.gold300
                      : theme.palette.gold700
                  }
                />
                <Text style={styles.heroEyebrowText}>YOUR POINTS</Text>
              </View>
              <Text style={styles.heroAmount}>
                {balance.toLocaleString("en-NG")}
              </Text>
              <Text style={styles.heroSub}>
                ≈ {formatCurrency(balance * POINTS_TO_NAIRA)} to spend
              </Text>
              {balance > 0 ? (
                <Pressable
                  onPress={() => router.push("/(customer)/(order)" as never)}
                  accessibilityRole="button"
                  accessibilityLabel="Redeem at next order"
                  style={({ pressed }) => [
                    styles.heroCta,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Ionicons
                    name="checkmark"
                    size={16}
                    color={theme.mode === "dark" ? "#000" : "#fff"}
                  />
                  <Text style={styles.heroCtaText}>Redeem at next order</Text>
                </Pressable>
              ) : null}
            </View>

            {/* Encouragement card if empty */}
            {isEmpty ? (
              <View style={styles.encouragementCard}>
                <Text style={styles.encouragementTitle}>No points yet.</Text>
                <Text style={styles.encouragementBody}>
                  Your first order earns you 50 points. Place one and we'll
                  add them once it's delivered.
                </Text>
              </View>
            ) : null}

            {/* How you earn */}
            <Text style={styles.sectionLabel}>HOW YOU EARN</Text>
            <View style={styles.earnGrid}>
              {EARN_CARDS.map((row) => (
                <View key={row.label} style={styles.earnCard}>
                  <View style={styles.earnIconTile}>
                    <Ionicons
                      name={row.icon}
                      size={16}
                      color={
                        theme.mode === "dark"
                          ? "#fff"
                          : theme.palette.green700
                      }
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.earnLabel}>{row.label}</Text>
                    <Text style={styles.earnSub}>{row.sub}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Settings */}
            <Text style={styles.sectionLabel}>SETTINGS</Text>
            <View style={styles.rowGroup}>
              <Row
                icon="flash-outline"
                label="Auto-redeem at checkout"
                sub="Apply your points balance to every payment"
                kind="switch"
                switchValue={autoRedeem}
                onSwitchChange={toggleAutoRedeem}
                divider={false}
              />
            </View>

            {/* Recent activity header */}
            {history.length > 0 || loadingHistory ? (
              <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
            ) : null}
          </View>
        }
        // Wrap each ledger row in shared activity card chrome.
        CellRendererComponent={({ children, index }) => (
          <View
            style={[
              styles.activityCell,
              index === 0 && styles.activityCellFirst,
              index === history.length - 1 && styles.activityCellLast,
            ]}
          >
            {children}
          </View>
        )}
        ListEmptyComponent={
          loadingHistory ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={theme.primary} />
            </View>
          ) : null
        }
        ListFooterComponent={
          <View>
            <Text style={styles.sectionLabel}>COMMON QUESTIONS</Text>
            <View style={styles.faqGroup}>
              {FAQ.map((row, i) => {
                const isOpen = openFaq === i;
                return (
                  <Pressable
                    key={row.q}
                    onPress={() => setOpenFaq(isOpen ? null : i)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isOpen }}
                    style={({ pressed }) => [
                      styles.faqRow,
                      i < FAQ.length - 1 && styles.faqRowDivider,
                      pressed && { opacity: 0.92 },
                    ]}
                  >
                    <View style={styles.faqHead}>
                      <Text style={styles.faqQ}>{row.q}</Text>
                      <Ionicons
                        name={isOpen ? "chevron-down" : "chevron-forward"}
                        size={14}
                        color={theme.fgMuted}
                      />
                    </View>
                    {isOpen ? (
                      <Text style={styles.faqA}>{row.a}</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
      />
    </ScreenContainer>
  );
}

/* ─────────────────────── Activity row ─────────────────────────── */

function ActivityRow({
  item,
  theme,
  divider,
}: {
  item: PointHistoryItem;
  theme: Theme;
  divider: boolean;
}) {
  const isCredit = item.change >= 0;
  const sign = isCredit ? "+" : "−";
  const dark = theme.mode === "dark";
  const tileBg = isCredit
    ? dark
      ? "rgba(245,197,24,0.10)"
      : theme.palette.gold50
    : dark
    ? "rgba(255,255,255,0.06)"
    : theme.palette.neutral100;
  const tileFg = isCredit
    ? dark
      ? theme.palette.gold300
      : theme.palette.gold700
    : theme.fgMuted;
  const amountColor = isCredit
    ? dark
      ? theme.palette.gold300
      : theme.palette.gold700
    : theme.fg;

  const meta = useMemo(() => {
    const d = new Date(item.createdAt);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
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
    return item.description ? `${prefix} · ${item.description}` : prefix;
  }, [item.createdAt, item.description]);

  return (
    <View
      style={[
        rowStyles.row,
        divider && {
          borderBottomColor: theme.divider,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View style={[rowStyles.iconWrap, { backgroundColor: tileBg }]}>
        <Ionicons
          name={isCredit ? "star" : "arrow-down"}
          size={14}
          color={tileFg}
        />
      </View>
      <View style={rowStyles.body}>
        <Text style={[rowStyles.label, { color: theme.fg }]} numberOfLines={1}>
          {labelFor(item)}
        </Text>
        <Text
          style={[rowStyles.sub, { color: theme.fgMuted }]}
          numberOfLines={1}
        >
          {meta}
          {item.status === "pending" ? " · pending" : ""}
          {item.status === "expired" ? " · expired" : ""}
        </Text>
      </View>
      <Text style={[rowStyles.amount, { color: amountColor }]}>
        {sign}
        {Math.abs(item.change).toLocaleString("en-NG")}
        <Text style={rowStyles.amountUnit}> pts</Text>
      </Text>
    </View>
  );
}

function labelFor(item: PointHistoryItem): string {
  if (item.type === "redeem") return "Redeemed at checkout";
  if (item.type === "adjust") return "Adjustment";
  // earn — the description usually carries the order ref already
  if (item.description?.toLowerCase().includes("referral"))
    return "Referral bonus";
  if (item.description?.toLowerCase().includes("promo")) return "Promo bonus";
  return "Earned";
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: 2, minWidth: 0 },
  label: { fontSize: 13, fontWeight: "700" },
  sub: { fontSize: 11.5 },
  amount: { fontSize: 14, fontWeight: "800" },
  amountUnit: { fontSize: 10, opacity: 0.7 },
});

/* ─────────────────────── Static content ─────────────────────────── */

const EARN_CARDS: Array<{
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  sub: string;
}> = [
  {
    icon: "flame",
    label: "Order completed",
    sub: "50–200 points per order, depending on size",
  },
  {
    icon: "people",
    label: "Referral redeemed",
    sub: "+100 when a friend places their first order",
  },
  {
    icon: "pricetag",
    label: "Seasonal promos",
    sub: "Variable boosts during peak periods",
  },
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "What can I redeem points for?",
    a: "1 point = ₦1 off any order. Apply on the Payment screen — points come off your total before payment confirms.",
  },
  {
    q: "Do points expire?",
    a: "Yes — points expire 3 months after they're earned. We'll surface the soonest-expiring batch on this screen as the date approaches.",
  },
  {
    q: "Can I gift points?",
    a: "Not yet. Points stay tied to the account that earned them. We'll add gifting once we ship the friend-graph features.",
  },
  {
    q: "How do referrals work?",
    a: "Share your referral code from Profile. When a friend places their first order using it, you both earn 100 points.",
  },
];

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    scroll: {
      paddingBottom: theme.space.s5 + 16,
    },

    /* Gold hero */
    hero: {
      marginHorizontal: theme.space.s4,
      marginTop: theme.space.s1,
      marginBottom: theme.space.s4,
      padding: 22,
      borderRadius: 20,
      backgroundColor:
        theme.mode === "dark" ? "#2A220A" : theme.palette.gold50,
      borderWidth: 1,
      borderColor:
        theme.mode === "dark" ? "#5B4A12" : theme.palette.gold100,
      overflow: "hidden",
    },
    heroBurst: {
      position: "absolute",
      top: -30,
      right: -30,
      opacity: 0.15,
    },
    heroEyebrow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 4,
    },
    heroEyebrowText: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.5,
      color:
        theme.mode === "dark"
          ? theme.palette.gold300
          : theme.palette.gold700,
    },
    heroAmount: {
      fontSize: 48,
      fontWeight: "800",
      color: theme.mode === "dark" ? "#fff" : theme.palette.neutral900,
      letterSpacing: -1,
      lineHeight: 53,
      ...theme.type.money,
    },
    heroSub: {
      fontSize: 13,
      fontWeight: "700",
      color:
        theme.mode === "dark"
          ? theme.palette.gold300
          : theme.palette.gold700,
      marginTop: 4,
    },
    heroCta: {
      marginTop: 16,
      alignSelf: "flex-start",
      height: 44,
      paddingHorizontal: 18,
      borderRadius: 12,
      backgroundColor:
        theme.mode === "dark" ? "#fff" : theme.palette.neutral900,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    heroCtaText: {
      fontSize: 13.5,
      fontWeight: "800",
      color: theme.mode === "dark" ? "#000" : "#fff",
    },

    /* Encouragement card (empty state) */
    encouragementCard: {
      marginHorizontal: theme.space.s4,
      marginBottom: theme.space.s4,
      padding: 18,
      borderRadius: 14,
      backgroundColor: theme.primaryTint,
      borderWidth: 1,
      borderColor:
        theme.mode === "dark" ? theme.border : theme.palette.green100,
      alignItems: "center",
    },
    encouragementTitle: {
      fontSize: 14,
      fontWeight: "800",
      color: theme.mode === "dark" ? "#fff" : theme.palette.green700,
      marginBottom: 4,
    },
    encouragementBody: {
      fontSize: 12.5,
      color: theme.fgMuted,
      lineHeight: 19,
      textAlign: "center",
    },

    /* Section labels */
    sectionLabel: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.fgMuted,
      letterSpacing: 0.5,
      paddingHorizontal: theme.space.s4,
      paddingTop: theme.space.s4,
      paddingBottom: theme.space.s2,
    },

    /* Earn cards */
    earnGrid: {
      paddingHorizontal: theme.space.s4,
      gap: 8,
    },
    earnCard: {
      padding: 14,
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.divider,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    earnIconTile: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: theme.primaryTint,
      alignItems: "center",
      justifyContent: "center",
    },
    earnLabel: {
      fontSize: 13.5,
      fontWeight: "800",
      color: theme.fg,
    },
    earnSub: {
      fontSize: 11.5,
      color: theme.fgMuted,
      marginTop: 2,
      lineHeight: 16,
    },

    /* Row group (settings + activity card chrome) */
    rowGroup: {
      backgroundColor: theme.surface,
      marginHorizontal: theme.space.s4,
      borderRadius: theme.radius.md + 2,
      borderWidth: 1,
      borderColor: theme.divider,
      overflow: "hidden",
    },

    activityCell: {
      backgroundColor: theme.surface,
      marginHorizontal: theme.space.s4,
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

    loadingWrap: {
      paddingVertical: 24,
      alignItems: "center",
    },

    /* FAQ */
    faqGroup: {
      backgroundColor: theme.surface,
      marginHorizontal: theme.space.s4,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.divider,
      overflow: "hidden",
    },
    faqRow: {
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    faqRowDivider: {
      borderBottomColor: theme.divider,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    faqHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    faqQ: {
      fontSize: 13.5,
      fontWeight: "700",
      color: theme.fg,
      flex: 1,
    },
    faqA: {
      fontSize: 12.5,
      color: theme.fgMuted,
      marginTop: 8,
      lineHeight: 19,
    },
  });
