import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { toast } from "sonner-native";
import {
  Skel,
  SkelStack,
  VendorCard,
  VendorEmptyState,
  VendorScreenShell,
} from "@/components/ui/vendor";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";

interface StationFuel {
  fuel: { _id: string; name: string; unit: string };
  pricePerUnit: number;
  available: boolean;
}

interface StationDetail {
  _id: string;
  name: string;
  address: string;
  state: string;
  lga?: string;
  isActive: boolean;
  autoAcceptOrders?: boolean;
  operatingHours?: { open?: string; close?: string };
  paymentOptions?: string[];
  fuels: StationFuel[];
}

const PAYMENT_OPTIONS = ["Card & POS", "Bank transfer", "USSD"];

export default function StationEditScreen() {
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;

  const [station, setStation] = useState<StationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Editable mirrors of the server values (commit on blur / toggle).
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [openTime, setOpenTime] = useState("");
  const [closeTime, setCloseTime] = useState("");
  const [paymentOptions, setPaymentOptions] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [autoAccept, setAutoAccept] = useState(false);
  const [fuelDrafts, setFuelDrafts] = useState<Record<string, string>>({});

  const styles = useMemo(() => makeStyles(theme), [theme]);

  const fetchStation = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.get<{ station?: any } | any>(
        `/api/vendor/stations/${id}`,
        { timeoutMs: 10_000 },
      );
      // Endpoint may return the bare object or { station: {...} } depending
      // on which route handler answers. Accept both.
      const s: StationDetail = res?.station ?? res;
      setStation(s);
      setName(s.name ?? "");
      setAddress(s.address ?? "");
      setOpenTime(s.operatingHours?.open ?? "");
      setCloseTime(s.operatingHours?.close ?? "");
      setPaymentOptions(s.paymentOptions ?? []);
      setIsActive(s.isActive ?? true);
      setAutoAccept(!!s.autoAcceptOrders);
      const drafts: Record<string, string> = {};
      for (const f of s.fuels ?? []) {
        drafts[f.fuel._id] = String(f.pricePerUnit);
      }
      setFuelDrafts(drafts);
    } catch (err: any) {
      if (err?.status === 404) {
        toast.error("Station not found");
        router.back();
      }
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    setLoading(true);
    fetchStation();
  }, [fetchStation]);

  const saveBasics = useCallback(async () => {
    if (!station) return;
    setSaving("basics");
    try {
      await api.patch("/api/vendor/station", {
        stationId: station._id,
        name: name.trim(),
        address: address.trim(),
        isActive,
        autoAcceptOrders: autoAccept,
        operatingHours: {
          open: openTime.trim() || undefined,
          close: closeTime.trim() || undefined,
        },
        paymentOptions,
      });
      toast.success("Saved");
      fetchStation();
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't save");
    } finally {
      setSaving(null);
    }
  }, [
    station,
    name,
    address,
    isActive,
    autoAccept,
    openTime,
    closeTime,
    paymentOptions,
    fetchStation,
  ]);

  const saveFuelPrice = useCallback(
    async (fuelId: string) => {
      if (!station) return;
      const raw = fuelDrafts[fuelId];
      const price = parseFloat(raw);
      if (!Number.isFinite(price) || price <= 0) {
        toast.error("Enter a valid price");
        return;
      }
      setSaving(`fuel-${fuelId}`);
      try {
        await api.patch("/api/vendor/station/fuels", {
          stationId: station._id,
          fuelId,
          pricePerUnit: price,
        });
        toast.success("Price updated");
      } catch (err: any) {
        toast.error(err?.message ?? "Couldn't update price");
      } finally {
        setSaving(null);
      }
    },
    [station, fuelDrafts],
  );

  const toggleFuel = useCallback(
    async (fuelId: string, available: boolean) => {
      if (!station) return;
      setSaving(`fuel-toggle-${fuelId}`);
      try {
        await api.patch("/api/vendor/station/fuels", {
          stationId: station._id,
          fuelId,
          available,
        });
        toast.success(available ? "Fuel enabled" : "Fuel disabled");
        fetchStation();
      } catch (err: any) {
        toast.error(err?.message ?? "Couldn't toggle");
      } finally {
        setSaving(null);
      }
    },
    [station, fetchStation],
  );

  const togglePayment = useCallback((option: string) => {
    setPaymentOptions((prev) =>
      prev.includes(option) ? prev.filter((p) => p !== option) : [...prev, option],
    );
  }, []);

  return (
    <VendorScreenShell title="Station">
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
          <Text style={styles.backText}>Back to stations</Text>
        </Pressable>

        {loading && !station ? (
          <SkelStack gap={12}>
            <Skel height={200} radius={16} />
            <Skel height={140} radius={16} />
            <Skel height={140} radius={16} />
          </SkelStack>
        ) : !station ? (
          <VendorEmptyState
            icon="cloud-offline-outline"
            headline="Couldn't load station"
          />
        ) : (
          <>
            <VendorCard>
              <Text style={styles.cardLabel}>Identity</Text>
              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholderTextColor={theme.fgMuted}
                accessibilityLabel="Station name"
              />
              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>
                Address
              </Text>
              <TextInput
                style={styles.input}
                value={address}
                onChangeText={setAddress}
                placeholderTextColor={theme.fgMuted}
                accessibilityLabel="Address"
              />
            </VendorCard>

            <VendorCard>
              <Text style={styles.cardLabel}>Operating hours</Text>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Opens</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="06:00"
                    placeholderTextColor={theme.fgMuted}
                    value={openTime}
                    onChangeText={setOpenTime}
                    accessibilityLabel="Opens at"
                  />
                </View>
                <View style={{ width: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Closes</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="22:00"
                    placeholderTextColor={theme.fgMuted}
                    value={closeTime}
                    onChangeText={setCloseTime}
                    accessibilityLabel="Closes at"
                  />
                </View>
              </View>
            </VendorCard>

            <VendorCard>
              <Text style={styles.cardLabel}>Payment methods</Text>
              <View style={styles.pillRow}>
                {PAYMENT_OPTIONS.map((opt) => {
                  const active = paymentOptions.includes(opt);
                  return (
                    <Pressable
                      key={opt}
                      onPress={() => togglePayment(opt)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      hitSlop={4}
                      style={({ pressed }) => [
                        styles.pill,
                        active && styles.pillActive,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          active && styles.pillTextActive,
                        ]}
                      >
                        {opt}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </VendorCard>

            <VendorCard>
              <Text style={styles.cardLabel}>Toggles</Text>
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Open for orders</Text>
                  <Text style={styles.toggleSub}>
                    Off = station closed; customers see "closed" on detail.
                  </Text>
                </View>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{
                    false: theme.bgMuted,
                    true: theme.primary,
                  }}
                />
              </View>
              <View style={[styles.toggleRow, { marginTop: 8 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Auto-accept orders</Text>
                  <Text style={styles.toggleSub}>
                    Skip the confirm step; new orders dispatch immediately.
                  </Text>
                </View>
                <Switch
                  value={autoAccept}
                  onValueChange={setAutoAccept}
                  trackColor={{
                    false: theme.bgMuted,
                    true: theme.primary,
                  }}
                />
              </View>
            </VendorCard>

            <Pressable
              onPress={saveBasics}
              disabled={saving !== null}
              accessibilityRole="button"
              accessibilityLabel="Save basics"
              style={({ pressed }) => [
                styles.primaryBtn,
                saving !== null && { opacity: 0.5 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.primaryBtnText}>
                {saving === "basics" ? "Saving…" : "Save"}
              </Text>
            </Pressable>

            <VendorCard>
              <Text style={styles.cardLabel}>Pricing</Text>
              <Text style={styles.hint}>
                Set per-litre / per-kg price for each fuel you sell here.
              </Text>
              {station.fuels.length === 0 ? (
                <Text style={styles.hint}>No fuels yet.</Text>
              ) : (
                <View style={styles.fuelList}>
                  {station.fuels.map((f) => (
                    <View key={f.fuel._id} style={styles.fuelRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fuelName}>{f.fuel.name}</Text>
                        <Text style={styles.fuelSub}>per {f.fuel.unit}</Text>
                      </View>
                      <TextInput
                        style={styles.priceInput}
                        value={fuelDrafts[f.fuel._id] ?? ""}
                        onChangeText={(t) =>
                          setFuelDrafts((d) => ({ ...d, [f.fuel._id]: t }))
                        }
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={theme.fgMuted}
                        accessibilityLabel={`Price for ${f.fuel.name}`}
                      />
                      <Pressable
                        onPress={() => saveFuelPrice(f.fuel._id)}
                        disabled={saving !== null}
                        accessibilityRole="button"
                        accessibilityLabel={`Save price for ${f.fuel.name}`}
                        hitSlop={6}
                        style={({ pressed }) => [
                          styles.saveSmall,
                          saving !== null && { opacity: 0.5 },
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <Text style={styles.saveSmallText}>
                          {saving === `fuel-${f.fuel._id}` ? "…" : "Save"}
                        </Text>
                      </Pressable>
                      <Switch
                        value={f.available}
                        onValueChange={(v) => toggleFuel(f.fuel._id, v)}
                        trackColor={{
                          false: theme.bgMuted,
                          true: theme.primary,
                        }}
                      />
                    </View>
                  ))}
                </View>
              )}
            </VendorCard>
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
    row: { flexDirection: "row" },
    pillRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    pill: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.bgMuted,
      borderWidth: 1,
      borderColor: theme.border,
    },
    pillActive: {
      backgroundColor: theme.primaryTint,
      borderColor: theme.primary,
    },
    pillText: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      fontWeight: "700",
    },
    pillTextActive: {
      color: theme.primary,
    },
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    toggleTitle: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
    },
    toggleSub: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
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
    hint: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      marginBottom: 6,
    },
    fuelList: { gap: 10 },
    fuelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    fuelName: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
    },
    fuelSub: {
      ...theme.type.caption,
      color: theme.fgMuted,
    },
    priceInput: {
      ...theme.type.body,
      color: theme.fg,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: theme.radius.md,
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: theme.surface,
      width: 90,
      textAlign: "right",
    },
    saveSmall: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.primary,
    },
    saveSmallText: {
      ...theme.type.caption,
      color: theme.fgOnPrimary,
      fontWeight: "800",
    },
  });
