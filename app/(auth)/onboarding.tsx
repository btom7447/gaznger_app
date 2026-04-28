import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { toast } from "sonner-native";
import { useSessionStore } from "@/store/useSessionStore";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";
import FormField from "@/components/ui/auth/FormField";

const TOTAL_STEPS = 3;

export default function OnboardingScreen() {
  const theme = useTheme();
  const { user, updateUser } = useSessionStore();
  const [step, setStep] = useState(0);

  // Slide 1
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [profileImage, setProfileImage] = useState<string | null>(
    user?.profileImage ?? null,
  );
  const [uploadingImage, setUploadingImage] = useState(false);

  // Slide 2
  const [gender, setGender] = useState<"male" | "female" | "">(
    (user?.gender as "male" | "female") ?? "",
  );

  // Slide 3
  const [label, setLabel] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [saving, setSaving] = useState(false);

  const canNext = [
    displayName.trim().length > 0,
    gender !== "",
    label.trim().length > 0,
  ][step];

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("image", {
        uri,
        name: "profile.jpg",
        type: "image/jpeg",
      } as any);
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_BASE_URL}/api/upload/image`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${useSessionStore.getState().accessToken}`,
          },
          body: formData,
        },
      );
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setProfileImage(data.url);
    } catch (err: any) {
      toast.error("Photo upload failed", { description: err.message });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    console.log(
      "[onboarding] token:",
      useSessionStore.getState().accessToken?.slice(0, 20),
    );
    try {
      const profilePayload: Record<string, string> = { displayName };
      if (phone.trim()) profilePayload.phone = phone.trim();
      if (gender) profilePayload.gender = gender;
      if (profileImage) profilePayload.profileImage = profileImage;

      const data = await api.put<any>("/auth/me", profilePayload);
      updateUser({
        displayName: data.displayName,
        phone: data.phone,
        gender: data.gender,
        profileImage: data.profileImage,
      });

      await api.post("/api/address-book", {
        label: label.trim(),
        street: street.trim(),
        city: city.trim(),
        state: addressState.trim(),
      });

      router.replace("/(customer)/(home)" as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error("Setup failed", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Back arrow — only on steps > 0 */}
        <View style={styles.topBar}>
          {step > 0 ? (
            <TouchableOpacity
              onPress={() => setStep((s) => s - 1)}
              style={styles.backBtn}
            >
              <Ionicons
                name="arrow-back-outline"
                size={24}
                color={theme.text}
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.backBtn} />
          )}
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── SLIDE 1: Name & Photo ── */}
          {step === 0 && (
            <View style={styles.slide}>
              <TouchableOpacity
                onPress={pickImage}
                disabled={uploadingImage}
                style={styles.avatarBtn}
              >
                {uploadingImage ? (
                  <View
                    style={[
                      styles.avatar,
                      styles.avatarFallback,
                      { backgroundColor: theme.tertiary },
                    ]}
                  >
                    <ActivityIndicator size="large" color={theme.quaternary} />
                  </View>
                ) : profileImage ? (
                  <Image source={{ uri: profileImage }} style={styles.avatar} />
                ) : (
                  <View
                    style={[
                      styles.avatar,
                      styles.avatarFallback,
                      { backgroundColor: theme.tertiary },
                    ]}
                  >
                    <Ionicons
                      name="person"
                      size={44}
                      color={theme.quaternary}
                    />
                  </View>
                )}
                <View
                  style={[
                    styles.cameraBadge,
                    { backgroundColor: theme.quaternary },
                  ]}
                >
                  <Ionicons name="camera" size={13} color="#fff" />
                </View>
              </TouchableOpacity>
              <Text style={[styles.avatarHint, { color: theme.icon }]}>
                Add a photo (optional)
              </Text>

              <Text style={[styles.heading, { color: theme.text }]}>
                What's your name?
              </Text>
              <Text style={[styles.sub, { color: theme.icon }]}>
                This is how you'll appear in the app.
              </Text>

              <View style={styles.fields}>
                <FormField
                  title="Full Name"
                  value={displayName}
                  placeholder="e.g. John Doe"
                  handleChangeText={setDisplayName}
                  status={displayName.trim().length > 0 ? "success" : "default"}
                />
                <FormField
                  title="Phone Number"
                  value={phone}
                  placeholder="+234 800 000 0000"
                  handleChangeText={setPhone}
                  keyboardType="phone-pad"
                  status="default"
                />
              </View>
            </View>
          )}

          {/* ── SLIDE 2: Gender ── */}
          {step === 1 && (
            <View style={styles.slide}>
              <Text style={[styles.heading, { color: theme.text }]}>
                How do you identify?
              </Text>
              <Text style={[styles.sub, { color: theme.icon }]}>
                Helps us personalise your experience.
              </Text>

              <View style={styles.genderRow}>
                {(["male", "female"] as const).map((g) => {
                  const active = gender === g;
                  return (
                    <TouchableOpacity
                      key={g}
                      onPress={() => setGender(g)}
                      activeOpacity={0.8}
                      style={[
                        styles.genderCard,
                        {
                          borderColor: active ? theme.quaternary : theme.ash,
                          backgroundColor: active
                            ? theme.quaternary + "12"
                            : theme.quinest,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.genderIconCircle,
                          {
                            backgroundColor: active
                              ? theme.quaternary
                              : theme.ash,
                          },
                        ]}
                      >
                        <Ionicons
                          name={g === "male" ? "male" : "female"}
                          size={30}
                          color={active ? "#fff" : theme.icon}
                        />
                      </View>
                      <Text
                        style={[
                          styles.genderLabel,
                          { color: active ? theme.quaternary : theme.text },
                        ]}
                      >
                        {g.charAt(0).toUpperCase() + g.slice(1)}
                      </Text>
                      {active && (
                        <View
                          style={[
                            styles.genderCheck,
                            { backgroundColor: theme.quaternary },
                          ]}
                        >
                          <Ionicons name="checkmark" size={11} color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── SLIDE 3: Address ── */}
          {step === 2 && (
            <View style={styles.slide}>
              <Text style={[styles.heading, { color: theme.text }]}>
                Where do you deliver?
              </Text>
              <Text style={[styles.sub, { color: theme.icon }]}>
                Add your default delivery address. You can save more later.
              </Text>

              {/* Live preview card */}
              {label.trim().length > 0 && (
                <View
                  style={[
                    styles.addressCard,
                    {
                      backgroundColor: theme.quinest,
                      borderColor: theme.quaternary,
                    },
                  ]}
                >
                  <View style={styles.addressCardMain}>
                    <View
                      style={[
                        styles.addressIconBox,
                        { backgroundColor: theme.quaternary + "18" },
                      ]}
                    >
                      <Ionicons
                        name="location-sharp"
                        size={22}
                        color={theme.quaternary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.addressCardLabel, { color: theme.text }]}
                      >
                        {label}
                      </Text>
                      {(street || city) && (
                        <Text
                          style={[styles.addressCardSub, { color: theme.icon }]}
                        >
                          {[street, city, addressState]
                            .filter(Boolean)
                            .join(", ")}
                        </Text>
                      )}
                      <Text
                        style={[
                          styles.addressDefaultTag,
                          { color: theme.quaternary },
                        ]}
                      >
                        Default
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              <View style={styles.fields}>
                {[
                  {
                    title: "Label",
                    value: label,
                    onChange: setLabel,
                    placeholder: "e.g. Home, Office",
                    required: true,
                  },
                  {
                    title: "Street",
                    value: street,
                    onChange: setStreet,
                    placeholder: "Street address",
                    required: false,
                  },
                  {
                    title: "City",
                    value: city,
                    onChange: setCity,
                    placeholder: "City",
                    required: false,
                  },
                  {
                    title: "State",
                    value: addressState,
                    onChange: setAddressState,
                    placeholder: "State",
                    required: false,
                  },
                ].map((field) => (
                  <View key={field.title} style={styles.fieldGroup}>
                    <Text style={[styles.fieldLabel, { color: theme.icon }]}>
                      {field.title}
                      {field.required ? " *" : ""}
                    </Text>
                    <TextInput
                      value={field.value}
                      onChangeText={field.onChange}
                      placeholder={field.placeholder}
                      placeholderTextColor={theme.icon}
                      style={[
                        styles.textInput,
                        {
                          color: theme.text,
                          borderColor: theme.ash,
                          backgroundColor: theme.quinest,
                        },
                      ]}
                    />
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          {/* Step dots */}
          <View style={styles.dots}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor: i <= step ? theme.quaternary : theme.ash,
                    width: i === step ? 24 : 8,
                  },
                ]}
              />
            ))}
          </View>

          <TouchableOpacity
            onPress={
              step < TOTAL_STEPS - 1
                ? () => setStep((s) => s + 1)
                : handleFinish
            }
            disabled={!canNext || saving}
            style={[
              styles.nextBtn,
              {
                backgroundColor: canNext
                  ? theme.quaternary
                  : theme.quaternary + "40",
              },
            ]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.nextBtnText}>
                {step < TOTAL_STEPS - 1 ? "Continue" : "Get Started"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  topBar: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: { width: 40, height: 40, justifyContent: "center" },

  scroll: { flexGrow: 1, paddingHorizontal: 28, paddingBottom: 16 },
  slide: { flex: 1, paddingTop: 12 },

  heading: { fontSize: 28, fontWeight: "700", marginBottom: 8, marginTop: 8 },
  sub: { fontSize: 15, lineHeight: 22, marginBottom: 36 },

  // Avatar
  avatarBtn: {
    alignSelf: "center",
    position: "relative",
    marginBottom: 10,
    marginTop: 8,
  },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarFallback: { justifyContent: "center", alignItems: "center" },
  cameraBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarHint: { textAlign: "center", fontSize: 13, marginBottom: 28 },

  fields: { gap: 4 },

  // Gender
  genderRow: { flexDirection: "row", gap: 14 },
  genderCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 36,
    borderRadius: 20,
    borderWidth: 2,
    gap: 14,
    position: "relative",
  },
  genderIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: "center",
    alignItems: "center",
  },
  genderLabel: { fontSize: 16, fontWeight: "600" },
  genderCheck: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },

  // Address card preview
  addressCard: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    marginBottom: 24,
  },
  addressCardMain: { flexDirection: "row", alignItems: "center", gap: 12 },
  addressIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  addressCardLabel: { fontSize: 15, fontWeight: "600" },
  addressCardSub: { fontSize: 13, marginTop: 2 },
  addressDefaultTag: { fontSize: 12, fontWeight: "600", marginTop: 4 },

  // Address fields
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, marginBottom: 6 },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
  },

  // Footer
  footer: {
    paddingHorizontal: 28,
    paddingBottom: 20,
    paddingTop: 12,
    gap: 16,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  dot: { height: 8, borderRadius: 4 },
  nextBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  nextBtnText: { color: "#fff", fontSize: 17, fontWeight: "600" },
});
