import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { toast } from "sonner-native";
import {
  AlertChip,
  Skel,
  SkelStack,
  VendorCard,
  VendorEmptyState,
  VendorPill,
  VendorScreenShell,
} from "@/components/ui/vendor";
import { useVendorStationStore } from "@/store/useVendorStationStore";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";

interface TankRow {
  _id: string;
  capacity: number;
  currentLevel: number;
  unit: string;
  lowThresholdPct: number;
  label?: string;
  fuelType?: { _id: string; name: string; unit: string };
  station?: { _id: string; name: string };
}

interface FuelTypeRow {
  _id: string;
  name: string;
  unit: string;
}

export default function VendorTanksScreen() {
  const router = useRouter();
  const theme = useTheme();
  const activeStationId = useVendorStationStore((s) => s.activeStationId);

  const [tanks, setTanks] = useState<TankRow[] | null>(null);
  const [fuels, setFuels] = useState<FuelTypeRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Inline level edit state — keep raw text per tank id while user types.
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  // Add-tank inline form.
  const [showAdd, setShowAdd] = useState(false);
  const [addFuelId, setAddFuelId] = useState<string | null>(null);
  const [addCapacity, setAddCapacity] = useState("");
  const [addLevel, setAddLevel] = useState("");
  const [addingTank, setAddingTank] = useState(false);

  const styles = useMemo(() => makeStyles(theme), [theme]);

  const fetchAll = useCallback(async () => {
    try {
      const tankParams = activeStationId
        ? `?stationId=${encodeURIComponent(activeStationId)}`
        : "";
      const [t, f] = await Promise.allSettled([
        api.get<{ tanks: TankRow[] }>(`/api/vendor/tanks${tankParams}`, {
          timeoutMs: 10_000,
        }),
        api.get<FuelTypeRow[] | { fuelTypes: FuelTypeRow[] }>(
          "/api/fuel-types",
          { timeoutMs: 8000 },
        ),
      ]);
      if (t.status === "fulfilled") {
        setTanks(t.value.tanks ?? []);
        // Seed drafts from server values.
        const next: Record<string, string> = {};
        for (const row of t.value.tanks ?? []) {
          next[row._id] = String(row.currentLevel);
        }
        setDrafts(next);
      }
      if (f.status === "fulfilled") {
        const list = Array.isArray(f.value)
          ? f.value
          : (f.value?.fuelTypes ?? []);
        setFuels(list);
        if (!addFuelId && list[0]) setAddFuelId(list[0]._id);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeStationId, addFuelId]);

  useEffect(() => {
    setLoading(true);
    fetchAll();
  }, [fetchAll]);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAll();
  }, [fetchAll]);

  const saveLevel = useCallback(
    async (id: string) => {
      const raw = drafts[id];
      const next = parseFloat(raw);
      if (!Number.isFinite(next) || next < 0) {
        toast.error("Enter a valid level");
        return;
      }
      setSavingId(id);
      try {
        await api.patch(`/api/vendor/tanks/${id}`, { currentLevel: next });
        toast.success("Level updated");
        fetchAll();
      } catch (err: any) {
        toast.error(err?.message ?? "Couldn't update");
      } finally {
        setSavingId(null);
      }
    },
    [drafts, fetchAll],
  );

  const removeTank = useCallback(
    (id: string) => {
      Alert.alert("Delete tank?", "This tank will be removed.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/api/vendor/tanks/${id}`, {});
              toast.success("Tank removed");
              fetchAll();
            } catch (err: any) {
              toast.error(err?.message ?? "Couldn't delete");
            }
          },
        },
      ]);
    },
    [fetchAll],
  );

  const handleAdd = useCallback(async () => {
    if (!activeStationId) {
      toast.error("Pick an active station first");
      return;
    }
    if (!addFuelId) return;
    const cap = parseFloat(addCapacity);
    const lvl = parseFloat(addLevel);
    if (!Number.isFinite(cap) || cap <= 0) {
      toast.error("Enter capacity");
      return;
    }
    setAddingTank(true);
    try {
      await api.post("/api/vendor/tanks", {
        stationId: activeStationId,
        fuelTypeId: addFuelId,
        capacity: cap,
        currentLevel: Number.isFinite(lvl) && lvl >= 0 ? lvl : 0,
      });
      toast.success("Tank added");
      setShowAdd(false);
      setAddCapacity("");
      setAddLevel("");
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't add tank");
    } finally {
      setAddingTank(false);
    }
  }, [activeStationId, addFuelId, addCapacity, addLevel, fetchAll]);

  const lowCount = (tanks ?? []).filter(
    (t) => (t.currentLevel / t.capacity) * 100 <= t.lowThresholdPct,
  ).length;

  return (
    <VendorScreenShell
      title="Tanks"
      rightSlot={
        <Pressable
          onPress={() => setShowAdd((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={showAdd ? "Cancel" : "Add tank"}
          hitSlop={6}
          style={({ pressed }) => [
            styles.addBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons
            name={showAdd ? "close" : "add"}
            size={16}
            color={theme.fgOnPrimary}
          />
          <Text style={styles.addBtnText}>
            {showAdd ? "Cancel" : "Add"}
          </Text>
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
          <Text style={styles.backText}>Back to profile</Text>
        </Pressable>

        {lowCount > 0 ? (
          <AlertChip
            tone="warning"
            title={`${lowCount} tank${lowCount === 1 ? "" : "s"} below threshold`}
            sub="Place a bulk purchase to restock before stockout."
            cta="Order"
            onPress={() => router.push("/(vendor)/(supplies)/new" as never)}
          />
        ) : null}

        {showAdd ? (
          <VendorCard tone="primary">
            <Text style={styles.cardLabel}>New tank</Text>
            <Text style={styles.fieldLabel}>Fuel</Text>
            {fuels == null ? (
              <Skel height={36} radius={12} />
            ) : (
              <View style={styles.fuelRow}>
                {fuels.map((f) => {
                  const active = f._id === addFuelId;
                  return (
                    <Pressable
                      key={f._id}
                      onPress={() => setAddFuelId(f._id)}
                      hitSlop={4}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={({ pressed }) => [
                        styles.fuelChip,
                        active && styles.fuelChipActive,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.fuelChipText,
                          active && styles.fuelChipTextActive,
                        ]}
                      >
                        {f.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { marginTop: 12 }]}>
                  Capacity
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="30000"
                  placeholderTextColor={theme.fgMuted}
                  keyboardType="numeric"
                  value={addCapacity}
                  onChangeText={setAddCapacity}
                  accessibilityLabel="Capacity"
                />
              </View>
              <View style={{ width: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { marginTop: 12 }]}>
                  Current level
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor={theme.fgMuted}
                  keyboardType="numeric"
                  value={addLevel}
                  onChangeText={setAddLevel}
                  accessibilityLabel="Current level"
                />
              </View>
            </View>

            <Pressable
              onPress={handleAdd}
              disabled={addingTank}
              accessibilityRole="button"
              accessibilityLabel="Add tank"
              style={({ pressed }) => [
                styles.primaryBtn,
                addingTank && { opacity: 0.5 },
                pressed && { opacity: 0.85 },
                { marginTop: 14 },
              ]}
            >
              <Text style={styles.primaryBtnText}>
                {addingTank ? "Adding…" : "Add tank"}
              </Text>
            </Pressable>
          </VendorCard>
        ) : null}

        {loading && !tanks ? (
          <SkelStack gap={10}>
            <Skel height={96} radius={16} />
            <Skel height={96} radius={16} />
          </SkelStack>
        ) : !tanks || tanks.length === 0 ? (
          <VendorEmptyState
            icon="speedometer-outline"
            headline="No tanks yet"
            body="Add a tank for each fuel you stock to track levels and get restock alerts."
            ctaLabel="Add tank"
            onCta={() => setShowAdd(true)}
          />
        ) : (
          <View style={styles.list}>
            {tanks.map((t) => {
              const pct = Math.max(
                0,
                Math.min(100, (t.currentLevel / t.capacity) * 100),
              );
              const low = pct <= t.lowThresholdPct;
              const draft = drafts[t._id] ?? String(t.currentLevel);
              return (
                <View key={t._id} style={styles.tankCard}>
                  <View style={styles.tankHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tankFuel} numberOfLines={1}>
                        {t.fuelType?.name ?? "Fuel"}
                        {t.label ? `  ·  ${t.label}` : ""}
                      </Text>
                      <Text style={styles.tankSub}>
                        {t.capacity.toLocaleString("en-NG")} {t.unit} capacity
                      </Text>
                    </View>
                    {low ? (
                      <VendorPill tone="warning" size="sm" dot>
                        Low
                      </VendorPill>
                    ) : (
                      <VendorPill tone="success" size="sm">
                        OK
                      </VendorPill>
                    )}
                  </View>

                  <View style={styles.gaugeWrap}>
                    <View style={styles.gaugeTrack}>
                      <View
                        style={[
                          styles.gaugeFill,
                          {
                            width: `${pct}%`,
                            backgroundColor: low
                              ? theme.warning
                              : theme.primary,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.gaugePct}>{pct.toFixed(0)}%</Text>
                  </View>

                  <View style={styles.editRow}>
                    <Text style={styles.fieldLabel}>Current level</Text>
                    <View style={styles.editControls}>
                      <TextInput
                        style={styles.levelInput}
                        value={draft}
                        onChangeText={(v) =>
                          setDrafts((d) => ({ ...d, [t._id]: v }))
                        }
                        keyboardType="numeric"
                        accessibilityLabel="Current level"
                      />
                      <Pressable
                        onPress={() => saveLevel(t._id)}
                        disabled={savingId !== null}
                        accessibilityRole="button"
                        accessibilityLabel="Save level"
                        hitSlop={6}
                        style={({ pressed }) => [
                          styles.saveSmall,
                          savingId !== null && { opacity: 0.5 },
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <Text style={styles.saveSmallText}>
                          {savingId === t._id ? "…" : "Save"}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => removeTank(t._id)}
                        accessibilityRole="button"
                        accessibilityLabel="Delete tank"
                        hitSlop={6}
                        style={({ pressed }) => [
                          styles.deleteBtn,
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color={theme.error}
                        />
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
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
      paddingVertical: 7,
      borderRadius: theme.radius.pill,
    },
    addBtnText: {
      ...theme.type.bodySm,
      color: theme.fgOnPrimary,
      fontWeight: "800",
    },
    cardLabel: {
      ...theme.type.caption,
      color: theme.fgMuted,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginBottom: 8,
    },
    fieldLabel: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      fontWeight: "600",
      marginBottom: 4,
    },
    row: { flexDirection: "row" },
    input: {
      ...theme.type.body,
      color: theme.fg,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: theme.radius.lg,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: theme.surface,
    },
    fuelRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    fuelChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.bgMuted,
      borderWidth: 1,
      borderColor: theme.border,
    },
    fuelChipActive: {
      backgroundColor: theme.primaryTint,
      borderColor: theme.primary,
    },
    fuelChipText: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      fontWeight: "700",
    },
    fuelChipTextActive: {
      color: theme.primary,
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
    list: { gap: 12 },
    tankCard: {
      padding: 14,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      gap: 10,
    },
    tankHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    tankFuel: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
    },
    tankSub: {
      ...theme.type.caption,
      color: theme.fgMuted,
    },
    gaugeWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    gaugeTrack: {
      flex: 1,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.bgMuted,
      overflow: "hidden",
    },
    gaugeFill: {
      height: "100%",
      borderRadius: 5,
    },
    gaugePct: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "800",
      width: 56,
      textAlign: "right",
    },
    editRow: {
      gap: 6,
    },
    editControls: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    levelInput: {
      ...theme.type.body,
      color: theme.fg,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: theme.radius.md,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.surface,
      flex: 1,
      textAlign: "right",
    },
    saveSmall: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.primary,
    },
    saveSmallText: {
      ...theme.type.bodySm,
      color: theme.fgOnPrimary,
      fontWeight: "800",
    },
    deleteBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.errorTint,
      alignItems: "center",
      justifyContent: "center",
    },
  });
