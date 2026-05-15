import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { toast } from "sonner-native";
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

interface WalletResp {
  available: number;
  pending: number;
  escrow: number;
}

interface BankAccountRow {
  _id: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  isPrimary: boolean;
  bvnVerified: boolean;
}

const QUICK_PICKS = [50_000, 100_000, 250_000];
const PLATFORM_FEE_NGN = 50; // matches PlatformConfig default; server still authoritative

function fmtNaira(n: number): string {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

export default function WithdrawScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [wallet, setWallet] = useState<WalletResp | null>(null);
  const [banks, setBanks] = useState<BankAccountRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [pickedBankId, setPickedBankId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const styles = useMemo(() => makeStyles(theme), [theme]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [w, b] = await Promise.allSettled([
          api.get<WalletResp>("/api/vendor/wallet", { timeoutMs: 10_000 }),
          api.get<{ accounts: BankAccountRow[] }>(
            "/api/vendor/banks/saved",
            { timeoutMs: 10_000 },
          ),
        ]);
        if (cancelled) return;
        if (w.status === "fulfilled") setWallet(w.value);
        if (b.status === "fulfilled") {
          setBanks(b.value.accounts ?? []);
          const primary = b.value.accounts?.find((a) => a.isPrimary);
          setPickedBankId(primary?._id ?? b.value.accounts?.[0]?._id ?? null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const amountNum = useMemo(() => {
    const n = parseFloat(amount);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [amount]);

  const totalDebit = amountNum + PLATFORM_FEE_NGN;
  const insufficient = totalDebit > (wallet?.available ?? 0);
  const canSubmit = !!pickedBankId && amountNum > 0 && !insufficient && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await api.post("/api/vendor/withdraw", {
        amount: amountNum,
        bankAccountId: pickedBankId,
      });
      toast.success("Withdrawal requested", {
        description: "We'll notify you when it's processed.",
      });
      router.replace("/(vendor)/(finance)/payouts" as never);
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status;
      if (status === 403 && /verification/i.test(err?.message ?? "")) {
        router.replace("/(vendor)/(finance)/kyc" as never);
        return;
      }
      toast.error(err?.message ?? "Couldn't request withdrawal");
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, amountNum, pickedBankId, router]);

  return (
    <VendorScreenShell title="Withdraw">
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

        {loading && !wallet ? (
          <SkelStack gap={12}>
            <Skel height={120} radius={16} />
            <Skel height={140} radius={16} />
            <Skel height={70} radius={16} />
          </SkelStack>
        ) : !wallet ? (
          <VendorEmptyState
            icon="cloud-offline-outline"
            headline="Couldn't load wallet"
          />
        ) : (
          <>
            <VendorCard>
              <Text style={styles.cardLabel}>Available</Text>
              <Text
                style={styles.balance}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {fmtNaira(wallet.available)}
              </Text>
            </VendorCard>

            <VendorCard>
              <Text style={styles.cardLabel}>Amount</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0"
                placeholderTextColor={theme.fgMuted}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                accessibilityLabel="Amount"
              />
              <View style={styles.quickRow}>
                {QUICK_PICKS.map((q) => (
                  <Pressable
                    key={q}
                    onPress={() => setAmount(String(q))}
                    disabled={q > wallet.available}
                    hitSlop={4}
                    style={({ pressed }) => [
                      styles.quickChip,
                      q > wallet.available && { opacity: 0.4 },
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={styles.quickText}>
                      {q.toLocaleString("en-NG")}
                    </Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() =>
                    setAmount(
                      String(Math.max(0, wallet.available - PLATFORM_FEE_NGN)),
                    )
                  }
                  hitSlop={4}
                  style={({ pressed }) => [
                    styles.quickChip,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.quickText}>Max</Text>
                </Pressable>
              </View>

              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>Fee</Text>
                <Text style={styles.calcValue}>{fmtNaira(PLATFORM_FEE_NGN)}</Text>
              </View>
              <View style={[styles.calcRow, { marginTop: 4 }]}>
                <Text style={styles.calcLabel}>You'll receive</Text>
                <Text
                  style={[
                    styles.calcValue,
                    { fontWeight: "800", color: theme.fg },
                  ]}
                >
                  {fmtNaira(amountNum)}
                </Text>
              </View>
              {insufficient && amountNum > 0 ? (
                <Text style={styles.errorText}>
                  Insufficient balance. Reduce amount or top up.
                </Text>
              ) : null}
            </VendorCard>

            <VendorCard>
              <Text style={styles.cardLabel}>Bank account</Text>
              {!banks || banks.length === 0 ? (
                <View>
                  <Text style={styles.hint}>No bank linked yet.</Text>
                  <Pressable
                    onPress={() =>
                      router.push("/(vendor)/(finance)/bank-add" as never)
                    }
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.linkBtn,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={styles.linkBtnText}>Add a bank</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.bankList}>
                  {banks.map((b) => {
                    const isPicked = b._id === pickedBankId;
                    return (
                      <Pressable
                        key={b._id}
                        onPress={() => setPickedBankId(b._id)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isPicked }}
                        style={({ pressed }) => [
                          styles.bankRow,
                          isPicked && styles.bankRowActive,
                          pressed && { opacity: 0.92 },
                        ]}
                      >
                        <View
                          style={[
                            styles.radio,
                            isPicked && styles.radioActive,
                          ]}
                        >
                          {isPicked ? (
                            <View style={styles.radioInner} />
                          ) : null}
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text
                            style={styles.bankName}
                            numberOfLines={1}
                          >
                            {b.bankName}
                            {b.isPrimary ? "  ·  Primary" : ""}
                          </Text>
                          <Text style={styles.bankAcct} numberOfLines={1}>
                            {b.accountNumber}  ·  {b.accountName}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </VendorCard>

            <AlertChip
              tone="info"
              icon="information-circle"
              title="Settles to bank"
              sub={`Most withdrawals land within 1 hour during banking hours.`}
            />
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel="Request withdrawal"
          style={({ pressed }) => [
            styles.primaryBtn,
            !canSubmit && { opacity: 0.5 },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.primaryBtnText}>
            {submitting
              ? "Requesting…"
              : amountNum > 0
                ? `Withdraw ${fmtNaira(amountNum)}`
                : "Withdraw"}
          </Text>
        </Pressable>
      </View>
    </VendorScreenShell>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    scroll: {
      padding: 20,
      gap: 14,
      paddingBottom: 110,
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
    balance: {
      fontSize: 32,
      fontWeight: "800",
      letterSpacing: -0.6,
      color: theme.fg,
    },
    amountInput: {
      fontSize: 32,
      fontWeight: "800",
      letterSpacing: -0.6,
      color: theme.fg,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: theme.radius.lg,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: theme.surface,
    },
    quickRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 10,
    },
    quickChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.bgMuted,
    },
    quickText: {
      ...theme.type.bodySm,
      color: theme.fg,
      fontWeight: "700",
    },
    calcRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 14,
    },
    calcLabel: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      fontWeight: "600",
    },
    calcValue: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
    },
    errorText: {
      ...theme.type.bodySm,
      color: theme.error,
      fontWeight: "700",
      marginTop: 8,
    },
    hint: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      marginBottom: 8,
    },
    linkBtn: {
      alignSelf: "flex-start",
      backgroundColor: theme.primary,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: theme.radius.pill,
    },
    linkBtnText: {
      ...theme.type.bodySm,
      color: theme.fgOnPrimary,
      fontWeight: "800",
    },
    bankList: { gap: 8 },
    bankRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.bg,
      borderWidth: 1,
      borderColor: theme.border,
    },
    bankRowActive: {
      borderColor: theme.primary,
      backgroundColor: theme.primaryTint,
    },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
    },
    radioActive: {
      borderColor: theme.primary,
    },
    radioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.primary,
    },
    bankName: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
    },
    bankAcct: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    footer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 24,
      backgroundColor: theme.bg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    primaryBtn: {
      backgroundColor: theme.primary,
      paddingVertical: 14,
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
