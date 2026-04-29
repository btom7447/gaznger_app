import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "expo-router";
import { toast } from "sonner-native";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";
import BackButton from "@/components/ui/global/BackButton";
import Skeleton from "@/components/ui/global/Skeleton";

interface RiderProfileData {
  vehicleType: string;
  vehiclePlate: string;
  vehicleBrand?: string;
  vehicleColor?: string;
  vehicleYear?: number;
  isVerified: boolean;
  verificationStatus?: "pending" | "verified" | "rejected";
  verificationNote?: string;
  nationalIdUrl?: string;
  driversLicenseUrl?: string;
  vehiclePapersUrl?: string;
  vehicleImageUrl?: string;
  plateImageUrl?: string;
}

const VEHICLE_TYPES = [
  { value: "motorcycle", label: "Motorcycle", icon: "two-wheeler" },
  { value: "car", label: "Car", icon: "directions-car" },
  { value: "truck", label: "Truck", icon: "local-shipping" },
];

const KYC_DOCS: {
  key: keyof Pick<RiderProfileData, "nationalIdUrl" | "driversLicenseUrl" | "vehiclePapersUrl" | "vehicleImageUrl" | "plateImageUrl">;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  hint: string;
}[] = [
  { key: "nationalIdUrl", label: "National ID", icon: "id-card-outline", hint: "Clear photo of your national ID" },
  { key: "driversLicenseUrl", label: "Driver's License", icon: "document-text-outline", hint: "Front of your driver's license" },
  { key: "vehiclePapersUrl", label: "Vehicle Papers", icon: "document-outline", hint: "Registration / insurance documents" },
  { key: "vehicleImageUrl", label: "Vehicle Photo", icon: "image-outline", hint: "Full side photo of your vehicle" },
  { key: "plateImageUrl", label: "Plate Number Photo", icon: "camera-outline", hint: "Clear photo of your license plate" },
];

async function uploadImage(uri: string): Promise<string> {
  const filename = uri.split("/").pop() ?? "photo.jpg";
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : "image/jpeg";
  const formData = new FormData();
  formData.append("image", { uri, name: filename, type } as any);
  const res = await api.uploadForm<{ url: string }>("/api/upload/image", formData, "POST");
  return res.url;
}

async function pickAndUpload(
  setUploading: (v: boolean) => void
): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    toast.error("Photo library permission required");
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    quality: 0.75,
  });
  if (result.canceled || !result.assets[0]) return null;
  setUploading(true);
  try {
    return await uploadImage(result.assets[0].uri);
  } catch {
    toast.error("Upload failed. Try again.");
    return null;
  } finally {
    setUploading(false);
  }
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const theme = useTheme();
  return (
    <View style={[infoStyles.row, { borderBottomColor: theme.ash }]}>
      <View style={[infoStyles.iconWrap, { backgroundColor: theme.tertiary }]}>
        <Ionicons
          name={icon}
          size={16}
          color={theme.primary}
        />
      </View>
      <View style={infoStyles.text}>
        <Text style={[infoStyles.label, { color: theme.icon }]}>{label}</Text>
        <Text style={[infoStyles.value, { color: theme.text }]}>
          {value || "—"}
        </Text>
      </View>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  text: { flex: 1 },
  label: { fontSize: 11, marginBottom: 2 },
  value: { fontSize: 14, fontWeight: "500" },
});

