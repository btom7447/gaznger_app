import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { toast } from "sonner-native";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";
import BackButton from "@/components/ui/global/BackButton";

interface Bank { id: number; name: string; code: string; }
interface BankAccount {
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
}

export default function RiderBankAccountScreen() {
  const theme = useTheme();

  const [existing, setExisting] = useState<BankAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  // Form state
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [resolving, setResolving] = useState(false);

  // Bank picker
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankSearch, setBankSearch] = useState("");
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [loadingBanks, setLoadingBanks] = useState(false);

  const filteredBanks = banks.filter((b) =>
    b.name.toLowerCase().includes(bankSearch.toLowerCase())
  );

  const fetchProfile = useCallback(async () => {
    try {
      const data = await api.get<{ bankAccount?: BankAccount }>("/api/rider/profile");
      if (data.bankAccount) {
        setExisting(data.bankAccount as BankAccount);
      } else {
        setEditing(true);
      }
    } catch {
      toast.error("Failed to load bank account");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBanks = useCallback(async () => {
    if (banks.length > 0) return;
    setLoadingBanks(true);
    try {
      const res = await api.get<{ banks: Bank[] }>("/api/rider/banks");
      setBanks(res.banks ?? []);
    } catch {
      toast.error("Could not load bank list");
    } finally {
      setLoadingBanks(false);
    }
  }, [banks.length]);

  useFocusEffect(useCallback(() => { fetchProfile(); }, [fetchProfile]));

  // Auto-resolve account name when account number is 10 digits and bank is selected
  useEffect(() => {
    if (!selectedBank || accountNumber.length !== 10) {
      if (accountNumber.length < 10) setAccountName("");
      return;
    }
    let cancelled = false;
    const resolve = async () => {
      setResolving(true);
      try {
        const res = await api.get<{ account_name: string }>(
          `/api/rider/bank/resolve?account_number=${accountNumber}&bank_code=${selectedBank.code}`
        );
        if (!cancelled) setAccountName(res.account_name ?? "");
      } catch {
        if (!cancelled) {
          setAccountName("");
          toast.error("Could not verify account", { description: "Check the number and try again." });
        }
      } finally {
        if (!cancelled) setResolving(false);
      }
    };
    resolve();
    return () => { cancelled = true; };
  }, [accountNumber, selectedBank]);

  const handleSave = async () => {
    if (!selectedBank || !accountNumber || !accountName) {
      toast.error("Select a bank and enter your account number");
      return;
    }
    if (accountNumber.length !== 10) {
      toast.error("Enter a valid 10-digit account number");
      return;
    }
    setSaving(true);
    try {
      await api.patch("/api/rider/profile", {
        bankAccount: {
          bankName: selectedBank.name,
          bankCode: selectedBank.code,
          accountNumber,
          accountName,
        },
      });
      setExisting({ bankName: selectedBank.name, bankCode: selectedBank.code, accountNumber, accountName });
      setEditing(false);
      toast.success("Bank account updated");
    } catch (err: any) {
      toast.error("Failed to save", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = () => {
    if (existing) {
      setSelectedBank(existing.bankCode ? { id: 0, name: existing.bankName, code: existing.bankCode } : null);
      setAccountNumber(existing.accountNumber);
      setAccountName(existing.accountName);
    }
    fetchBanks();
    setEditing(true);
  };

  const s = styles(theme);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
      <View style={[s.header, { borderBottomColor: theme.ash }]}>
        <BackButton />
        <Text style={[s.headerTitle, { color: theme.text }]}>Bank Account</Text>
        {existing && !editing ? (
          <TouchableOpacity onPress={startEdit} activeOpacity={0.7} style={s.editBtn}>
            <Text style={[s.editBtnText, { color: theme.primary }]}>Edit</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={[s.infoBox, { backgroundColor: theme.tertiary }]}>
            <Ionicons name="information-circle-outline" size={16} color={theme.primary} />
            <Text style={[s.infoText, { color: theme.text }]}>
              Your bank account is used for payout of settled earnings. Account name is verified automatically via Paystack.
            </Text>
          </View>

          {existing && !editing ? (
            <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
              {[
                { icon: "business-outline", label: "Bank Name", value: existing.bankName },
                { icon: "person-outline", label: "Account Name", value: existing.accountName },
                { icon: "lock-closed-outline", label: "Account Number", value: "••••••" + existing.accountNumber.slice(-4) },
              ].map((row, i) => (
                <View key={row.label}>
                  {i > 0 && <View style={[s.divider, { backgroundColor: theme.ash }]} />}
                  <View style={s.cardRow}>
                    <View style={[s.rowIcon, { backgroundColor: theme.tertiary }]}>
                      <Ionicons name={row.icon as any} size={16} color={theme.primary} />
                    </View>
                    <View style={s.rowText}>
                      <Text style={[s.rowLabel, { color: theme.icon }]}>{row.label}</Text>
                      <Text style={[s.rowValue, { color: theme.text }]}>{row.value}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={s.form}>
              {/* Bank picker trigger */}
              <Text style={[s.fieldLabel, { color: theme.icon }]}>Bank</Text>
              <TouchableOpacity
                style={[s.inputWrap, { borderColor: theme.borderMid, backgroundColor: theme.surface }]}
                onPress={() => { fetchBanks(); setShowBankPicker(true); }}
                activeOpacity={0.8}
              >
                <Ionicons name="business-outline" size={16} color={theme.icon} />
                <Text style={[s.input, { color: selectedBank ? theme.text : theme.icon }]}>
                  {selectedBank ? selectedBank.name : "Select your bank"}
                </Text>
                <Ionicons name="chevron-down" size={16} color={theme.icon} />
              </TouchableOpacity>

              {/* Account number */}
              <Text style={[s.fieldLabel, { color: theme.icon }]}>Account Number</Text>
              <View style={[s.inputWrap, { borderColor: theme.borderMid, backgroundColor: theme.surface }]}>
                <Ionicons name="card-outline" size={16} color={theme.icon} />
                <TextInput
                  style={[s.input, { color: theme.text }]}
                  value={accountNumber}
                  onChangeText={(v) => setAccountNumber(v.replace(/\D/g, "").slice(0, 10))}
                  placeholder="10-digit account number"
                  placeholderTextColor={theme.icon}
                  keyboardType="numeric"
                  maxLength={10}
                />
                {resolving && <ActivityIndicator size="small" color={theme.primary} />}
              </View>

              {/* Account name (auto-resolved) */}
              <Text style={[s.fieldLabel, { color: theme.icon }]}>Account Name</Text>
              <View style={[s.inputWrap, { borderColor: accountName ? "#10B981" : theme.borderMid, backgroundColor: theme.surface }]}>
                <Ionicons
                  name={accountName ? "checkmark-circle" : "person-outline"}
                  size={16}
                  color={accountName ? "#10B981" : theme.icon}
                />
                <Text style={[s.input, { color: accountName ? theme.text : theme.icon }]}>
                  {accountName || (resolving ? "Verifying…" : "Auto-filled after entering account number")}
                </Text>
              </View>

              <View style={s.btnRow}>
                {existing && (
                  <TouchableOpacity
                    style={[s.btn, s.btnCancel, { borderColor: theme.borderMid }]}
                    onPress={() => setEditing(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.btnText, { color: theme.text }]}>Cancel</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[s.btn, s.btnSave, { backgroundColor: theme.primary, opacity: (!accountName || saving) ? 0.6 : 1 }]}
                  onPress={handleSave}
                  disabled={saving || !accountName}
                  activeOpacity={0.85}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={[s.btnText, { color: "#fff" }]}>Save Account</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* Bank Picker Modal */}
      <Modal
        visible={showBankPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowBankPicker(false)}
      >
        <SafeAreaView style={[s.pickerSafe, { backgroundColor: theme.background }]}>
          <View style={[s.pickerHeader, { borderBottomColor: theme.ash }]}>
            <Text style={[s.pickerTitle, { color: theme.text }]}>Select Bank</Text>
            <TouchableOpacity onPress={() => setShowBankPicker(false)} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={theme.icon} />
            </TouchableOpacity>
          </View>
          <View style={[s.searchWrap, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
            <Ionicons name="search-outline" size={16} color={theme.icon} />
            <TextInput
              style={[s.searchInput, { color: theme.text }]}
              placeholder="Search banks…"
              placeholderTextColor={theme.icon}
              value={bankSearch}
              onChangeText={setBankSearch}
              autoFocus
            />
          </View>
          {loadingBanks ? (
            <View style={s.center}>
              <ActivityIndicator color={theme.primary} />
            </View>
          ) : (
            <FlatList
              data={filteredBanks}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.bankItem, { borderBottomColor: theme.ash }]}
                  onPress={() => {
                    setSelectedBank(item);
                    setAccountName("");
                    setBankSearch("");
                    setShowBankPicker(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[s.bankItemText, { color: theme.text }]}>{item.name}</Text>
                  {selectedBank?.code === item.code && (
                    <Ionicons name="checkmark-circle" size={18} color={theme.primary} />
                  )}
                </TouchableOpacity>
              )}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1 },
    center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
    header: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 12,
    },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: "700" },
    editBtn: { padding: 4 },
    editBtnText: { fontSize: 14, fontWeight: "600" },
    scroll: { padding: 20, gap: 16, paddingBottom: 40 },

    infoBox: { flexDirection: "row", gap: 10, alignItems: "flex-start", padding: 12, borderRadius: 12 },
    infoText: { flex: 1, fontSize: 13, lineHeight: 19 },

    card: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
    cardRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
    rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    rowText: { flex: 1 },
    rowLabel: { fontSize: 11, marginBottom: 2 },
    rowValue: { fontSize: 14, fontWeight: "500" },
    divider: { height: 1, marginHorizontal: 14 },

    form: { gap: 6 },
    fieldLabel: { fontSize: 12, fontWeight: "600", marginBottom: 2, marginTop: 8, paddingLeft: 2 },
    inputWrap: {
      flexDirection: "row", alignItems: "center", gap: 10,
      borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    },
    input: { flex: 1, fontSize: 14 },

    btnRow: { flexDirection: "row", gap: 10, marginTop: 16 },
    btn: { flex: 1, height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    btnCancel: { borderWidth: 1.5, backgroundColor: "transparent" },
    btnSave: {},
    btnText: { fontSize: 15, fontWeight: "700" },

    // Bank picker modal
    pickerSafe: { flex: 1 },
    pickerHeader: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
    },
    pickerTitle: { fontSize: 18, fontWeight: "700" },
    searchWrap: {
      flexDirection: "row", alignItems: "center", gap: 10,
      margin: 16, borderRadius: 12, borderWidth: 1.5,
      paddingHorizontal: 14, paddingVertical: 11,
    },
    searchInput: { flex: 1, fontSize: 14 },
    bankItem: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
    },
    bankItemText: { fontSize: 15 },
  });
