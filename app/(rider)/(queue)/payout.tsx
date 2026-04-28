import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { toast } from "sonner-native";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";
import NotificationButton from "@/components/ui/global/NotificationButton";
import ProfileButton from "@/components/ui/global/ProfileButton";
import { useSessionStore } from "@/store/useSessionStore";
import Skeleton from "@/components/ui/global/Skeleton";

interface EarningsSummary {
  pending: number;
  settled: number;
}

interface BankAccount {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

function fmtCurrency(n: number) {
  return "₦" + n.toLocaleString("en-NG");
}

export default function RiderPayoutScreen() {
  const theme = useTheme();
  const router = useRouter();
  const user = useSessionStore((s) => s.user);

  const [summary, setSummary] = useState<EarningsSummary>({ pending: 0, settled: 0 });
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [earningsRes, profileRes] = await Promise.all([
        api.get<{ summary: EarningsSummary }>("/api/rider/earnings?limit=1"),
        api.get<{ bankAccount?: BankAccount }>("/api/rider/profile"),
      ]);
      setSummary(earningsRes.summary ?? { pending: 0, settled: 0 });
      setBankAccount((profileRes as any).bankAccount ?? null);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleRequestPayout = async () => {
    const parsed = parseFloat(amount.replace(/,/g, ""));
    if (!parsed || parsed <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!bankAccount) {
      toast.error("Add a bank account first", { description: "Go to Profile → Bank Account" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post<{ message: string; status: string }>("/api/rider/withdraw", { amount: parsed });
      toast.success(
        res.status === "processing" ? "Payout initiated!" : "Payout requested!",
        { description: res.message }
      );
      setAmount("");
      load();
    } catch (err: any) {
      toast.error("Request failed", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const s = styles(theme);
  const settled = summary.settled;

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={[s.greeting, { color: theme.icon }]}>Earnings</Text>
            <Text style={[s.title, { color: theme.text }]}>Request Payout</Text>
          </View>
          <View style={s.headerRight}>
            <NotificationButton
              onPress={() => router.push("/(screens)/notification" as any)}
            />
            <ProfileButton
              onPress={() => router.push("/(rider)/(queue)/profile" as any)}
              size={40}
            />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Balance card */}
          {loading ? (
            <View style={[s.balanceCard, { backgroundColor: theme.primary }]}>
              <Skeleton
                width={100}
                height={13}
                borderRadius={6}
                color="rgba(255,255,255,0.25)"
              />
              <Skeleton
                width={160}
                height={36}
                borderRadius={8}
                color="rgba(255,255,255,0.3)"
                style={{ marginTop: 8 }}
              />
              <Skeleton
                width={200}
                height={11}
                borderRadius={5}
                color="rgba(255,255,255,0.2)"
                style={{ marginTop: 4, marginBottom: 16 }}
              />
              <View style={[s.balanceMeta]}>
                <View style={s.balanceMetaItem}>
                  <Skeleton
                    width={60}
                    height={15}
                    borderRadius={6}
                    color="rgba(255,255,255,0.3)"
                  />
                  <Skeleton
                    width={40}
                    height={11}
                    borderRadius={5}
                    color="rgba(255,255,255,0.2)"
                    style={{ marginTop: 4 }}
                  />
                </View>
                <View style={s.balanceMetaDivider} />
                <View style={s.balanceMetaItem}>
                  <Skeleton
                    width={60}
                    height={15}
                    borderRadius={6}
                    color="rgba(255,255,255,0.3)"
                  />
                  <Skeleton
                    width={40}
                    height={11}
                    borderRadius={5}
                    color="rgba(255,255,255,0.2)"
                    style={{ marginTop: 4 }}
                  />
                </View>
              </View>
            </View>
          ) : (
            <View style={[s.balanceCard, { backgroundColor: theme.primary }]}>
              <Text style={s.balanceLabel}>Available Balance</Text>
              <Text style={s.balanceAmount}>{fmtCurrency(settled)}</Text>
              <Text style={s.balanceSub}>
                Settled earnings ready for withdrawal
              </Text>

              <View style={s.balanceMeta}>
                <View style={s.balanceMetaItem}>
                  <Text style={s.balanceMetaVal}>
                    {fmtCurrency(summary.pending)}
                  </Text>
                  <Text style={s.balanceMetaLbl}>Pending</Text>
                </View>
                <View style={[s.balanceMetaDivider]} />
                <View style={s.balanceMetaItem}>
                  <Text style={s.balanceMetaVal}>{fmtCurrency(settled)}</Text>
                  <Text style={s.balanceMetaLbl}>Settled</Text>
                </View>
              </View>
            </View>
          )}

          {/* Bank account */}
          <Text style={[s.sectionTitle, { color: theme.icon }]}>Payout To</Text>
          {bankAccount ? (
            <View
              style={[
                s.bankCard,
                { backgroundColor: theme.surface, borderColor: theme.ash },
              ]}
            >
              <View style={[s.bankIcon, { backgroundColor: theme.tertiary }]}>
                <Ionicons name="card-outline" size={20} color={theme.primary} />
              </View>
              <View style={s.bankInfo}>
                <Text style={[s.bankName, { color: theme.text }]}>
                  {bankAccount.bankName}
                </Text>
                <Text style={[s.bankDetail, { color: theme.icon }]}>
                  {bankAccount.accountName} · ••••
                  {bankAccount.accountNumber.slice(-4)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() =>
                  router.push("/(rider)/(screens)/bank-account" as any)
                }
              >
                <Text style={[s.changeText, { color: theme.primary }]}>
                  Change
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                s.bankCard,
                s.bankCardEmpty,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.primary + "44",
                  borderStyle: "dashed",
                },
              ]}
              onPress={() =>
                router.push("/(rider)/(screens)/bank-account" as any)
              }
              activeOpacity={0.8}
            >
              <View style={[s.bankIcon, { backgroundColor: theme.tertiary }]}>
                <Ionicons name="add" size={20} color={theme.primary} />
              </View>
              <Text style={[s.bankCardEmptyText, { color: theme.primary }]}>
                Add Bank Account
              </Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={theme.primary}
              />
            </TouchableOpacity>
          )}

          {/* Amount input */}
          <Text style={[s.sectionTitle, { color: theme.icon }]}>Amount</Text>
          <View style={s.fieldContainer}>
            {/* Input */}
            <TouchableOpacity
              activeOpacity={1}
              style={[
                s.inputWrapper,
                { borderColor: theme.ash, backgroundColor: theme.surface },
              ]}
            >
              {/* Prefix */}
              <View style={s.prefixWrap}>
                <Text style={[s.prefix, { color: theme.primary }]}>₦</Text>
              </View>

              {/* Divider */}
              <View style={[s.vDivider, { backgroundColor: theme.ash }]} />

              {/* Input */}
              <TextInput
                style={[s.inputNew, { color: theme.text }]}
                placeholder="Enter amount"
                placeholderTextColor={theme.icon}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />

              {/* Max */}
              <TouchableOpacity
                onPress={() => setAmount(String(settled))}
                style={s.maxBtnWrap}
              >
                <Text style={[s.maxBtn, { color: theme.primary }]}>MAX</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </View>

          {/* Info note */}
          <View
            style={[
              s.note,
              {
                backgroundColor: theme.primary + "10",
                borderColor: theme.primary + "30",
              },
            ]}
          >
            <Ionicons name="flash-outline" size={16} color={theme.primary} />
            <Text style={[s.noteText, { color: theme.icon }]}>
              Payouts are processed via Paystack. With a verified bank account,
              funds arrive within minutes. Only settled earnings can be
              withdrawn.
            </Text>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[
              s.submitBtn,
              { backgroundColor: theme.primary, opacity: submitting ? 0.7 : 1 },
            ]}
            onPress={handleRequestPayout}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={s.submitText}>Request Payout</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = (
  theme: ReturnType<typeof import("@/constants/theme").useTheme>,
) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 4,
    },
    greeting: { fontSize: 13 },
    title: { fontSize: 22, fontWeight: "700", marginTop: 2 },
    headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
    scroll: { padding: 20, gap: 14, paddingBottom: 120 },

