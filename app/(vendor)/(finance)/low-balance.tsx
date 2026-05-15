import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  AlertChip,
  Skel,
  SkelStack,
  VendorCard,
  VendorScreenShell,
} from "@/components/ui/vendor";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";

interface WalletResp {
  available: number;
  pending: number;
  escrow: number;
}

function fmtNaira(n: number): string {
  return `₦${Number(n ?? 0).toLocaleString("en-NG")}`;
}

export default function LowBalanceScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [wallet, setWallet] = useState<WalletResp | null>(null);
  const [loading, setLoading] = useState(true);

  const styles = useMemo(() => makeStyles(theme), [theme]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<WalletResp>("/api/vendor/wallet", {
          timeoutMs: 10_000,
        });
        if (!cancelled) setWallet(res);
      } catch {
        // empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleTopUp = useCallback(() => {
    router.push("/(customer)/wallet/topup" as never);
  }, [router]);

  const handleViewActivity = useCallback(() => {
    router.push("/(vendor)/(finance)/transactions" as never);
  }, [router]);

  return (
    <VendorScreenShell title="Wallet low">
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
          <Text style={styles.backText}>Back to finance</Text>
        </Pressable>

        {loading ? (
          <SkelStack gap={12}>
            <Skel height={160} radius={16} />
            <Skel height={120} radius={16} />
          </SkelStack>
        ) : (
          <>
            <VendorCard>
              <View style={styles.iconWrap}>
                <Ionicons name="warning" size={28} color={theme.warning} />
              </View>
              <Text style={styles.headline}>Top up your wallet</Text>
              <Text style={styles.body}>
                Low balances slow down depot dispatches and bulk purchase
                holds. Keep at least ₦5,000 available to operate without
                interruption.
              </Text>
              <Text style={styles.balanceLabel}>Available</Text>
              <Text style={styles.balance}>
                {fmtNaira(wallet?.available ?? 0)}
              </Text>
            </VendorCard>

            <AlertChip
              tone="warning"
              title="Why this matters"
              sub="Bulk holds, platform fees, and instant settlements debit your wallet — not your bank."
            />

            <View style={styles.actionRow}>
              <Pressable
                onPress={handleViewActivity}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.ghostBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.ghostBtnText}>View activity</Text>
              </Pressable>
              <Pressable
                onPress={handleTopUp}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.primaryBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.primaryBtnText}>Top up</Text>
              </Pressable>
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
      backgroundColor: theme.warningTint,
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
      marginBottom: 14,
    },
    balanceLabel: {
      ...theme.type.caption,
      color: theme.fgMuted,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    balance: {
      fontSize: 28,
      fontWeight: "800",
      letterSpacing: -0.6,
      color: theme.fg,
      marginTop: 4,
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
