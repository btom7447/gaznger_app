import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
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

interface BankAccountRow {
  _id: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  isPrimary: boolean;
  bvnVerified: boolean;
}

export default function VendorBanksScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [banks, setBanks] = useState<BankAccountRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const styles = useMemo(() => makeStyles(theme), [theme]);

  const fetchBanks = useCallback(async () => {
    try {
      const res = await api.get<{ accounts: BankAccountRow[] }>(
        "/api/vendor/banks/saved",
        { timeoutMs: 10_000 },
      );
      setBanks(res.accounts ?? []);
    } catch {
      setBanks([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchBanks();
  }, [fetchBanks]);

  useFocusEffect(
    useCallback(() => {
      fetchBanks();
    }, [fetchBanks]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBanks();
  }, [fetchBanks]);

  const handleMakePrimary = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        await api.patch(`/api/vendor/banks/saved/${id}/primary`);
        toast.success("Primary bank updated");
        await fetchBanks();
      } catch (err: any) {
        toast.error(err?.message ?? "Couldn't update primary bank");
      } finally {
        setBusyId(null);
      }
    },
    [fetchBanks],
  );

  const handleRemove = useCallback(
    (row: BankAccountRow) => {
      Alert.alert(
        "Remove bank?",
        `${row.bankName} · ${row.accountNumber}`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              setBusyId(row._id);
              try {
                await api.delete(`/api/vendor/banks/saved/${row._id}`);
                toast.success("Bank removed");
                await fetchBanks();
              } catch (err: any) {
                toast.error(err?.message ?? "Couldn't remove bank");
              } finally {
                setBusyId(null);
              }
            },
          },
        ],
        { cancelable: true },
      );
    },
    [fetchBanks],
  );

  return (
    <VendorScreenShell
      title="Banks"
      rightSlot={
        <Pressable
          onPress={() => router.push("/(vendor)/(finance)/bank-add" as never)}
          accessibilityRole="button"
          accessibilityLabel="Add bank"
          hitSlop={6}
          style={({ pressed }) => [
            styles.addBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons name="add" size={16} color={theme.fgOnPrimary} />
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      }
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
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

        {loading && !banks ? (
          <SkelStack gap={10}>
            <Skel height={88} radius={16} />
            <Skel height={88} radius={16} />
          </SkelStack>
        ) : !banks || banks.length === 0 ? (
          <VendorEmptyState
            icon="card-outline"
            headline="No banks yet"
            body="Add a bank account to receive payouts."
            ctaLabel="Add bank"
            onCta={() =>
              router.push("/(vendor)/(finance)/bank-add" as never)
            }
          />
        ) : (
          <View style={styles.list}>
            {banks.map((b) => (
              <VendorCard key={b._id}>
                <View style={styles.row}>
                  <View style={styles.iconDisc}>
                    <Ionicons name="card" size={18} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={styles.titleRow}>
                      <Text style={styles.bankName} numberOfLines={1}>
                        {b.bankName}
                      </Text>
                      {b.isPrimary ? (
                        <VendorPill tone="primary" size="sm">
                          Primary
                        </VendorPill>
                      ) : null}
                    </View>
                    <Text style={styles.acct} numberOfLines={1}>
                      {b.accountNumber} · {b.accountName}
                    </Text>
                  </View>
                </View>
                <View style={styles.actionRow}>
                  {!b.isPrimary ? (
                    <Pressable
                      onPress={() => handleMakePrimary(b._id)}
                      disabled={busyId === b._id}
                      accessibilityRole="button"
                      hitSlop={4}
                      style={({ pressed }) => [
                        styles.ghostBtn,
                        busyId === b._id && { opacity: 0.5 },
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text style={styles.ghostBtnText}>Make primary</Text>
                    </Pressable>
                  ) : (
                    <View style={{ flex: 1 }} />
                  )}
                  <Pressable
                    onPress={() => handleRemove(b)}
                    disabled={busyId === b._id}
                    accessibilityRole="button"
                    accessibilityLabel="Remove bank"
                    hitSlop={4}
                    style={({ pressed }) => [
                      styles.dangerBtn,
                      busyId === b._id && { opacity: 0.5 },
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={16}
                      color={theme.error}
                    />
                    <Text style={styles.dangerBtnText}>Remove</Text>
                  </Pressable>
                </View>
              </VendorCard>
            ))}
          </View>
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
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: theme.radius.pill,
    },
    addBtnText: {
      ...theme.type.bodySm,
      color: theme.fgOnPrimary,
      fontWeight: "800",
    },
    list: { gap: 10 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    iconDisc: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primaryTint,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    bankName: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
      flexShrink: 1,
    },
    acct: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 12,
    },
    ghostBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 8,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    ghostBtnText: {
      ...theme.type.bodySm,
      color: theme.fg,
      fontWeight: "700",
    },
    dangerBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      borderWidth: 1,
      borderColor: theme.errorTint,
      backgroundColor: theme.errorTint,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: theme.radius.pill,
    },
    dangerBtnText: {
      ...theme.type.bodySm,
      color: theme.error,
      fontWeight: "700",
    },
  });
