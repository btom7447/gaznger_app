import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Switch,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";

interface FuelEntry {
  _id: string;
  fuel: { _id: string; name: string; unit: string };
  pricePerUnit: number;
  available: boolean;
}

interface StationInfo {
  name: string;
  isActive: boolean;
  operatingHours?: { open: string; close: string };
  fuels: FuelEntry[];
}

interface ProfileResponse {
  station: StationInfo | null;
}

export default function VendorInventory() {
  const theme = useTheme();
  const [fuels, setFuels] = useState<FuelEntry[]>([]);
  const [station, setStation] = useState<StationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Per-fuel editing state: fuelId → draft price string
  const [editingPrice, setEditingPrice] = useState<Record<string, string>>({});
  // Track which fuels are currently saving
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  // Operating hours edit
  const [editHours, setEditHours] = useState(false);
  const [openTime, setOpenTime] = useState("");
  const [closeTime, setCloseTime] = useState("");
  const [savingHours, setSavingHours] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<ProfileResponse>("/api/vendor/profile");
      setStation(res.station);
      setFuels(res.station?.fuels ?? []);
      setOpenTime(res.station?.operatingHours?.open ?? "");
      setCloseTime(res.station?.operatingHours?.close ?? "");
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const toggleAvailability = useCallback(async (fuelId: string, value: boolean) => {
    // Optimistic update
    setFuels((prev) => prev.map((f) => (f.fuel._id === fuelId ? { ...f, available: value } : f)));
    try {
      await api.patch("/api/vendor/station/fuels", { fuelId, available: value });
    } catch (err: any) {
      // Revert
      setFuels((prev) => prev.map((f) => (f.fuel._id === fuelId ? { ...f, available: !value } : f)));
      Alert.alert("Error", err.message ?? "Could not update availability");
    }
  }, []);

  const startEditPrice = useCallback((fuel: FuelEntry) => {
    setEditingPrice((prev) => ({ ...prev, [fuel.fuel._id]: String(fuel.pricePerUnit) }));
  }, []);

  const savePrice = useCallback(async (fuelId: string) => {
    const raw = editingPrice[fuelId];
    const price = parseFloat(raw);
    if (isNaN(price) || price <= 0) {
      Alert.alert("Invalid price", "Please enter a valid price greater than 0");
      return;
    }
    setSaving((prev) => ({ ...prev, [fuelId]: true }));
    try {
      const res = await api.patch<{ fuels: FuelEntry[] }>("/api/vendor/station/fuels", {
        fuelId,
        pricePerUnit: price,
      });
      setFuels(res.fuels);
      setEditingPrice((prev) => {
        const next = { ...prev };
        delete next[fuelId];
        return next;
      });
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Could not update price");
    } finally {
      setSaving((prev) => ({ ...prev, [fuelId]: false }));
    }
  }, [editingPrice]);

  const saveHours = useCallback(async () => {
    if (!openTime || !closeTime) {
      Alert.alert("Required", "Please enter both open and close times");
      return;
    }
    setSavingHours(true);
    try {
      await api.patch("/api/vendor/station", {
        operatingHours: { open: openTime.trim(), close: closeTime.trim() },
      });
      setStation((prev) => prev ? { ...prev, operatingHours: { open: openTime.trim(), close: closeTime.trim() } } : prev);
      setEditHours(false);
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Could not update hours");
    } finally {
      setSavingHours(false);
    }
  }, [openTime, closeTime]);

  const fmtCurrency = (n: number) => "₦" + n.toLocaleString("en-NG");

  if (loading) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={s.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[s.pageTitle, { color: theme.text }]}>Inventory</Text>
          <Text style={[s.pageSubtitle, { color: theme.icon }]}>
            Manage fuel prices and availability
          </Text>

          {/* Fuels List */}
          {fuels.length === 0 ? (
            <View style={[s.emptyCard, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
              <Ionicons name="cube-outline" size={36} color={theme.ash} />
              <Text style={[s.emptyText, { color: theme.icon }]}>No fuels configured</Text>
            </View>
          ) : (
            fuels.map((fuel) => {
              const fuelId = fuel.fuel._id;
              const isEditing = fuelId in editingPrice;
              const isSaving = saving[fuelId];

              return (
                <View
                  key={fuelId}
                  style={[s.fuelCard, { backgroundColor: theme.surface, borderColor: theme.ash }]}
                >
                  <View style={s.fuelHeader}>
                    <View>
                      <Text style={[s.fuelName, { color: theme.text }]}>{fuel.fuel.name}</Text>
                      <Text style={[s.fuelUnit, { color: theme.icon }]}>per {fuel.fuel.unit}</Text>
                    </View>
                    <View style={s.availRow}>
                      <Text style={[s.availLabel, { color: fuel.available ? theme.success : theme.error }]}>
                        {fuel.available ? "Available" : "Unavailable"}
                      </Text>
                      <Switch
                        value={fuel.available}
                        onValueChange={(v) => toggleAvailability(fuelId, v)}
                        trackColor={{ false: theme.ash, true: theme.secondary + "66" }}
                        thumbColor={fuel.available ? theme.secondary : theme.icon}
                      />
                    </View>
                  </View>

                  <View style={[s.priceSeparator, { backgroundColor: theme.ash }]} />

                  <View style={s.priceSection}>
                    <Text style={[s.priceHeading, { color: theme.icon }]}>Price per unit</Text>
                    {isEditing ? (
                      <View style={s.priceEditRow}>
                        <View style={[s.priceInput, { backgroundColor: theme.quinest, borderColor: theme.borderMid }]}>
                          <Text style={[s.nairaSign, { color: theme.icon }]}>₦</Text>
                          <TextInput
                            value={editingPrice[fuelId]}
                            onChangeText={(v) =>
                              setEditingPrice((prev) => ({ ...prev, [fuelId]: v }))
                            }
                            keyboardType="numeric"
                            style={[s.priceTextInput, { color: theme.text }]}
                            autoFocus
                          />
                        </View>
                        <TouchableOpacity
                          style={[s.saveBtn, { backgroundColor: theme.primary }]}
                          onPress={() => savePrice(fuelId)}
                          disabled={isSaving}
                        >
                          {isSaving ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={s.saveBtnText}>Save</Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.cancelBtn, { borderColor: theme.ash }]}
                          onPress={() =>
                            setEditingPrice((prev) => {
                              const next = { ...prev };
                              delete next[fuelId];
                              return next;
                            })
                          }
                          disabled={isSaving}
                        >
                          <Ionicons name="close" size={18} color={theme.icon} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity style={s.priceDisplayRow} onPress={() => startEditPrice(fuel)}>
                        <Text style={[s.priceDisplay, { color: theme.primary }]}>
                          {fmtCurrency(fuel.pricePerUnit)}
                        </Text>
                        <Ionicons name="pencil-outline" size={16} color={theme.icon} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}

          {/* Operating Hours */}
          <View style={[s.hoursCard, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
            <View style={s.hoursHeader}>
              <View style={s.hoursHeaderLeft}>
                <Ionicons name="time-outline" size={18} color={theme.primary} />
                <Text style={[s.hoursTitle, { color: theme.text }]}>Operating Hours</Text>
              </View>
              {!editHours && (
                <TouchableOpacity onPress={() => setEditHours(true)}>
                  <Ionicons name="pencil-outline" size={18} color={theme.icon} />
                </TouchableOpacity>
              )}
            </View>

            {editHours ? (
              <View style={s.hoursEditSection}>
                <View style={s.timeRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.timeLabel, { color: theme.icon }]}>Opens at</Text>
                    <TextInput
                      value={openTime}
                      onChangeText={setOpenTime}
                      placeholder="e.g. 6:00 AM"
                      placeholderTextColor={theme.icon}
                      style={[s.timeInput, { color: theme.text, borderColor: theme.ash, backgroundColor: theme.quinest }]}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.timeLabel, { color: theme.icon }]}>Closes at</Text>
                    <TextInput
                      value={closeTime}
                      onChangeText={setCloseTime}
                      placeholder="e.g. 10:00 PM"
                      placeholderTextColor={theme.icon}
                      style={[s.timeInput, { color: theme.text, borderColor: theme.ash, backgroundColor: theme.quinest }]}
                    />
                  </View>
                </View>
                <View style={s.hoursActions}>
                  <TouchableOpacity
                    style={[s.cancelHoursBtn, { borderColor: theme.ash }]}
                    onPress={() => setEditHours(false)}
                    disabled={savingHours}
                  >
                    <Text style={[s.cancelHoursText, { color: theme.icon }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.saveHoursBtn, { backgroundColor: theme.primary }]}
                    onPress={saveHours}
                    disabled={savingHours}
                  >
                    {savingHours ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={s.saveHoursText}>Save Hours</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : station?.operatingHours?.open ? (
              <Text style={[s.hoursDisplay, { color: theme.textSecondary }]}>
                {station.operatingHours.open} – {station.operatingHours.close}
              </Text>
            ) : (
              <Text style={[s.hoursDisplay, { color: theme.icon }]}>Not set</Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { padding: 20, gap: 14, paddingBottom: 50 },
  pageTitle: { fontSize: 22, fontWeight: "700" },
  pageSubtitle: { fontSize: 13, marginTop: 2 },
  emptyCard: { borderRadius: 14, borderWidth: 1, padding: 40, alignItems: "center", gap: 10 },
  emptyText: { fontSize: 14 },
  fuelCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 12 },
  fuelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  fuelName: { fontSize: 16, fontWeight: "700" },
  fuelUnit: { fontSize: 12, marginTop: 2 },
  availRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  availLabel: { fontSize: 12, fontWeight: "600" },
  priceSeparator: { height: 1 },
  priceSection: { gap: 6 },
  priceHeading: { fontSize: 12 },
  priceDisplayRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  priceDisplay: { fontSize: 20, fontWeight: "700" },
  priceEditRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  priceInput: { flex: 1, flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, height: 42 },
  nairaSign: { fontSize: 16, marginRight: 4 },
  priceTextInput: { flex: 1, fontSize: 16, height: "100%" },
  saveBtn: { paddingHorizontal: 16, height: 42, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  cancelBtn: { width: 42, height: 42, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  hoursCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  hoursHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  hoursHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  hoursTitle: { fontSize: 15, fontWeight: "700" },
  hoursDisplay: { fontSize: 14 },
  hoursEditSection: { gap: 12 },
  timeRow: { flexDirection: "row", gap: 12 },
  timeLabel: { fontSize: 12, marginBottom: 4 },
  timeInput: { height: 42, borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 12, fontSize: 14 },
  hoursActions: { flexDirection: "row", gap: 10 },
  cancelHoursBtn: { flex: 1, height: 40, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  cancelHoursText: { fontSize: 14, fontWeight: "600" },
  saveHoursBtn: { flex: 2, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  saveHoursText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
