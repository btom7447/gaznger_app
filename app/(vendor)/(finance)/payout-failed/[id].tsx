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
  VendorScreenShell,
} from "@/components/ui/vendor";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";

interface PayoutDetail {
  _id: string;
  amount: number;
  status: "pending" | "approved" | "processing" | "rejected" | "failed";
  note?: string;
  bankDetails?: {
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
  };
  processedAt?: string;
  createdAt: string;
}

function fmtNaira(n: number): string {
  return `₦${Number(n ?? 0).toLocaleString("en-NG")}`;
}

export default function PayoutFailedScreen() {
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;
  const [payout, setPayout] = useState<PayoutDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);

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
        // empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleRetry = useCallback(() => {
    if (!payout) return;
    setRetrying(true);
    // Route to withdraw with prefilled amount; the new request creates a fresh
    // Withdrawal row — Paystack will not reuse the failed transfer code.
    router.replace(
      `/(vendor)/(finance)/withdraw?prefill=${payout.amount}` as never,
    );
    setRetrying(false);
  }, [payout, router]);

  const handleUpdateBank = useCallback(() => {
    router.push("/(vendor)/(finance)/banks" as never);
  }, [router]);

  return (
    <VendorScreenShell title="Payout failed">
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
          <Text style={styles.backText}>Back to payout</Text>
        </Pressable>

        {loading ? (
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
              <View style={styles.iconWrap}>
                <Ionicons
                  name="alert-circle"
                  size={28}
                  color={theme.error}
                />
              </View>
              <Text style={styles.headline}>
                {fmtNaira(payout.amount)} didn't go through
              </Text>
              <Text style={styles.body}>
                Your wallet has been credited back. You can retry once the
                cause below is sorted.
              </Text>
            </VendorCard>

            {payout.note ? (
              <AlertChip
                tone="error"
                icon="information-circle"
                title="Why it failed"
                sub={payout.note}
              />
            ) : null}

            <VendorCard>
              <Text style={styles.cardLabel}>Common fixes</Text>
              <Bullet text="Confirm the account name matches your registered vendor name." />
              <Bullet text="Make sure the BVN on your phone is the same as the account's BVN." />
              <Bullet text="If the bank was unavailable, retry in a few minutes." />
            </VendorCard>

            <View style={styles.actionRow}>
              <Pressable
                onPress={handleUpdateBank}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.ghostBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.ghostBtnText}>Update bank</Text>
              </Pressable>
              <Pressable
                onPress={handleRetry}
                disabled={retrying}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.primaryBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.primaryBtnText}>
                  {retrying ? "Retrying…" : "Retry"}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </VendorScreenShell>
  );
}

function Bullet({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
        paddingVertical: 4,
      }}
    >
      <Ionicons
        name="ellipse"
        size={6}
        color={theme.fgMuted}
        style={{ marginTop: 8 }}
      />
      <Text
        style={{ ...theme.type.bodySm, color: theme.fg, flex: 1, fontWeight: "600" }}
      >
        {text}
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
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.errorTint,
      marginBottom: 12,
    },
    headline: {
      ...theme.type.h2,
      color: theme.fg,
      fontWeight: "800",
      marginBottom: 6,
    },
    body: {
      ...theme.type.body,
      color: theme.fgMuted,
    },
    cardLabel: {
      ...theme.type.caption,
      color: theme.fgMuted,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginBottom: 8,
    },
    actionRow: {
      flexDirection: "row",
      gap: 10,
    },
    ghostBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 12,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    ghostBtnText: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
    },
    primaryBtn: {
      flex: 1,
      backgroundColor: theme.primary,
      paddingVertical: 12,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryBtnText: {
      ...theme.type.body,
      color: theme.fgOnPrimary,
      fontWeight: "800",
    },
  });