    balanceCard: {
      borderRadius: 20,
      padding: 24,
      gap: 4,
    },
    balanceLabel: {
      fontSize: 13,
      color: "rgba(255,255,255,0.7)",
      fontWeight: "500",
    },
    balanceAmount: {
      fontSize: 36,
      fontWeight: "800",
      color: "#fff",
      letterSpacing: -1,
    },
    balanceSub: {
      fontSize: 12,
      color: "rgba(255,255,255,0.6)",
      marginBottom: 16,
    },
    balanceMeta: {
      flexDirection: "row",
      backgroundColor: "rgba(255,255,255,0.15)",
      borderRadius: 12,
      padding: 12,
      alignItems: "center",
    },
    balanceMetaItem: { flex: 1, alignItems: "center", gap: 3 },
    balanceMetaVal: { fontSize: 15, fontWeight: "700", color: "#fff" },
    balanceMetaLbl: { fontSize: 11, color: "rgba(255,255,255,0.65)" },
    balanceMetaDivider: {
      width: 1,
      height: 28,
      backgroundColor: "rgba(255,255,255,0.25)",
      marginHorizontal: 8,
    },

    sectionTitle: {
      fontSize: 11,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.8,
      paddingLeft: 2,
    },

    bankCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderRadius: 14,
      borderWidth: 1,
      padding: 14,
    },
    bankCardEmpty: { justifyContent: "flex-start" },
    bankIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    bankInfo: { flex: 1 },
    bankName: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
    bankDetail: { fontSize: 12 },
    changeText: { fontSize: 13, fontWeight: "600" },
    bankCardEmptyText: { flex: 1, fontSize: 14, fontWeight: "600" },

    note: {
      flexDirection: "row",
      gap: 8,
      alignItems: "flex-start",
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
    },
    noteText: { flex: 1, fontSize: 12, lineHeight: 18 },

    submitBtn: {
      height: 54,
      borderRadius: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    submitText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    fieldContainer: { marginTop: 4 },

    inputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1.5,
      borderRadius: 14,
      height: 56,
      overflow: "hidden",
    },

    prefixWrap: {
      width: 54,
      alignItems: "center",
      justifyContent: "center",
    },

    prefix: {
      fontSize: 16,
      fontWeight: "600",
    },

    vDivider: {
      width: 1,
      height: 28,
    },

    inputNew: {
      flex: 1,
      fontSize: 16,
      paddingHorizontal: 16,
    },

    maxBtnWrap: {
      paddingHorizontal: 14,
      justifyContent: "center",
    },

    maxBtn: {
      fontSize: 12,
      fontWeight: "600",
    },
  });
