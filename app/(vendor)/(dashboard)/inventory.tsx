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
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { toast } from "sonner-native";
import { useRouter } from "expo-router";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";
import NotificationButton from "@/components/ui/global/NotificationButton";
import ProfileButton from "@/components/ui/global/ProfileButton";

interface FuelEntry {
  _id: string;
  fuel: { _id: string; name: string; unit: string };
  pricePerUnit: number;
  available: boolean;
  scheduledPrice?: { price: number; effectiveAt: string };
}

interface StationInfo {
  _id: string;
  name: string;
  isActive: boolean;
  operatingHours?: { open: string; close: string };
  fuels: FuelEntry[];
}

interface StationsResponse {
  stations: StationInfo[];
}

export default function VendorInventory() {
  const theme = useTheme();
  const router = useRouter();
  const [stations, setStations] = useState<StationInfo[]>([]);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [editingPrice, setEditingPrice] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  // Operating hours
  const [editHours, setEditHours] = useState(false);
  const [openTime, setOpenTime] = useState("");
  const [closeTime, setCloseTime] = useState("");
  const [savingHours, setSavingHours] = useState(false);
  const [applyGlobally, setApplyGlobally] = useState(false);

  // Schedule modal
  const [scheduleModal, setScheduleModal] = useState<{ fuelId: string; fuelName: string } | null>(null);
  const [schedulePrice, setSchedulePrice] = useState("");
  const [scheduleDate, setScheduleDate] = useState(""); // ISO string input
  const [scheduleSaving, setScheduleSaving] = useState(false);

  const station = stations.find((s) => s._id === selectedStationId) ?? stations[0] ?? null;
  const fuels = station?.fuels ?? [];

  const load = useCallback(async () => {
    try {
      const res = await api.get<StationsResponse>("/api/vendor/stations");
      setStations(res.stations ?? []);
      if (!selectedStationId && res.stations.length > 0) {
        setSelectedStationId(res.stations[0]._id);
      }
      const current = res.stations.find((s) => s._id === selectedStationId) ?? res.stations[0];
      setOpenTime(current?.operatingHours?.open ?? "");
      setCloseTime(current?.operatingHours?.close ?? "");
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedStationId]);

  useEffect(() => { load(); }, []);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  const toggleAvailability = useCallback(async (fuelId: string, value: boolean) => {
    setStations((prev) => prev.map((s) =>
      s._id === station?._id
        ? { ...s, fuels: s.fuels.map((f) => f.fuel._id === fuelId ? { ...f, available: value } : f) }
        : s
    ));
    try {
      await api.patch("/api/vendor/station/fuels", { fuelId, available: value, stationId: station?._id });
    } catch (err: any) {
      setStations((prev) => prev.map((s) =>
        s._id === station?._id
          ? { ...s, fuels: s.fuels.map((f) => f.fuel._id === fuelId ? { ...f, available: !value } : f) }
          : s
      ));
      Alert.alert("Error", err.message ?? "Could not update availability");
    }
  }, [station]);

  const savePrice = useCallback(async (fuelId: string) => {
    const price = parseFloat(editingPrice[fuelId]);
    if (isNaN(price) || price <= 0) {
      Alert.alert("Invalid price", "Please enter a valid price greater than 0");
      return;
    }
    setSaving((prev) => ({ ...prev, [fuelId]: true }));
    try {
      const res = await api.patch<{ fuels: FuelEntry[] }>("/api/vendor/station/fuels", {
        fuelId, pricePerUnit: price, stationId: station?._id,
      });
      setStations((prev) => prev.map((s) =>
        s._id === station?._id ? { ...s, fuels: res.fuels } : s
      ));
      setEditingPrice((prev) => { const next = { ...prev }; delete next[fuelId]; return next; });
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Could not update price");
    } finally {
      setSaving((prev) => ({ ...prev, [fuelId]: false }));
    }
  }, [editingPrice, station]);

  const saveHours = useCallback(async () => {
    if (!openTime || !closeTime) {
      Alert.alert("Required", "Please enter both open and close times");
      return;
    }
    setSavingHours(true);
    try {
      if (applyGlobally) {
        await api.patch("/api/vendor/stations/operating-hours", { open: openTime.trim(), close: closeTime.trim() });
        toast.success("Hours applied to all stations");
      } else {
        await api.patch("/api/vendor/station", {
          stationId: station?._id,
          operatingHours: { open: openTime.trim(), close: closeTime.trim() },
        });
      }
      setStations((prev) => prev.map((s) =>
        applyGlobally || s._id === station?._id
          ? { ...s, operatingHours: { open: openTime.trim(), close: closeTime.trim() } }
          : s
      ));
      setEditHours(false);
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Could not update hours");
    } finally {
      setSavingHours(false);
    }
  }, [openTime, closeTime, applyGlobally, station]);

  const confirmSchedule = useCallback(async () => {
    if (!scheduleModal) return;
    const price = parseFloat(schedulePrice);
    if (isNaN(price) || price <= 0) {
      Alert.alert("Invalid", "Enter a valid price");
      return;
    }
    if (!scheduleDate.trim()) {
      Alert.alert("Required", "Enter a date/time for the price update (e.g. 2025-12-01T06:00)");
      return;
    }
    const effectiveAt = new Date(scheduleDate.trim());
    if (isNaN(effectiveAt.getTime()) || effectiveAt <= new Date()) {
      Alert.alert("Invalid date", "Date must be in the future (format: YYYY-MM-DDTHH:MM)");
      return;
    }
    setScheduleSaving(true);
    try {
      const res = await api.post<{ fuels: FuelEntry[] }>("/api/vendor/station/fuels/schedule", {
        fuelId: scheduleModal.fuelId,
        newPrice: price,
        effectiveAt: effectiveAt.toISOString(),
        stationId: station?._id,
      });
      setStations((prev) => prev.map((s) =>
        s._id === station?._id ? { ...s, fuels: res.fuels } : s
      ));
      toast.success("Price update scheduled", {
        description: `₦${price.toLocaleString()} effective ${effectiveAt.toLocaleDateString()}`,
      });
      setScheduleModal(null);
      setSchedulePrice("");
      setScheduleDate("");
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Could not schedule price");
    } finally {
      setScheduleSaving(false);
    }
  }, [scheduleModal, schedulePrice, scheduleDate, station]);

  const cancelSchedule = useCallback(async (fuelId: string) => {
    try {
      const res = await api.delete<{ fuels: FuelEntry[] }>(`/api/vendor/station/fuels/schedule`);
      setStations((prev) => prev.map((s) =>
        s._id === station?._id ? { ...s, fuels: res.fuels } : s
      ));
      toast.success("Scheduled price cancelled");
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Could not cancel schedule");
    }
  }, [station]);

  const fmtCurrency = (n: number) => "₦" + n.toLocaleString("en-NG");
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.pageHeader}>
            <View>
              <Text style={[styles.pageTitle, { color: theme.text }]}>Inventory</Text>
              <Text style={[styles.pageSubtitle, { color: theme.icon }]}>Manage fuel prices and availability</Text>
            </View>
            <View style={styles.headerRight}>
              <NotificationButton onPress={() => router.push("/(screens)/notification" as any)} />
              <ProfileButton
                onPress={() => router.push("/(vendor)/(dashboard)/profile" as any)}
                size={36}
              />
            </View>
          </View>

          {/* Station selector (if multiple) */}
          {stations.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              <View style={styles.stationTabs}>
                {stations.map((s) => {
                  const active = s._id === (selectedStationId ?? stations[0]._id);
                  return (
                    <TouchableOpacity
                      key={s._id}
                      onPress={() => {
                        setSelectedStationId(s._id);
                        setOpenTime(s.operatingHours?.open ?? "");
                        setCloseTime(s.operatingHours?.close ?? "");
                        setEditHours(false);
                      }}
                      style={[styles.stationTab, { backgroundColor: active ? theme.primary : theme.surface, borderColor: active ? theme.primary : theme.ash }]}
                    >
                      <Text style={[styles.stationTabText, { color: active ? "#fff" : theme.text }]} numberOfLines={1}>
                        {s.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}

          {/* Fuels */}
          {fuels.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
              <Ionicons name="cube-outline" size={36} color={theme.ash} />
              <Text style={[styles.emptyText, { color: theme.icon }]}>No fuels configured</Text>
            </View>
          ) : (
            fuels.map((fuel) => {
              const fuelId = fuel.fuel._id;
              const isEditing = fuelId in editingPrice;
              const isSaving = saving[fuelId];
              const hasSchedule = !!fuel.scheduledPrice?.effectiveAt;

              return (
                <View key={fuelId} style={[styles.fuelCard, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
                  <View style={styles.fuelHeader}>
                    <View>
                      <Text style={[styles.fuelName, { color: theme.text }]}>{fuel.fuel.name}</Text>
                      <Text style={[styles.fuelUnit, { color: theme.icon }]}>per {fuel.fuel.unit}</Text>
                    </View>
                    <View style={styles.availRow}>
                      <Text style={[styles.availLabel, { color: fuel.available ? "#10B981" : "#EF4444" }]}>
                        {fuel.available ? "Available" : "Unavailable"}
                      </Text>
                      <Switch
                        value={fuel.available}
                        onValueChange={(v) => toggleAvailability(fuelId, v)}
                        trackColor={{ false: theme.ash, true: theme.primary + "66" }}
                        thumbColor={fuel.available ? theme.primary : theme.icon}
                      />
                    </View>
                  </View>

                  <View style={[styles.divider, { backgroundColor: theme.ash }]} />

                  <View style={styles.priceSection}>
                    <Text style={[styles.priceHeading, { color: theme.icon }]}>Current price</Text>
                    {isEditing ? (
                      <View style={styles.priceEditRow}>
                        <View style={[styles.priceInput, { backgroundColor: theme.background, borderColor: theme.ash }]}>
                          <Text style={[styles.nairaSign, { color: theme.icon }]}>₦</Text>
                          <TextInput
                            value={editingPrice[fuelId]}
                            onChangeText={(v) => setEditingPrice((prev) => ({ ...prev, [fuelId]: v }))}
                            keyboardType="numeric"
                            style={[styles.priceTextInput, { color: theme.text }]}
                            autoFocus
                          />
                        </View>
                        <TouchableOpacity
                          style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                          onPress={() => savePrice(fuelId)}
                          disabled={isSaving}
                        >
                          {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.cancelBtn, { borderColor: theme.ash }]}
                          onPress={() => setEditingPrice((prev) => { const n = { ...prev }; delete n[fuelId]; return n; })}
                        >
                          <Ionicons name="close" size={18} color={theme.icon} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.priceDisplayRow} onPress={() => setEditingPrice((p) => ({ ...p, [fuelId]: String(fuel.pricePerUnit) }))}>
                        <Text style={[styles.priceDisplay, { color: theme.primary }]}>{fmtCurrency(fuel.pricePerUnit)}</Text>
                        <Ionicons name="pencil-outline" size={16} color={theme.icon} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Scheduled price */}
                  {hasSchedule ? (
                    <View style={[styles.scheduleBanner, { backgroundColor: theme.tertiary, borderColor: theme.primary + "33" }]}>
                      <Ionicons name="time-outline" size={14} color={theme.primary} />
                      <Text style={[styles.scheduleText, { color: theme.primary }]}>
                        ₦{fuel.scheduledPrice!.price.toLocaleString()} on {fmtDate(fuel.scheduledPrice!.effectiveAt)}
                      </Text>
                      <TouchableOpacity onPress={() => cancelSchedule(fuelId)}>
                        <Ionicons name="close-circle-outline" size={16} color={theme.primary} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.scheduleBtn, { borderColor: theme.ash }]}
                      onPress={() => setScheduleModal({ fuelId, fuelName: fuel.fuel.name })}
                    >
                      <Ionicons name="calendar-outline" size={14} color={theme.icon} />
                      <Text style={[styles.scheduleBtnText, { color: theme.icon }]}>Schedule price update</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}

          {/* Operating Hours */}
          <View style={[styles.hoursCard, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
            <View style={styles.hoursHeader}>
              <View style={styles.hoursHeaderLeft}>
                <Ionicons name="time-outline" size={18} color={theme.primary} />
                <Text style={[styles.hoursTitle, { color: theme.text }]}>Operating Hours</Text>
              </View>
              {!editHours && (
                <TouchableOpacity onPress={() => setEditHours(true)}>
                  <Ionicons name="pencil-outline" size={18} color={theme.icon} />
                </TouchableOpacity>
              )}
            </View>

            {editHours ? (
              <View style={{ gap: 12 }}>
                <View style={styles.timeRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.timeLabel, { color: theme.icon }]}>Opens at</Text>
                    <TextInput
                      value={openTime} onChangeText={setOpenTime}
                      placeholder="e.g. 06:00" placeholderTextColor={theme.icon}
                      style={[styles.timeInput, { color: theme.text, borderColor: theme.ash, backgroundColor: theme.background }]}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.timeLabel, { color: theme.icon }]}>Closes at</Text>
                    <TextInput
                      value={closeTime} onChangeText={setCloseTime}
                      placeholder="e.g. 22:00" placeholderTextColor={theme.icon}
                      style={[styles.timeInput, { color: theme.text, borderColor: theme.ash, backgroundColor: theme.background }]}
                    />
                  </View>
                </View>
                {stations.length > 1 && (
                  <TouchableOpacity
                    style={styles.globalRow}
                    onPress={() => setApplyGlobally((v) => !v)}
                  >
                    <View style={[styles.checkbox, { borderColor: applyGlobally ? theme.primary : theme.ash, backgroundColor: applyGlobally ? theme.primary : "transparent" }]}>
                      {applyGlobally && <Ionicons name="checkmark" size={12} color="#fff" />}
                    </View>
                    <Text style={[styles.globalLabel, { color: theme.text }]}>Apply to all my stations</Text>
                  </TouchableOpacity>
                )}
                <View style={styles.hoursActions}>
                  <TouchableOpacity style={[styles.cancelHoursBtn, { borderColor: theme.ash }]} onPress={() => setEditHours(false)} disabled={savingHours}>
                    <Text style={[styles.cancelHoursText, { color: theme.icon }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.saveHoursBtn, { backgroundColor: theme.primary }]} onPress={saveHours} disabled={savingHours}>
                    {savingHours ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveHoursText}>Save Hours</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : station?.operatingHours?.open ? (
              <Text style={[styles.hoursDisplay, { color: theme.icon }]}>
                {station.operatingHours.open} – {station.operatingHours.close}
              </Text>
            ) : (
              <Text style={[styles.hoursDisplay, { color: theme.icon }]}>Not set</Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Schedule Modal */}
      <Modal visible={!!scheduleModal} transparent animationType="fade" onRequestClose={() => setScheduleModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Schedule Price Update</Text>
            <Text style={[styles.modalSub, { color: theme.icon }]}>{scheduleModal?.fuelName}</Text>

            <Text style={[styles.modalLabel, { color: theme.icon }]}>New price (₦)</Text>
            <TextInput
              value={schedulePrice} onChangeText={setSchedulePrice}
              keyboardType="numeric" placeholder="e.g. 1000"
              placeholderTextColor={theme.icon}
              style={[styles.modalInput, { color: theme.text, borderColor: theme.ash, backgroundColor: theme.background }]}
            />

            <Text style={[styles.modalLabel, { color: theme.icon }]}>Effective date & time</Text>
            <TextInput
              value={scheduleDate} onChangeText={setScheduleDate}
              placeholder="YYYY-MM-DDTHH:MM (e.g. 2025-12-01T06:00)"
              placeholderTextColor={theme.icon}
              style={[styles.modalInput, { color: theme.text, borderColor: theme.ash, backgroundColor: theme.background }]}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.cancelHoursBtn, { borderColor: theme.ash }]} onPress={() => setScheduleModal(null)}>
                <Text style={[styles.cancelHoursText, { color: theme.icon }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveHoursBtn, { backgroundColor: theme.primary }]} onPress={confirmSchedule} disabled={scheduleSaving}>
                {scheduleSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveHoursText}>Schedule</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { padding: 20, gap: 14, paddingBottom: 50 },
  pageHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pageTitle: { fontSize: 22, fontWeight: "700" },
  pageSubtitle: { fontSize: 13, marginTop: 2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatarWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 2, overflow: "hidden" },

  stationTabs: { flexDirection: "row", gap: 8, paddingVertical: 8 },
  stationTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, maxWidth: 160 },
  stationTabText: { fontSize: 13, fontWeight: "500" },

  emptyCard: { borderRadius: 14, borderWidth: 1, padding: 40, alignItems: "center", gap: 10 },
  emptyText: { fontSize: 14 },

  fuelCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 12 },
  fuelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  fuelName: { fontSize: 16, fontWeight: "700" },
  fuelUnit: { fontSize: 12, marginTop: 2 },
  availRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  availLabel: { fontSize: 12, fontWeight: "600" },
  divider: { height: 1 },
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

  scheduleBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  scheduleText: { flex: 1, fontSize: 13, fontWeight: "500" },
  scheduleBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  scheduleBtnText: { fontSize: 13 },

  hoursCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  hoursHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  hoursHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  hoursTitle: { fontSize: 15, fontWeight: "700" },
  hoursDisplay: { fontSize: 14 },
  timeRow: { flexDirection: "row", gap: 12 },
  timeLabel: { fontSize: 12, marginBottom: 4 },
  timeInput: { height: 42, borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 12, fontSize: 14 },
  globalRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  globalLabel: { fontSize: 14 },
  hoursActions: { flexDirection: "row", gap: 10 },
  cancelHoursBtn: { flex: 1, height: 40, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  cancelHoursText: { fontSize: 14, fontWeight: "600" },
  saveHoursBtn: { flex: 2, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  saveHoursText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: "#00000066", justifyContent: "center", alignItems: "center", padding: 24 },
  modalCard: { width: "100%", borderRadius: 20, padding: 24, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalSub: { fontSize: 13, marginTop: -8 },
  modalLabel: { fontSize: 12, marginBottom: -8 },
  modalInput: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
});
