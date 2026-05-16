import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { toast } from "sonner-native";
import {
  AlertChip,
  Skel,
  SkelStack,
  VendorCard,
  VendorScreenShell,
} from "@/components/ui/vendor";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";
import { useVendorStationStore } from "@/store/useVendorStationStore";

interface PaystackBank {
  id: number;
  name: string;
  code: string;
  slug?: string;
}

interface BanksResp {
  banks: PaystackBank[];
}

interface ResolveResp {
  account_name?: string;
  account_number?: string;
}

export default function VendorBankAddScreen() {
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams<{ stationId?: string }>();
  const stations = useVendorStationStore((s) => s.stations);

  const [banks, setBanks] = useState<PaystackBank[] | null>(null);
  const [banksLoading, setBanksLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [picked, setPicked] = useState<PaystackBank | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Station this bank belongs to. Preselected if the user came here
  // with a ?stationId param, otherwise defaults to the first station.
  const [stationId, setStationId] = useState<string | null>(
    params.stationId ?? stations[0]?.id ?? null,
  );
  const [stationPickerOpen, setStationPickerOpen] = useState(false);
  const pickedStation = stations.find((s) => s.id === stationId) ?? null;

  const styles = useMemo(() => makeStyles(theme), [theme]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<BanksResp>("/api/vendor/banks", {
          timeoutMs: 15_000,
        });
        if (cancelled) return;
        setBanks(res.banks ?? []);
      } catch {
        if (!cancelled) setBanks([]);
      } finally {
        if (!cancelled) setBanksLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-resolve once account number is 10 digits + bank picked.
  useEffect(() => {
    setResolved(null);
    setResolveError(null);
    if (!picked || accountNumber.length !== 10) return;
    let cancelled = false;
    setResolving(true);
    (async () => {
      try {
        const res = await api.get<ResolveResp>(
          `/api/vendor/bank/resolve?account_number=${encodeURIComponent(
            accountNumber,
          )}&bank_code=${encodeURIComponent(picked.code)}`,
          { timeoutMs: 15_000 },
        );
        if (cancelled) return;
        if (res.account_name) {
          setResolved(res.account_name);
        } else {
          setResolveError("Couldn't verify account.");
        }
      } catch (err: any) {
        if (cancelled) return;
        setResolveError(
          err?.message ?? "Couldn't verify account. Check details.",
        );
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [picked, accountNumber]);

  const filteredBanks = useMemo(() => {
    if (!banks) return [];
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return banks;
    return banks.filter((b) => b.name.toLowerCase().includes(q));
  }, [banks, pickerQuery]);

  const canSubmit =
    !!picked && !!resolved && !!stationId && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !picked || !resolved || !stationId) return;
    setSubmitting(true);
    try {
      await api.post("/api/vendor/banks/saved", {
        bankName: picked.name,
        bankCode: picked.code,
        accountNumber,
        stationId,
      });
      toast.success("Bank added");
      router.replace("/(vendor)/(finance)/banks" as never);
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status;
      if (status === 409) {
        toast.error("That bank account is already saved");
      } else {
        toast.error(err?.message ?? "Couldn't add bank");
      }
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, picked, resolved, accountNumber, stationId, router]);

  return (
    <VendorScreenShell title="Add bank" hideStationSwitcher>
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
          <Text style={styles.backText}>Back to banks</Text>
        </Pressable>

        <VendorCard>
          <Text style={styles.cardLabel}>Station</Text>
          <Pressable
            onPress={() => setStationPickerOpen(true)}
            disabled={stations.length === 0}
            accessibilityRole="button"
            accessibilityLabel="Choose station"
            style={({ pressed }) => [
              styles.selectBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text
              style={[
                styles.selectText,
                !pickedStation && { color: theme.fgMuted },
              ]}
              numberOfLines={1}
            >
              {pickedStation?.name ?? "Pick a station"}
            </Text>
            <Ionicons
              name="chevron-down"
              size={18}
              color={theme.fgMuted}
            />
          </Pressable>
          <Text style={styles.helper}>
            Payouts from this station settle to the bank below.
          </Text>
        </VendorCard>

        <VendorCard>
          <Text style={styles.cardLabel}>Bank</Text>
          <Pressable
            onPress={() => setPickerOpen(true)}
            disabled={banksLoading}
            accessibilityRole="button"
            accessibilityLabel="Choose bank"
            style={({ pressed }) => [
              styles.selectBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            {banksLoading ? (
              <SkelStack gap={0}>
                <Skel height={20} radius={6} />
              </SkelStack>
            ) : (
              <>
                <Text
                  style={[
                    styles.selectText,
                    !picked && { color: theme.fgMuted },
                  ]}
                  numberOfLines={1}
                >
                  {picked?.name ?? "Choose your bank"}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={18}
                  color={theme.fgMuted}
                />
              </>
            )}
          </Pressable>
        </VendorCard>

        <VendorCard>
          <Text style={styles.cardLabel}>Account number</Text>
          <TextInput
            style={styles.input}
            placeholder="10-digit NUBAN"
            placeholderTextColor={theme.fgMuted}
            keyboardType="number-pad"
            maxLength={10}
            value={accountNumber}
            onChangeText={(t) => setAccountNumber(t.replace(/[^0-9]/g, ""))}
            accessibilityLabel="Account number"
          />

          {resolving ? (
            <View style={styles.resolveRow}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={styles.resolveText}>Verifying…</Text>
            </View>
          ) : resolved ? (
            <View style={styles.resolveRow}>
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={theme.success}
              />
              <Text style={[styles.resolveText, { color: theme.success }]}>
                {resolved}
              </Text>
            </View>
          ) : resolveError ? (
            <Text style={styles.errorText}>{resolveError}</Text>
          ) : accountNumber.length > 0 && accountNumber.length < 10 ? (
            <Text style={styles.hint}>
              {10 - accountNumber.length} more digit
              {10 - accountNumber.length === 1 ? "" : "s"}
            </Text>
          ) : null}
        </VendorCard>

        <AlertChip
          tone="info"
          icon="shield-checkmark"
          title="Name must match your profile"
          sub="Paystack rejects payouts when the account name doesn't match the registered vendor."
        />
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel="Save bank"
          style={({ pressed }) => [
            styles.primaryBtn,
            !canSubmit && { opacity: 0.5 },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.primaryBtnText}>
            {submitting ? "Saving…" : "Save bank"}
          </Text>
        </Pressable>
      </View>

      <Modal
        visible={pickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose bank</Text>
              <Pressable
                onPress={() => setPickerOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={6}
              >
                <Ionicons name="close" size={22} color={theme.fg} />
              </Pressable>
            </View>
            <TextInput
              style={styles.search}
              placeholder="Search banks"
              placeholderTextColor={theme.fgMuted}
              value={pickerQuery}
              onChangeText={setPickerQuery}
              autoCorrect={false}
              autoCapitalize="none"
            />
            <FlatList
              data={filteredBanks}
              keyExtractor={(b) => String(b.id ?? b.code)}
              keyboardShouldPersistTaps="handled"
              ItemSeparatorComponent={() => (
                <View style={styles.modalSep} />
              )}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setPicked(item);
                    setPickerOpen(false);
                    setPickerQuery("");
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.modalRow,
                    pressed && { backgroundColor: theme.bgMuted },
                  ]}
                >
                  <Text style={styles.modalRowText} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {picked?.code === item.code ? (
                    <Ionicons
                      name="checkmark"
                      size={18}
                      color={theme.primary}
                    />
                  ) : null}
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.modalEmpty}>No matches.</Text>
              }
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={stationPickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setStationPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose station</Text>
              <Pressable
                onPress={() => setStationPickerOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={6}
              >
                <Ionicons name="close" size={22} color={theme.fg} />
              </Pressable>
            </View>
            <FlatList
              data={stations}
              keyExtractor={(s) => s.id}
              keyboardShouldPersistTaps="handled"
              ItemSeparatorComponent={() => (
                <View style={styles.modalSep} />
              )}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setStationId(item.id);
                    setStationPickerOpen(false);
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.modalRow,
                    pressed && { backgroundColor: theme.bgMuted },
                  ]}
                >
                  <Text style={styles.modalRowText} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {stationId === item.id ? (
                    <Ionicons
                      name="checkmark"
                      size={18}
                      color={theme.primary}
                    />
                  ) : null}
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.modalEmpty}>
                  No stations yet. Add one in Profile.
                </Text>
              }
            />
          </View>
        </View>
      </Modal>
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
    helper: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      marginTop: 8,
    },
    selectBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: theme.radius.lg,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: theme.surface,
    },
    selectText: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
      flex: 1,
    },
    input: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
      letterSpacing: 1,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: theme.radius.lg,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: theme.surface,
    },
    resolveRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 10,
    },
    resolveText: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      fontWeight: "700",
      flex: 1,
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
      marginTop: 8,
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
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "flex-end",
    },
    modalSheet: {
      backgroundColor: theme.bg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 24,
      maxHeight: "85%",
    },
    modalHandle: {
      alignSelf: "center",
      width: 44,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.border,
      marginBottom: 12,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 4,
      marginBottom: 10,
    },
    modalTitle: {
      ...theme.type.h2,
      color: theme.fg,
      fontWeight: "800",
    },
    search: {
      ...theme.type.body,
      color: theme.fg,
      backgroundColor: theme.bgMuted,
      borderRadius: theme.radius.pill,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 8,
    },
    modalRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: theme.radius.md,
    },
    modalRowText: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "600",
      flex: 1,
    },
    modalSep: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.border,
      marginHorizontal: 8,
    },
    modalEmpty: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      textAlign: "center",
      paddingVertical: 24,
    },
  });