export default function VehicleDetailScreen() {
  const theme = useTheme();

  const [profile, setProfile] = useState<RiderProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Editable state
  const [plateInput, setPlateInput] = useState("");
  const [brandInput, setBrandInput] = useState("");
  const [colorInput, setColorInput] = useState("");
  const [yearInput, setYearInput] = useState("");
  const [kycUrls, setKycUrls] = useState<Partial<Record<string, string>>>({});

  const fetchProfile = useCallback(async () => {
    try {
      const data = await api.get<RiderProfileData>("/api/rider/profile");
      setProfile(data);
      setPlateInput(data.vehiclePlate ?? "");
      setBrandInput(data.vehicleBrand ?? "");
      setColorInput(data.vehicleColor ?? "");
      setYearInput(data.vehicleYear ? String(data.vehicleYear) : "");
      setKycUrls({
        nationalIdUrl: data.nationalIdUrl,
        driversLicenseUrl: data.driversLicenseUrl,
        vehiclePapersUrl: data.vehiclePapersUrl,
        vehicleImageUrl: data.vehicleImageUrl,
        plateImageUrl: data.plateImageUrl,
      });
    } catch {
      toast.error("Failed to load vehicle info");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchProfile(); }, [fetchProfile]));

  const handlePickDoc = async (key: string) => {
    const url = await pickAndUpload(setUploading);
    if (url) setKycUrls((prev) => ({ ...prev, [key]: url }));
  };

  const handleSave = () => {
    Alert.alert(
      "Save Vehicle Details",
      "Any changes to your vehicle details or documents will require re-verification by our team before you can accept deliveries. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Save & Submit",
          onPress: async () => {
            setSaving(true);
            try {
              const payload: Record<string, unknown> = {};
              if (plateInput.trim().toUpperCase() !== profile?.vehiclePlate) {
                payload.vehiclePlate = plateInput.trim().toUpperCase();
              }
              if (brandInput.trim() !== (profile?.vehicleBrand ?? "")) {
                payload.vehicleBrand = brandInput.trim();
              }
              if (colorInput.trim() !== (profile?.vehicleColor ?? "")) {
                payload.vehicleColor = colorInput.trim();
              }
              const yearNum = yearInput ? parseInt(yearInput, 10) : undefined;
              if (yearNum && yearNum !== profile?.vehicleYear) {
                payload.vehicleYear = yearNum;
              }
              // Include KYC docs that changed
              for (const doc of KYC_DOCS) {
                const newUrl = kycUrls[doc.key];
                const oldUrl = profile?.[doc.key];
                if (newUrl && newUrl !== oldUrl) payload[doc.key] = newUrl;
              }

              if (Object.keys(payload).length === 0) {
                setEditing(false);
                return;
              }

              await api.patch("/api/rider/profile", payload);
              await fetchProfile();
              setEditing(false);
              toast.success("Details saved", { description: "Verification pending. Our team will review within 24h." });
            } catch (err: any) {
              toast.error("Failed to save", { description: err.message });
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const s = styles(theme);
  const verStatus = profile?.verificationStatus ?? (profile?.isVerified ? "verified" : "pending");
  const verColor = verStatus === "verified" ? "#059669" : verStatus === "rejected" ? "#DC2626" : "#D97706";
  const verBg = verStatus === "verified" ? "#D1FAE5" : verStatus === "rejected" ? "#FEE2E2" : "#FEF3C7";
  const verIcon = verStatus === "verified" ? "shield-checkmark" : verStatus === "rejected" ? "close-circle" : "time-outline";

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
      <View style={[s.header, { borderBottomColor: theme.ash }]}>
        <BackButton />
        <Text style={[s.headerTitle, { color: theme.text }]}>
          Vehicle Details
        </Text>
        {!editing ? (
          <TouchableOpacity
            onPress={() => setEditing(true)}
            activeOpacity={0.7}
            style={s.editBtn}
          >
            <Text style={[s.editBtnText, { color: theme.primary }]}>Edit</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => {
              setEditing(false);
              fetchProfile();
            }}
            activeOpacity={0.7}
            style={s.editBtn}
          >
            <Text style={[s.editBtnText, { color: theme.icon }]}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Verification banner skeleton */}
          <View style={[s.verBanner, { backgroundColor: theme.tertiary }]}>
            <Skeleton width={18} height={18} borderRadius={9} color={theme.ash} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width="40%" height={13} borderRadius={5} color={theme.ash} />
              <Skeleton width="75%" height={12} borderRadius={4} color={theme.ash} />
            </View>
          </View>
          {/* Vehicle type skeleton */}
          <Skeleton width="30%" height={11} borderRadius={4} color={theme.ash} style={{ marginBottom: 10, marginTop: 20 }} />
          <View style={s.typeGrid}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[s.typeCard, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
                <Skeleton width={22} height={22} borderRadius={6} color={theme.ash} />
                <Skeleton width={52} height={12} borderRadius={4} color={theme.ash} />
              </View>
            ))}
          </View>
          {/* Details section skeleton */}
          <Skeleton width="25%" height={11} borderRadius={4} color={theme.ash} style={{ marginBottom: 10, marginTop: 20 }} />
          <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: i < 3 ? 1 : 0, borderBottomColor: theme.ash }]}>
                <Skeleton width={36} height={36} borderRadius={10} color={theme.ash} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Skeleton width="30%" height={11} borderRadius={4} color={theme.ash} />
                  <Skeleton width="55%" height={14} borderRadius={5} color={theme.ash} />
                </View>
              </View>
            ))}
          </View>
          {/* KYC docs skeleton */}
          <Skeleton width="35%" height={11} borderRadius={4} color={theme.ash} style={{ marginBottom: 10, marginTop: 20 }} />
          <View style={s.docsGrid}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View key={i} style={[s.docCard, { backgroundColor: theme.surface, borderColor: theme.ash, alignItems: "center", gap: 8 }]}>
                <Skeleton width={44} height={44} borderRadius={10} color={theme.ash} />
                <Skeleton width={54} height={11} borderRadius={4} color={theme.ash} />
                <Skeleton width={40} height={10} borderRadius={4} color={theme.ash} />
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Verification Status Banner */}
          <View style={[s.verBanner, { backgroundColor: verBg }]}>
            <MaterialIcons
              name={
                verStatus === "verified"
                  ? "verified"
                  : verStatus === "rejected"
                    ? "error"
                    : "new-releases"
              }
              size={18}
              color={verColor}
            />
            <View style={{ flex: 1 }}>
              <Text style={[s.verTitle, { color: verColor }]}>
                {verStatus === "verified"
                  ? "Verified"
                  : verStatus === "rejected"
                    ? "Verification Rejected"
                    : "Pending Verification"}
              </Text>
              <Text style={[s.verSub, { color: verColor + "CC" }]}>
                {verStatus === "verified"
                  ? "Your vehicle and documents are verified."
                  : verStatus === "rejected"
                    ? (profile?.verificationNote ??
                      "Your submission was rejected. Edit and resubmit.")
                    : "Our team is reviewing your details (up to 48 hours)."}
              </Text>
            </View>
          </View>

          {/* Vehicle Type */}
          <Text style={[s.sectionTitle, { color: theme.icon }]}>
            Vehicle Type
          </Text>
          <View style={s.typeGrid}>
            {VEHICLE_TYPES.map((vt) => {
              const isSelected = profile?.vehicleType === vt.value;
              return (
                <View
                  key={vt.value}
                  style={[
                    s.typeCard,
                    {
                      backgroundColor: isSelected
                        ? theme.primary + "12"
                        : theme.surface,
                      borderColor: isSelected ? theme.primary : theme.ash,
                    },
                  ]}
                >
                  <MaterialIcons
                    name={vt.icon as any}
                    size={22}
                    color={isSelected ? theme.primary : theme.icon}
                  />
                  <Text
                    style={[
                      s.typeLabel,
                      { color: isSelected ? theme.primary : theme.text },
                    ]}
                  >
                    {vt.label}
                  </Text>
                  {isSelected && (
                    <View style={s.typeCheck}>
                      <MaterialIcons
                        name="check-circle"
                        size={14}
                        color={theme.primary}
                      />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
          <Text style={[s.typeNote, { color: theme.icon }]}>
            To change vehicle type, contact support.
          </Text>

          {/* Vehicle Details */}
          <Text style={[s.sectionTitle, { color: theme.icon }]}>Details</Text>
          <View
            style={[
              s.card,
              { backgroundColor: theme.surface, borderColor: theme.ash },
            ]}
          >
            {editing ? (
              <>
                <EditField
                  icon="card-outline"
                  label="Plate Number"
                  value={plateInput}
                  onChange={(t) => setPlateInput(t.toUpperCase())}
                  placeholder="e.g. ABC 123 XY"
                  autoCapitalize="characters"
                  maxLength={12}
                  theme={theme}
                />
                <EditField
                  icon="car-outline"
                  label="Vehicle Brand"
                  value={brandInput}
                  onChange={setBrandInput}
                  placeholder="e.g. Honda, Toyota"
                  theme={theme}
                />
                <EditField
                  icon="color-palette-outline"
                  label="Color"
                  value={colorInput}
                  onChange={setColorInput}
                  placeholder="e.g. Red, Black"
                  theme={theme}
                />
                <EditField
                  icon="calendar-outline"
                  label="Year"
                  value={yearInput}
                  onChange={setYearInput}
                  placeholder="e.g. 2020"
                  keyboardType="number-pad"
                  maxLength={4}
                  theme={theme}
                  noBorder
                />
              </>
            ) : (
              <>
                <InfoRow
                  icon="card-outline"
                  label="Plate Number"
                  value={profile?.vehiclePlate ?? "—"}
                />
                <InfoRow
                  icon="car-outline"
                  label="Brand"
                  value={profile?.vehicleBrand ?? "—"}
                />
                <InfoRow
                  icon="color-palette-outline"
                  label="Color"
                  value={profile?.vehicleColor ?? "—"}
                />
                <InfoRow
                  icon="calendar-outline"
                  label="Year"
                  value={
                    profile?.vehicleYear ? String(profile.vehicleYear) : "—"
                  }
                />
              </>
            )}
          </View>

          {/* KYC Documents */}
          <Text style={[s.sectionTitle, { color: theme.icon }]}>
            KYC Documents
          </Text>
          {editing && (
            <View style={[s.kycNote, { backgroundColor: theme.error + 15 }]}>
              <Ionicons
                name="information-circle-outline"
                size={14}
                color={theme.error}
              />
              <Text style={[s.kycNoteText, { color: theme.error }]}>
                Submit all required documents to get verified. Any changes
                require re-approval.
              </Text>
            </View>
          )}
          <View style={s.docsGrid}>
            {KYC_DOCS.map((doc) => {
              const url = kycUrls[doc.key];
              const hasDoc = !!url;
              return (
                <TouchableOpacity
                  key={doc.key}
                  style={[
                    s.docCard,
                    {
                      backgroundColor: hasDoc
                        ? theme.primary + "10"
                        : theme.surface,
                      borderColor: hasDoc ? theme.primary + "40" : theme.ash,
                    },
                  ]}
                  onPress={editing ? () => handlePickDoc(doc.key) : undefined}
                  activeOpacity={editing ? 0.75 : 1}
                  disabled={!editing || uploading}
                >
                  {hasDoc && url ? (
                    <Image source={{ uri: url }} style={s.docThumb} />
                  ) : (
                    <View
                      style={[
                        s.docIconWrap,
                        { backgroundColor: theme.tertiary },
                      ]}
                    >
                      <Ionicons name={doc.icon} size={22} color={theme.icon} />
                    </View>
                  )}
                  <Text
                    style={[
                      s.docLabel,
                      { color: hasDoc ? theme.primary : theme.text },
                    ]}
                    numberOfLines={2}
                  >
                    {doc.label}
                  </Text>
                  {editing && (
                    <View
                      style={[
                        s.docEditBadge,
                        { backgroundColor: hasDoc ? "#D1FAE5" : theme.ash },
                      ]}
                    >
                      <Ionicons
                        name={hasDoc ? "checkmark" : "cloud-upload-outline"}
                        size={10}
                        color={hasDoc ? "#059669" : theme.icon}
                      />
                      <Text
                        style={[
                          s.docEditText,
                          { color: hasDoc ? "#059669" : theme.icon },
                        ]}
                      >
                        {hasDoc ? "Uploaded" : "Upload"}
                      </Text>
                    </View>
                  )}
                  {!editing && hasDoc && (
                    <View style={s.docCheckOverlay}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color="#059669"
                      />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Save button */}
          {editing && (
            <>
              {uploading && (
                <View style={s.uploadingRow}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <Text style={[s.uploadingText, { color: theme.icon }]}>
                    Uploading document…
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={[
                  s.saveBtn,
                  {
                    backgroundColor: theme.primary,
                    opacity: saving || uploading ? 0.6 : 1,
                  },
                ]}
                onPress={handleSave}
                disabled={saving || uploading}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.saveBtnText}>
                    Save & Submit for Verification
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function EditField({
  icon,
  label,
  value,
  onChange,
  placeholder,
  autoCapitalize,
  maxLength,
  keyboardType,
  theme,
  noBorder,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onChange: (t: string) => void;
  placeholder: string;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  maxLength?: number;
  keyboardType?: "default" | "number-pad";
  theme: ReturnType<typeof import("@/constants/theme").useTheme>;
  noBorder?: boolean;
}) {
  return (
    <View style={[efStyles.row, { borderBottomColor: theme.ash, borderBottomWidth: noBorder ? 0 : 1 }]}>
      <View style={[efStyles.iconWrap, { backgroundColor: theme.tertiary }]}>
        <Ionicons name={icon} size={15} color={theme.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[efStyles.label, { color: theme.icon }]}>{label}</Text>
        <TextInput
          style={[efStyles.input, { color: theme.text }]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={theme.icon}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          maxLength={maxLength}
          keyboardType={keyboardType ?? "default"}
        />
      </View>
    </View>
  );
}

const efStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  iconWrap: { width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 11, marginBottom: 2 },
  input: { fontSize: 14, fontWeight: "500", paddingVertical: 0 },
});

const styles = (theme: ReturnType<typeof import("@/constants/theme").useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    header: {
      flexDirection: "row", gap: 20, alignItems: "center",
      paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
    },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: "700" },
    editBtn: { padding: 4 },
    editBtnText: { fontSize: 14, fontWeight: "600" },
    scroll: { padding: 20, paddingBottom: 48 },

    verBanner: {
      flexDirection: "row", alignItems: "flex-start", gap: 10,
      padding: 14, borderRadius: 14, marginBottom: 20,
    },
    verTitle: { fontSize: 13, fontWeight: "700", marginBottom: 2 },
    verSub: { fontSize: 12, lineHeight: 17 },

    sectionTitle: {
      fontSize: 11, fontWeight: "600", textTransform: "uppercase",
      letterSpacing: 0.8, marginBottom: 10, marginTop: 20, paddingLeft: 2,
    },

    typeGrid: { flexDirection: "row", gap: 10 },
    typeCard: {
      flex: 1, alignItems: "center", gap: 6,
      paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, position: "relative",
    },
    typeLabel: { fontSize: 12, fontWeight: "600" },
    typeCheck: { position: "absolute", top: 5, right: 5 },
    typeNote: { fontSize: 12, marginTop: 8 },

    card: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 14 },

    kycNote: {
      flexDirection: "row", alignItems: "flex-start", gap: 8,
      padding: 10, borderRadius: 10, marginBottom: 10,
    },
    kycNoteText: { flex: 1, fontSize: 12, lineHeight: 17 },

    docsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    docCard: {
      width: "30%", alignItems: "center", gap: 6,
      borderRadius: 14, borderWidth: 1.5, padding: 12,
      position: "relative", minHeight: 100,
    },
    docThumb: { width: 44, height: 44, borderRadius: 8, resizeMode: "cover" },
    docIconWrap: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    docLabel: { fontSize: 11, fontWeight: "600", textAlign: "center", lineHeight: 14 },
    docEditBadge: {
      flexDirection: "row", alignItems: "center", gap: 3,
      paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
    },
    docEditText: { fontSize: 9, fontWeight: "700" },
    docCheckOverlay: { position: "absolute", top: 5, right: 5 },

    uploadingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
    uploadingText: { fontSize: 13 },

    saveBtn: {
      marginTop: 24, paddingVertical: 16, borderRadius: 16,
      alignItems: "center", justifyContent: "center",
    },
    saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  });
