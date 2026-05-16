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
  Skel,
  SkelStack,
  VendorCard,
  VendorEmptyState,
  VendorPill,
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

/**
 * Withdraw — v6 design.
 *
 *   You'll withdraw
 *   ₦100,000
 *   Available ₦612,840
 *
 *   [ quick picks: 50k · 100k · 250k · Max ]
 *
 *   Summary card:
 *     Withdrawing       ₦100,000
 *     Instant fee       −₦500
 *     To                GTB ••3201
 *     Arrival           [pill: Within 60 sec]
 *
 *   [ Bank selector — opens picker / change bank ]
 *
 *   (bottom-pinned) Withdraw ₦100,000
 */

const QUICK_PICKS = [50_000, 100_000, 250_000];
const INSTANT_FEE_RATE = 0.005; // 0.5% — server is authoritative
const INSTANT_FEE_MIN = 100;

function fmtNaira(n: number): string {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

function instantFeeFor(amount: number): number {
  if (amount <= 0) return 0;
  return Math.max(INSTANT_FEE_MIN, Math.round(amount * INSTANT_FEE_RATE));
}

export default function WithdrawScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [wallet, setWallet] = useState<WalletResp | null>(null);
  const [banks, setBanks] = useState<BankAccountRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("100000");
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

  const fee = instantFeeFor(amountNum);
  const totalDebit = amountNum + fee;
  const insufficient = totalDebit > (wallet?.available ?? 0);
  const pickedBank = banks?.find((b) => b._id === pickedBankId) ?? null;
  const canSubmit =
    !!pickedBankId && amountNum > 0 && !insufficient && !submitting;

  const handleQuickPick = useCallback(
    (v: number) => {
      if (!wallet) return;
      // Quick-pick can't exceed available; clamp.
      const safe = Math.min(v, wallet.available);
      setAmount(String(safe));
    },
    [wallet],
  );

  const handleMax = useCallback(() => {
    if (!wallet) return;
    // Reserve a buffer for fee so totalDebit stays ≤ available.
    const maxAmount = Math.max(0, wallet.available - INSTANT_FEE_MIN);
    setAmount(String(maxAmount));
  }, [wallet]);

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
        keyboardShouldPersistTaps="handled"
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
          <SkelStack gap={14}>
            <Skel height={120} radius={16} />
            <Skel height={100} radius={16} />
            <Skel height={140} radius={16} />
          </SkelStack>
        ) : !wallet ? (
          <VendorEmptyState
            icon="cloud-offline-outline"
            iconTone="error"
            headline="Couldn't load wallet"
          />
        ) : (
          <>
            <View style={styles.headlineWrap}>
              <Text style={styles.headlineEyebrow}>You'll withdraw</Text>
              <TextInput
                style={styles.headlineAmount}
                value={amount}
                onChangeText={(t) =>
                  setAmount(t.replace(/[^0-9]/g, ""))
                }
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={theme.fgMuted}
                accessibilityLabel="Amount"
                returnKeyType="done"
              />
              <Text style={styles.headlineAvailable}>
                Available {fmtNaira(wallet.available)}
              </Text>
            </View>

            <VendorCard>
              <View style={styles.quickRow}>
                {QUICK_PICKS.map((q) => {
                  const active = amountNum === q;
                  const tooMuch = q > wallet.available;
                  return (
                    <Pressable
                      key={q}
                      onPress={() => handleQuickPick(q)}
                      disabled={tooMuch}
                      accessibilityRole="button"
                      accessibilityLabel={`Pick ${fmtNaira(q)}`}
                      style={({ pressed }) => [
                        styles.quickChip,
                        active && styles.quickChipActive,
                        tooMuch && { opacity: 0.4 },
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.quickText,
                          active && styles.quickTextActive,
                        ]}
                      >
                        {(q / 1000).toFixed(0)}k
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={handleMax}
                  accessibilityRole="button"
                  accessibilityLabel="Use max available"
                  style={({ pressed }) => [
                    styles.quickChip,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.quickText}>Max</Text>
                </Pressable>
              </View>
            </VendorCard>

            <VendorCard noPadding>
              <SummaryRow
                label="Withdrawing"
                value={fmtNaira(amountNum)}
              />
              <SummaryRow
                label="Instant fee"
                value={`−${fmtNaira(fee)}`}
              />
              <SummaryRow
                label="To"
                value={
                  pickedBank
                    ? `${pickedBank.bankName} ••${pickedBank.accountNumber.slice(
                        -4,
                      )}`
                    : "No bank linked"
                }
              />
              <SummaryRow
                label="Arrival"
                value={
                  <VendorPill tone="success" size="sm">
                    Within 60 sec
                  </VendorPill>
                }
                last
              />
            </VendorCard>

            <BankSelector
              banks={banks}
              pickedBankId={pickedBankId}
              onPick={setPickedBankId}
              onAddBank={() =>
                router.push("/(vendor)/(finance)/bank-add" as never)
              }
            />

            {insufficient && amountNum > 0 ? (
              <Text style={styles.errorText}>
                Insufficient balance. Reduce amount or top up.
              </Text>
            ) : null}
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

function SummaryRow({
  label,
  value,
  last,
}: {
  label: string;
  value: React.ReactNode;
  last?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: theme.divider,
        gap: 12,
      }}
    >
      <Text
        style={{
          ...theme.type.bodySm,
          color: theme.fgMuted,
          fontWeight: "600",
          flex: 1,
        }}
      >
        {label}
      </Text>
      {typeof value === "string" ? (
        <Text
          style={{
            ...theme.type.body,
            color: theme.fg,
            fontWeight: "700",
            textAlign: "right",
            maxWidth: "60%",
          }}
          numberOfLines={1}
        >
          {value}
        </Text>
      ) : (
        value
      )}
    </View>
  );
}

function BankSelector({
  banks,
  pickedBankId,
  onPick,
  onAddBank,
}: {
  banks: BankAccountRow[] | null;
  pickedBankId: string | null;
  onPick: (id: string) => void;
  onAddBank: () => void;
}) {
  const theme = useTheme();
  const picked = banks?.find((b) => b._id === pickedBankId) ?? null;

  if (!banks || banks.length === 0) {
    return (
      <VendorCard>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: theme.bgMuted,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="card-outline" size={18} color={theme.fgMuted} />
          </View>
          <Text
            style={{
              flex: 1,
              ...theme.type.body,
              color: theme.fgMuted,
              fontWeight: "600",
            }}
          >
            No bank linked yet
          </Text>
          <Pressable
            onPress={onAddBank}
            accessibilityRole="button"
            accessibilityLabel="Add a bank"
            hitSlop={4}
            style={({ pressed }) => [
              {
                backgroundColor: theme.primary,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: theme.radius.pill,
              },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text
              style={{
                ...theme.type.bodySm,
                color: theme.fgOnPrimary,
                fontWeight: "800",
              }}
            >
              Add bank
            </Text>
          </Pressable>
        </View>
      </VendorCard>
    );
  }

  // Multi-bank vendors get a tap-to-cycle action. For a true picker
  // sheet we'd need another modal; for now, tapping cycles through
  // saved banks, which is the cheapest functional path.
  const cycle = () => {
    if (!banks || banks.length < 2) return;
    const idx = banks.findIndex((b) => b._id === pickedBankId);
    const next = banks[(idx + 1) % banks.length];
    onPick(next._id);
  };

  return (
    <Pressable
      onPress={banks.length > 1 ? cycle : undefined}
      accessibilityRole={banks.length > 1 ? "button" : undefined}
      accessibilityLabel={
        picked ? `Sending to ${picked.bankName}. Tap to switch.` : undefined
      }
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          backgroundColor: theme.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.border,
          borderRadius: theme.radius.lg,
          paddingHorizontal: 14,
          paddingVertical: 14,
        },
        pressed && banks.length > 1 && { opacity: 0.92 },
      ]}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: theme.primaryTint,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="card" size={18} color={theme.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            ...theme.type.body,
            color: theme.fg,
            fontWeight: "800",
          }}
          numberOfLines={1}
        >
          {picked
            ? `${picked.bankName} ••${picked.accountNumber.slice(-4)}`
            : "Pick a bank"}
        </Text>
        <Text
          style={{
            ...theme.type.bodySm,
            color: theme.fgMuted,
            marginTop: 2,
          }}
          numberOfLines={1}
        >
          {picked?.accountName ?? ""}
          {picked?.isPrimary ? "  ·  Primary" : ""}
        </Text>
      </View>
      {banks.length > 1 ? (
        <Text
          style={{
            ...theme.type.bodySm,
            color: theme.primary,
            fontWeight: "800",
          }}
        >
          Change
        </Text>
      ) : null}
    </Pressable>
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
    headlineWrap: {
      alignItems: "center",
      paddingTop: 12,
      paddingBottom: 4,
    },
    headlineEyebrow: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.5,
      textTransform: "uppercase",
      color: theme.fgMuted,
    },
    headlineAmount: {
      fontSize: 44,
      fontWeight: "800",
      letterSpacing: -0.8,
      color: theme.fg,
      marginTop: 6,
      textAlign: "center",
      minWidth: 200,
      paddingHorizontal: 16,
    },
    headlineAvailable: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      marginTop: 4,
    },
    quickRow: {
      flexDirection: "row",
      gap: 6,
    },
    quickChip: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: theme.bgMuted,
      borderWidth: 1,
      borderColor: theme.divider,
      alignItems: "center",
      justifyContent: "center",
    },
    quickChipActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    quickText: {
      ...theme.type.bodySm,
      color: theme.fg,
      fontWeight: "700",
    },
    quickTextActive: {
      color: theme.fgOnPrimary,
    },
    errorText: {
      ...theme.type.bodySm,
      color: theme.error,
      fontWeight: "700",
      textAlign: "center",
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
