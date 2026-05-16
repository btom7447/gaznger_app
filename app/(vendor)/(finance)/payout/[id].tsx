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
  AlertChip,
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

interface PayoutDetail {
  _id: string;
  amount: number;
  status: "pending" | "approved" | "rejected" | "processing" | "failed";
  bankDetails?: {
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
    bankCode?: string;
  };
  paystackTransferCode?: string;
  paystackRecipientCode?: string;
  note?: string;
  processedAt?: string;
  createdAt: string;
}

const STATUS_TONE: Record<PayoutDetail["status"], PillTone> = {
  pending: "warning",
  approved: "info",
  processing: "primary",
  rejected: "error",
  failed: "error",
};

const STATUS_LABEL: Record<PayoutDetail["status"], string> = {
  pending: "Pending",
  approved: "Approved",
  processing: "Processing",
  rejected: "Rejected",
  failed: "Failed",
};

function fmtNaira(n: number): string {
  return `₦${Number(n ?? 0).toLocaleString("en-NG")}`;
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function PayoutDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;

  const [payout, setPayout] = useState<PayoutDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const styles = useMemo(() => makeStyles(theme), [theme]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<PayoutDetail>(
          `/api/vendor/payouts/${id}`,
          { timeoutMs: 10_000 },
        );
        if (cancelled) return;
        setPayout(res);
      } catch {
        // empty state
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const isFailed = payout?.status === "failed" || payout?.status === "rejected";

  return (
    <VendorScreenShell title="Payout" hideStationSwitcher>
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
          <Text style={styles.backText}>Back to payouts</Text>
        </Pressable>

        {loading && !payout ? (
          <SkelStack gap={12}>
            <Skel height={160} radius={16} />
            <Skel height={140} radius={16} />
          </SkelStack>
        ) : !payout ? (
          <VendorEmptyState
            icon="cloud-offline-outline"
            headline="Couldn't load payout"
          />
        ) : (
          <>
            <VendorCard>
              <Text style={styles.cardLabel}>Amount</Text>
              <Text
                style={styles.amount}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {fmtNaira(payout.amount)}
              </Text>
              <View style={styles.pillRow}>
                <VendorPill tone={STATUS_TONE[payout.status]} size="sm" dot>
                  {STATUS_LABEL[payout.status]}
                </VendorPill>
                <Text style={styles.date}>
                  {fmtDate(payout.processedAt ?? payout.createdAt)}
                </Text>
              </View>
            </VendorCard>

            {isFailed ? (
              <AlertChip
                tone="error"
                title={`Payout ${STATUS_LABEL[payout.status].toLowerCase()}`}
                sub={
                  payout.note ??
                  "Check your bank details + BVN match, then retry."
                }
                cta="Retry"
                onPress={() =>
                  router.push(
                    `/(vendor)/(finance)/payout-failed/${payout._id}` as never,
                  )
                }
              />
            ) : null}

            <VendorCard>
              <Text style={styles.cardLabel}>Bank</Text>
              <Row label="Bank" value={payout.bankDetails?.bankName ?? "—"} />
              <Row
                label="Account"
                value={payout.bankDetails?.accountNumber ?? "—"}
              />
              <Row
                label="Name"
                value={payout.bankDetails?.accountName ?? "—"}
              />
            </VendorCard>

            <VendorCard>
              <Text style={styles.cardLabel}>Reference</Text>
              <Row label="Internal id" value={payout._id} mono />
              {payout.paystackTransferCode ? (
                <Row
                  label="Transfer code"
                  value={payout.paystackTransferCode}
                  mono
                />
              ) : null}
              <Row label="Initiated" value={fmtDate(payout.createdAt)} />
              {payout.processedAt ? (
                <Row label="Processed" value={fmtDate(payout.processedAt)} />
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
      color: theme.fg,
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
