import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { toast } from "sonner-native";
import { useTheme } from "@/constants/theme";
import { useSessionStore } from "@/store/useSessionStore";
import { api } from "@/lib/api";

const TOTAL_STEPS = 5;

const NIGERIAN_STATES = [
  "Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno",
  "Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","FCT","Gombe","Imo",
  "Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa",
  "Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba",
  "Yobe","Zamfara",
];

interface FuelType {
  _id: string;
  name: string;
  unit: string;
}

interface FuelOffering {
  fuelId: string;
  name: string;
  unit: string;
  pricePerUnit: string;
  selected: boolean;
}

export default function VendorOnboarding() {
  const theme = useTheme();
  const { updateUser } = useSessionStore();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 1 — Business info
  const [stationName, setStationName] = useState("");
  const [stationType, setStationType] = useState<"petrol_station" | "gas_plant" | "multi_fuel">("petrol_station");

  // Step 2 — Location
  const [address, setAddress] = useState("");
  const [state, setState] = useState("");
  const [lga, setLga] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  // Step 3 — Fuel offerings
  const [fuelOfferings, setFuelOfferings] = useState<FuelOffering[]>([]);
  const [loadingFuels, setLoadingFuels] = useState(false);

  // Step 4 — Station image
  const [stationImage, setStationImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Step 5 — Bank details
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  useEffect(() => {
    if (step === 2 && fuelOfferings.length === 0) {
      fetchFuels();
    }
  }, [step]);

  const fetchFuels = async () => {
    setLoadingFuels(true);
    try {
      const data = await api.get<FuelType[]>("/api/fuel-types");
      setFuelOfferings(
        data.map((f) => ({ fuelId: f._id, name: f.name, unit: f.unit, pricePerUnit: "", selected: false }))
      );
    } catch {
      toast.error("Could not load fuel types");
    } finally {
      setLoadingFuels(false);
    }
  };

  const toggleFuel = (fuelId: string) => {
    setFuelOfferings((prev) =>
      prev.map((f) => (f.fuelId === fuelId ? { ...f, selected: !f.selected } : f))
    );
  };

  const setFuelPrice = (fuelId: string, price: string) => {
    setFuelOfferings((prev) =>
      prev.map((f) => (f.fuelId === fuelId ? { ...f, pricePerUnit: price } : f))
    );
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [16, 9], quality: 0.8,
    });
    if (result.canceled) return;
    setUploadingImage(true);
    try {
      const uri = result.assets[0].uri;
      const formData = new FormData();
      formData.append("image", { uri, name: "station.jpg", type: "image/jpeg" } as any);
      const res = await fetch(`${process.env.EXPO_PUBLIC_BASE_URL}/api/upload/image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${useSessionStore.getState().accessToken}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setStationImage(data.url);
    } catch (err: any) {
      toast.error("Image upload failed", { description: err.message });
    } finally {
      setUploadingImage(false);
    }
  };

  const canNext = [
    // Step 0: business info
    stationName.trim().length >= 3,
    // Step 1: location
    address.trim().length > 0 && state.length > 0 && lga.trim().length > 0,
    // Step 2: at least one fuel selected with a price
    fuelOfferings.some((f) => f.selected && Number(f.pricePerUnit) > 0),
    // Step 3: image uploaded
    stationImage !== null,
    // Step 4: bank details
    bankName.trim().length > 0 && accountNumber.trim().length >= 10 && accountName.trim().length > 0,
  ][step];

  const handleFinish = async () => {
    setSaving(true);
    try {
      const selectedFuels = fuelOfferings
        .filter((f) => f.selected && Number(f.pricePerUnit) > 0)
        .map((f) => ({ fuel: f.fuelId, pricePerUnit: Number(f.pricePerUnit) }));

      await api.post("/api/vendor/onboard", {
        stationName: stationName.trim(),
        stationType,
        address: address.trim(),
        state,
        lga: lga.trim(),
        location: { lat: Number(lat) || 0, lng: Number(lng) || 0 },
        fuels: selectedFuels,
        image: stationImage,
        bankAccount: {
          bankName: bankName.trim(),
          accountNumber: accountNumber.trim(),
          accountName: accountName.trim(),
        },
      });

      updateUser({ isOnboarded: true });
      toast.success("Station set up!", { description: "Welcome to Gaznger Vendor." });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.replace("/(vendor)/(dashboard)" as any);
    } catch (err: any) {
      toast.error("Setup failed", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const s = styles(theme);

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* Top bar */}
        <View style={s.topBar}>
          {step > 0 ? (
            <TouchableOpacity onPress={() => setStep((v) => v - 1)} style={s.backBtn}>
              <Ionicons name="arrow-back-outline" size={24} color={theme.text} />
            </TouchableOpacity>
          ) : (
            <View style={s.backBtn} />
          )}
          <Text style={[s.stepLabel, { color: theme.icon }]}>{step + 1} / {TOTAL_STEPS}</Text>
        </View>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* ── STEP 0: Business Info ── */}
          {step === 0 && (
            <View style={s.slide}>
              <Text style={[s.heading, { color: theme.text }]}>Tell us about your station</Text>
              <Text style={[s.sub, { color: theme.icon }]}>This appears on the platform for customers to find you.</Text>

              <FieldGroup label="Station Name *">
                <TextInput
                  style={[s.input, { color: theme.text, borderColor: theme.ash, backgroundColor: theme.surface }]}
                  value={stationName} onChangeText={setStationName}
                  placeholder="e.g. Sunrise Petroleum" placeholderTextColor={theme.icon}
                />
              </FieldGroup>

              <Text style={[s.fieldLabel, { color: theme.icon }]}>Station Type *</Text>
              <View style={s.chipRow}>
                {(["petrol_station", "gas_plant", "multi_fuel"] as const).map((t) => {
                  const labels = { petrol_station: "Petrol Station", gas_plant: "Gas Plant", multi_fuel: "Multi-Fuel" };
                  const active = stationType === t;
                  return (
                    <TouchableOpacity
                      key={t} onPress={() => setStationType(t)} activeOpacity={0.8}
                      style={[s.chip, { borderColor: active ? theme.primary : theme.ash, backgroundColor: active ? theme.tertiary : theme.surface }]}
                    >
                      <Text style={[s.chipText, { color: active ? theme.primary : theme.icon }]}>{labels[t]}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── STEP 1: Location ── */}
          {step === 1 && (
            <View style={s.slide}>
              <Text style={[s.heading, { color: theme.text }]}>Where is your station?</Text>
              <Text style={[s.sub, { color: theme.icon }]}>Customers use this to find stations near them.</Text>

              <FieldGroup label="Street Address *">
                <TextInput
                  style={[s.input, { color: theme.text, borderColor: theme.ash, backgroundColor: theme.surface }]}
                  value={address} onChangeText={setAddress}
                  placeholder="e.g. 12 Adeola Odeku Street" placeholderTextColor={theme.icon}
                />
              </FieldGroup>

              <Text style={[s.fieldLabel, { color: theme.icon }]}>State *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <View style={[s.chipRow, { flexWrap: "nowrap" }]}>
                  {NIGERIAN_STATES.map((st) => {
                    const active = state === st;
                    return (
                      <TouchableOpacity
                        key={st} onPress={() => setState(st)} activeOpacity={0.8}
                        style={[s.chip, { borderColor: active ? theme.primary : theme.ash, backgroundColor: active ? theme.tertiary : theme.surface }]}
                      >
                        <Text style={[s.chipText, { color: active ? theme.primary : theme.icon }]}>{st}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <FieldGroup label="LGA *">
                <TextInput
                  style={[s.input, { color: theme.text, borderColor: theme.ash, backgroundColor: theme.surface }]}
                  value={lga} onChangeText={setLga}
                  placeholder="Local Government Area" placeholderTextColor={theme.icon}
                />
              </FieldGroup>

              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <FieldGroup label="Latitude (optional)">
                    <TextInput
                      style={[s.input, { color: theme.text, borderColor: theme.ash, backgroundColor: theme.surface }]}
                      value={lat} onChangeText={setLat} keyboardType="numeric"
                      placeholder="e.g. 6.5244" placeholderTextColor={theme.icon}
                    />
                  </FieldGroup>
                </View>
                <View style={{ flex: 1 }}>
                  <FieldGroup label="Longitude (optional)">
                    <TextInput
                      style={[s.input, { color: theme.text, borderColor: theme.ash, backgroundColor: theme.surface }]}
                      value={lng} onChangeText={setLng} keyboardType="numeric"
                      placeholder="e.g. 3.3792" placeholderTextColor={theme.icon}
                    />
                  </FieldGroup>
                </View>
              </View>
              <Text style={[s.hint, { color: theme.icon }]}>
                Coordinates help with precise map placement. You can add them later.
              </Text>
            </View>
          )}

          {/* ── STEP 2: Fuel Offerings ── */}
          {step === 2 && (
            <View style={s.slide}>
              <Text style={[s.heading, { color: theme.text }]}>What fuels do you sell?</Text>
              <Text style={[s.sub, { color: theme.icon }]}>Select each fuel type and set your price per unit.</Text>

              {loadingFuels ? (
                <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
              ) : (
                fuelOfferings.map((f) => (
                  <TouchableOpacity
                    key={f.fuelId} onPress={() => toggleFuel(f.fuelId)} activeOpacity={0.85}
                    style={[s.fuelCard, {
                      borderColor: f.selected ? theme.primary : theme.ash,
                      backgroundColor: f.selected ? theme.tertiary : theme.surface,
                    }]}
                  >
                    <View style={s.fuelCardTop}>
                      <View style={[s.fuelCheck, {
                        backgroundColor: f.selected ? theme.primary : "transparent",
                        borderColor: f.selected ? theme.primary : theme.ash,
                      }]}>
                        {f.selected && <Ionicons name="checkmark" size={13} color="#fff" />}
                      </View>
                      <Text style={[s.fuelName, { color: theme.text }]}>{f.name}</Text>
                      <Text style={[s.fuelUnit, { color: theme.icon }]}>per {f.unit}</Text>
                    </View>
                    {f.selected && (
                      <View style={s.fuelPriceRow}>
                        <Text style={[s.fuelPriceLabel, { color: theme.icon }]}>₦ Price per {f.unit}</Text>
                        <TextInput
                          style={[s.fuelPriceInput, { color: theme.text, borderColor: theme.ash, backgroundColor: theme.background }]}
                          value={f.pricePerUnit} onChangeText={(v) => setFuelPrice(f.fuelId, v)}
                          keyboardType="numeric" placeholder="0.00" placeholderTextColor={theme.icon}
                          onStartShouldSetResponder={() => true}
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {/* ── STEP 3: Station Image ── */}
          {step === 3 && (
            <View style={s.slide}>
              <Text style={[s.heading, { color: theme.text }]}>Add a station photo</Text>
              <Text style={[s.sub, { color: theme.icon }]}>A clear photo of your station builds trust with customers.</Text>

              <TouchableOpacity onPress={pickImage} disabled={uploadingImage} style={[s.imageUploadBox, { borderColor: theme.ash, backgroundColor: theme.surface }]}>
                {uploadingImage ? (
                  <ActivityIndicator size="large" color={theme.primary} />
                ) : stationImage ? (
                  <Image source={{ uri: stationImage }} style={s.stationImage} resizeMode="cover" />
                ) : (
                  <View style={s.imagePlaceholder}>
                    <Ionicons name="camera-outline" size={40} color={theme.icon} />
                    <Text style={[s.imagePlaceholderText, { color: theme.icon }]}>Tap to upload photo</Text>
                  </View>
                )}
              </TouchableOpacity>

              {stationImage && (
                <TouchableOpacity onPress={pickImage} style={s.changeImageBtn}>
                  <Text style={[s.changeImageText, { color: theme.primary }]}>Change photo</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── STEP 4: Bank Details ── */}
          {step === 4 && (
            <View style={s.slide}>
              <Text style={[s.heading, { color: theme.text }]}>Payout details</Text>
              <Text style={[s.sub, { color: theme.icon }]}>
                Your earnings will be paid to this bank account. You can update this later.
              </Text>

              <FieldGroup label="Bank Name *">
                <TextInput
                  style={[s.input, { color: theme.text, borderColor: theme.ash, backgroundColor: theme.surface }]}
                  value={bankName} onChangeText={setBankName}
                  placeholder="e.g. First Bank, GTBank" placeholderTextColor={theme.icon}
                />
              </FieldGroup>

              <FieldGroup label="Account Number *">
                <TextInput
                  style={[s.input, { color: theme.text, borderColor: theme.ash, backgroundColor: theme.surface }]}
                  value={accountNumber} onChangeText={setAccountNumber}
                  keyboardType="numeric" maxLength={10}
                  placeholder="10-digit account number" placeholderTextColor={theme.icon}
                />
              </FieldGroup>

              <FieldGroup label="Account Name *">
                <TextInput
                  style={[s.input, { color: theme.text, borderColor: theme.ash, backgroundColor: theme.surface }]}
                  value={accountName} onChangeText={setAccountName}
                  placeholder="Name on your bank account" placeholderTextColor={theme.icon}
                  autoCapitalize="words"
                />
              </FieldGroup>

              <View style={[s.noticeBanner, { backgroundColor: theme.tertiary }]}>
                <Ionicons name="lock-closed-outline" size={14} color={theme.primary} />
                <Text style={[s.noticeText, { color: theme.icon }]}>
                  Your bank details are encrypted and only used for payouts.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={[s.footer, { borderTopColor: theme.ash }]}>
          <View style={s.dots}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View key={i} style={[s.dot, { backgroundColor: i <= step ? theme.primary : theme.ash, width: i === step ? 24 : 8 }]} />
            ))}
          </View>
          <TouchableOpacity
            onPress={step < TOTAL_STEPS - 1 ? () => setStep((v) => v + 1) : handleFinish}
            disabled={!canNext || saving}
            style={[s.nextBtn, { backgroundColor: canNext ? theme.primary : theme.primary + "40" }]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.nextBtnText}>{step < TOTAL_STEPS - 1 ? "Continue" : "Launch My Station"}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 13, color: theme.icon, marginBottom: 6 }}>{label}</Text>
      {children}
    </View>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
    backBtn: { width: 40, height: 40, justifyContent: "center" },
    stepLabel: { fontSize: 13, fontWeight: "400" },
    scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 16 },
    slide: { paddingTop: 12 },
    heading: { fontSize: 26, fontWeight: "700", marginBottom: 8, marginTop: 4 },
    sub: { fontSize: 14, lineHeight: 21, marginBottom: 28 },
    fieldLabel: { fontSize: 13, marginBottom: 8 },
    input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15 },
    row: { flexDirection: "row", gap: 12 },
    hint: { fontSize: 12, lineHeight: 18, marginTop: -8, marginBottom: 8 },

    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
    chipText: { fontSize: 13, fontWeight: "400" },

    fuelCard: { borderWidth: 1.5, borderRadius: 14, padding: 14, marginBottom: 10 },
    fuelCardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
    fuelCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, justifyContent: "center", alignItems: "center" },
    fuelName: { flex: 1, fontSize: 15, fontWeight: "500" },
    fuelUnit: { fontSize: 12 },
    fuelPriceRow: { flexDirection: "row", alignItems: "center", marginTop: 12, gap: 12 },
    fuelPriceLabel: { fontSize: 13, flex: 1 },
    fuelPriceInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, width: 120, textAlign: "right" },

    imageUploadBox: { borderWidth: 1.5, borderRadius: 16, borderStyle: "dashed", height: 200, overflow: "hidden", justifyContent: "center", alignItems: "center" },
    stationImage: { width: "100%", height: "100%" },
    imagePlaceholder: { alignItems: "center", gap: 12 },
    imagePlaceholderText: { fontSize: 14, fontWeight: "300" },
    changeImageBtn: { alignItems: "center", marginTop: 12 },
    changeImageText: { fontSize: 14, fontWeight: "500" },

    noticeBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 12, marginTop: 8 },
    noticeText: { fontSize: 12, lineHeight: 18, flex: 1 },

    footer: { paddingHorizontal: 24, paddingBottom: 20, paddingTop: 12, gap: 16, borderTopWidth: StyleSheet.hairlineWidth },
    dots: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 },
    dot: { height: 8, borderRadius: 4 },
    nextBtn: { paddingVertical: 16, borderRadius: 14, alignItems: "center" },
    nextBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  });
