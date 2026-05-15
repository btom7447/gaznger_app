import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Skel,
  SkelStack,
  VendorCard,
  VendorEmptyState,
  VendorPill,
  VendorScreenShell,
} from "@/components/ui/vendor";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";

interface TxDetail {
  _id: string;
  amount: number;
  state: "pending" | "available";
  kind: string;
  description: string;
  createdAt: string;
  groupId: string;
  paystackRef?: string;
  meta?: Record<string, unknown>;
  order?: any;
  withdrawal?: {
    amount?: number;
    status?: string;
    bankDetails?: {
      bankName?: string;
      accountNumber?: string;
      accountName?: string;
    };
    processedAt?: string;
  };
}

function fmtNaira(n: number): string {
  const abs = Math.abs(n);
  const sign = n >= 0 ? "+" : "−";
  return `${sign}₦${abs.toLocaleString("en-NG")}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function TransactionDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;

  const [tx, setTx] = useState<TxDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const styles = useMemo(() => makeStyles(theme), [theme]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<TxDetail>(
          `/api/vendor/transactions/${id}`,
          { timeoutMs: 10_000 },
        );
        if (cancelled) return;
        setTx(res);
      } catch {
        if (cancelled) return;
        // empty state
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const isCredit = (tx?.amount ?? 0) >= 0;

  return (
    <VendorScreenShell title="Transaction">
      <ScrollView
        contentContainerStyle={styles.scroll}
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
          <Text style={styles.backText}>Back to activity</Text>
        </Pressable>

        {loading && !tx ? (
          <SkelStack gap={12}>
            <Skel height={160} radius={16} />
            <Skel height={140} radius={16} />
          </SkelStack>
        ) : !tx ? (
          <VendorEmptyState
            icon="cloud-offline-outline"
            headline="Couldn't load transaction"
          />
        ) : (
          <>
            <VendorCard>
              <Text style={styles.cardLabel}>{tx.description || "Transaction"}</Text>
              <Text
                style={[
                  styles.amount,
                  { color: isCredit ? theme.success : theme.fg },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {fmtNaira(tx.amount)}
              </Text>
              <View style={styles.pillRow}>
                <VendorPill
                  tone={tx.state === "pending" ? "warning" : "success"}
                  size="sm"
                  dot
                >
                  {tx.state === "pending" ? "Pending" : "Settled"}
                </VendorPill>
                <Text style={styles.date}>{fmtDate(tx.createdAt)}</Text>
              </View>
            </VendorCard>

            {tx.order ? (
              <VendorCard>
                <Text style={styles.cardLabel}>Order</Text>
                <Row label="Customer" value={tx.order.user?.displayName ?? "—"} />
                <Row
                  label="Fuel"
                  value={`${tx.order.quantity ?? 0} ${tx.order.fuel?.unit ?? ""} ${tx.order.fuel?.name ?? ""}`.trim()}
                />
                <Row
                  label="Total"
                  value={`₦${Number(tx.order.totalPrice ?? 0).toLocaleString("en-NG")}`}
                />
                <Row label="Status" value={String(tx.order.status ?? "—")} />
              </VendorCard>
            ) : null}

            {tx.withdrawal ? (
              <VendorCard>
                <Text style={styles.cardLabel}>Withdrawal</Text>
                <Row
                  label="To bank"
                  value={tx.withdrawal.bankDetails?.bankName ?? "—"}
                />
                <Row
                  label="Account"
                  value={tx.withdrawal.bankDetails?.accountNumber ?? "—"}
                />
                <Row
                  label="Name"
                  value={tx.withdrawal.bankDetails?.accountName ?? "—"}
                />
                <Row
                  label="Status"
                  value={String(tx.withdrawal.status ?? "—")}
                />
              </VendorCard>
            ) : null}

            <VendorCard>
              <Text style={styles.cardLabel}>Reference</Text>
              <Row label="Internal id" value={tx._id} mono />
              <Row label="Group" value={tx.groupId} mono />
              {tx.paystackRef ? (
                <Row label="Paystack" value={tx.paystackRef} mono />
              ) : null}
            </VendorCard>
          </>
        )}
      </ScrollView>
    </VendorScreenShell>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 6,
      }}
    >
      <Text
        style={{
          flex: 1,
          ...theme.type.bodySm,
          color: theme.fgMuted,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          flex: 2,
          ...theme.type.bodySm,
          color: theme.fg,
          fontWeight: "700",
          fontFamily: mono ? "monospace" : undefined,
          textAlign: "right",
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
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
    cardLabel: {
      ...theme.type.caption,
      color: theme.fgMuted,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginBottom: 8,
    },
    amount: {
      fontSize: 32,
      fontWeight: "800",
      letterSpacing: -0.6,
    },
    pillRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 8,
    },
    date: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
  });
