import React, { useState } from "react";
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

const TOTAL_STEPS = 3;

type VehicleType = "motorcycle" | "tricycle" | "van";

const VEHICLE_OPTIONS: { type: VehicleType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { type: "motorcycle", label: "Motorcycle", icon: "bicycle-outline" },
  { type: "tricycle", label: "Tricycle (Keke)", icon: "car-sport-outline" },
  { type: "van", label: "Van / Truck", icon: "car-outline" },
];

export default function RiderOnboarding() {
  const theme = useTheme();
  const { updateUser } = useSessionStore();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 0 — Vehicle
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(null);
  const [vehiclePlate, setVehiclePlate] = useState("");

  // Step 1 — Profile photo
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Step 2 — Bank details
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  const canNext = [
    vehicleType !== null && vehiclePlate.trim().length >= 5,
    true, // photo optional but we encourage it
    bankName.trim().length > 0 && accountNumber.trim().length >= 10 && accountName.trim().length > 0,
  ][step];

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (result.canceled) return;
    setUploadingPhoto(true);
    try {
      const uri = result.assets[0].uri;
      const formData = new FormData();
      formData.append("image", { uri, name: "profile.jpg", type: "image/jpeg" } as any);
      const res = await fetch(`${process.env.EXPO_PUBLIC_BASE_URL}/api/upload/image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${useSessionStore.getState().accessToken}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setProfilePhoto(data.url);
    } catch (err: any) {
      toast.error("Photo upload failed", { description: err.message });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await api.post("/api/rider/setup", {
        vehicleType,
        vehiclePlate: vehiclePlate.trim().toUpperCase(),
        bankAccount: {
          bankName: bankName.trim(),
          accountNumber: accountNumber.trim(),
          accountName: accountName.trim(),
        },
      });

      if (profilePhoto) {
        await api.put("/auth/me", { profileImage: profilePhoto });
        updateUser({ profileImage: profilePhoto });
      }

      updateUser({ isOnboarded: true });
      toast.success("You're set up!", { description: "Welcome to Gaznger Riders." });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.replace("/(rider)/(queue)" as any);
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

          {/* ── STEP 0: Vehicle ── */}
          {step === 0 && (
            <View style={s.slide}>
              <Text style={[s.heading, { color: theme.text }]}>Your delivery vehicle</Text>
              <Text style={[s.sub, { color: theme.icon }]}>This helps us match you to the right orders.</Text>

              <View style={s.vehicleGrid}>
                {VEHICLE_OPTIONS.map((v) => {
                  const active = vehicleType === v.type;
                  return (
                    <TouchableOpacity
                      key={v.type} onPress={() => setVehicleType(v.type)} activeOpacity={0.85}
                      style={[s.vehicleCard, {
                        borderColor: active ? theme.primary : theme.ash,
                        backgroundColor: active ? theme.tertiary : theme.surface,
                      }]}
                    >
                      <View style={[s.vehicleIconWrap, { backgroundColor: active ? theme.primary : theme.ash }]}>
                        <Ionicons name={v.icon} size={28} color={active ? "#fff" : theme.icon} />
                      </View>
                      <Text style={[s.vehicleLabel, { color: active ? theme.primary : theme.text }]}>{v.label}</Text>
                      {active && (
                        <View style={[s.vehicleCheck, { backgroundColor: theme.primary }]}>
                          <Ionicons name="checkmark" size={11} color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[s.fieldLabel, { color: theme.icon }]}>Plate Number *</Text>
              <TextInput
                style={[s.input, { color: theme.text, borderColor: theme.ash, backgroundColor: theme.surface }]}
                value={vehiclePlate} onChangeText={setVehiclePlate}
                placeholder="e.g. LAG-123-AB" placeholderTextColor={theme.icon}
                autoCapitalize="characters"
              />
            </View>
          )}

          {/* ── STEP 1: Profile Photo ── */}
          {step === 1 && (
            <View style={s.slide}>
              <Text style={[s.heading, { color: theme.text }]}>Add a profile photo</Text>
              <Text style={[s.sub, { color: theme.icon }]}>
                Customers see your photo during delivery. A clear face photo builds trust.
              </Text>

              <TouchableOpacity onPress={pickPhoto} disabled={uploadingPhoto} style={s.avatarBtn}>
                {uploadingPhoto ? (
                  <View style={[s.avatar, s.avatarFallback, { backgroundColor: theme.tertiary }]}>
                    <ActivityIndicator size="large" color={theme.primary} />
                  </View>
                ) : profilePhoto ? (
                  <Image source={{ uri: profilePhoto }} style={s.avatar} />
                ) : (
                  <View style={[s.avatar, s.avatarFallback, { backgroundColor: theme.tertiary }]}>
                    <Ionicons name="person" size={48} color={theme.primary} />
                  </View>
                )}
                <View style={[s.cameraBadge, { backgroundColor: theme.primary }]}>
                  <Ionicons name="camera" size={13} color="#fff" />
                </View>
              </TouchableOpacity>
              <Text style={[s.avatarHint, { color: theme.icon }]}>
                {profilePhoto ? "Tap to change" : "Tap to upload (optional)"}
              </Text>

              <View style={[s.tipCard, { backgroundColor: theme.tertiary }]}>
                <Ionicons name="information-circle-outline" size={16} color={theme.primary} />
                <Text style={[s.tipText, { color: theme.icon }]}>
                  You can skip this step and add a photo later from your profile settings.
                </Text>
              </View>
            </View>
          )}

          {/* ── STEP 2: Bank Details ── */}
          {step === 2 && (
            <View style={s.slide}>
              <Text style={[s.heading, { color: theme.text }]}>How do we pay you?</Text>
              <Text style={[s.sub, { color: theme.icon }]}>
                Your delivery earnings are sent directly to this bank account after each completed delivery.
              </Text>

              <Text style={[s.fieldLabel, { color: theme.icon }]}>Bank Name *</Text>
              <TextInput
                style={[s.input, { color: theme.text, borderColor: theme.ash, backgroundColor: theme.surface, marginBottom: 16 }]}
                value={bankName} onChangeText={setBankName}
                placeholder="e.g. GTBank, Access Bank" placeholderTextColor={theme.icon}
              />

              <Text style={[s.fieldLabel, { color: theme.icon }]}>Account Number *</Text>
              <TextInput
                style={[s.input, { color: theme.text, borderColor: theme.ash, backgroundColor: theme.surface, marginBottom: 16 }]}
                value={accountNumber} onChangeText={setAccountNumber}
                keyboardType="numeric" maxLength={10}
                placeholder="10-digit NUBAN" placeholderTextColor={theme.icon}
              />

              <Text style={[s.fieldLabel, { color: theme.icon }]}>Account Name *</Text>
              <TextInput
                style={[s.input, { color: theme.text, borderColor: theme.ash, backgroundColor: theme.surface, marginBottom: 16 }]}
                value={accountName} onChangeText={setAccountName}
                placeholder="Name on the account" placeholderTextColor={theme.icon}
                autoCapitalize="words"
              />

              <View style={[s.tipCard, { backgroundColor: theme.tertiary }]}>
                <Ionicons name="lock-closed-outline" size={14} color={theme.primary} />
                <Text style={[s.tipText, { color: theme.icon }]}>
                  Your bank details are encrypted and used only to send your earnings.
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
              <Text style={s.nextBtnText}>{step < TOTAL_STEPS - 1 ? "Continue" : "Start Delivering"}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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

    vehicleGrid: { flexDirection: "row", gap: 12, marginBottom: 28, flexWrap: "wrap" },
    vehicleCard: {
      flex: 1, minWidth: 90, alignItems: "center", paddingVertical: 24,
      borderRadius: 16, borderWidth: 1.5, gap: 10, position: "relative",
    },
    vehicleIconWrap: { width: 56, height: 56, borderRadius: 28, justifyContent: "center", alignItems: "center" },
    vehicleLabel: { fontSize: 13, fontWeight: "500" },
    vehicleCheck: { position: "absolute", top: 8, right: 8, width: 20, height: 20, borderRadius: 10, justifyContent: "center", alignItems: "center" },

    avatarBtn: { alignSelf: "center", position: "relative", marginBottom: 8, marginTop: 8 },
    avatar: { width: 110, height: 110, borderRadius: 55 },
    avatarFallback: { justifyContent: "center", alignItems: "center" },
    cameraBadge: { position: "absolute", bottom: 2, right: 2, width: 30, height: 30, borderRadius: 15, justifyContent: "center", alignItems: "center" },
    avatarHint: { textAlign: "center", fontSize: 13, marginBottom: 28 },

    tipCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 12 },
    tipText: { fontSize: 12, lineHeight: 18, flex: 1 },

    footer: { paddingHorizontal: 24, paddingBottom: 20, paddingTop: 12, gap: 16, borderTopWidth: StyleSheet.hairlineWidth },
    dots: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 },
    dot: { height: 8, borderRadius: 4 },
    nextBtn: { paddingVertical: 16, borderRadius: 14, alignItems: "center" },
    nextBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  });
