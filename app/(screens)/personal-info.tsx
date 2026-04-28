import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  TextInput,
} from "react-native";
import Avatar from "@/components/ui/global/Avatar";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { toast } from "sonner-native";
import { useSessionStore } from "@/store/useSessionStore";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";
import BackButton from "@/components/ui/global/BackButton";

const GENDER_OPTIONS = ["male", "female"] as const;

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  editable = true,
  icon,
}: {
  label: string;
  value: string;
  onChangeText?: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
  editable?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const theme = useTheme();
  return (
    <View style={fieldStyles(theme).wrap}>
      <Text style={fieldStyles(theme).label}>{label}</Text>
      <View style={[fieldStyles(theme).inputRow, { borderColor: editable ? theme.ash : theme.quinest, backgroundColor: editable ? theme.surface : theme.quinest }]}>
        {icon && <Ionicons name={icon} size={17} color={theme.icon} style={{ marginRight: 10 }} />}
        <TextInput
          style={[fieldStyles(theme).input, { color: editable ? theme.text : theme.icon }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ?? label}
          placeholderTextColor={theme.icon}
          keyboardType={keyboardType}
          editable={editable}
          selectionColor={theme.primary}
        />
        {!editable && <Ionicons name="lock-closed-outline" size={14} color={theme.icon} />}
      </View>
    </View>
  );
}

const fieldStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    wrap: { marginBottom: 16 },
    label: { fontSize: 12, fontWeight: "500", color: theme.icon, marginBottom: 8, paddingLeft: 2, textTransform: "uppercase", letterSpacing: 0.6 },
    inputRow: {
      flexDirection: "row", alignItems: "center",
      borderWidth: 1, borderRadius: 14,
      paddingHorizontal: 14, paddingVertical: 15,
    },
    input: { flex: 1, fontSize: 15, fontWeight: "300" },
  });

export default function PersonalInfoScreen() {
  const theme = useTheme();
  const { user, updateUser } = useSessionStore();

  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [gender, setGender] = useState<string>(user?.gender ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const data = await api.put<any>("/auth/me", { displayName, phone, gender });
      updateUser({ displayName: data.displayName, phone: data.phone, gender: data.gender });
      toast.success("Profile updated");
    } catch (err: any) {
      toast.error("Update failed", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const s = styles(theme);

  const initials = (user?.displayName ?? "G")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle={theme.mode === "dark" ? "light-content" : "dark-content"} />

      <View style={s.header}>
        <BackButton />
        <Text style={s.headerTitle}>Personal Info</Text>
        <TouchableOpacity onPress={save} disabled={saving} style={s.saveBtn} activeOpacity={0.7}>
          {saving ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Text style={[s.saveBtnText, { color: theme.primary }]}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Avatar section */}
        <View style={s.avatarSection}>
          <View style={[s.avatarWrap, { backgroundColor: theme.tertiary, borderColor: theme.primary + "33" }]}>
            <Avatar
              uri={user?.profileImage}
              initials={initials}
              size={72}
              radius={20}
            />
          </View>
          <Text style={[s.avatarName, { color: theme.text }]}>{user?.displayName ?? "Guest"}</Text>
          <Text style={[s.avatarEmail, { color: theme.icon }]}>{user?.email ?? ""}</Text>
        </View>

        {/* Form */}
        <View style={[s.formCard, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
          <Field label="Full Name" value={displayName} onChangeText={setDisplayName} placeholder="Your full name" icon="person-outline" />
          <Field label="Phone Number" value={phone} onChangeText={setPhone} placeholder="+234..." keyboardType="phone-pad" icon="call-outline" />
          <Field label="Email" value={user?.email ?? ""} editable={false} icon="mail-outline" />
        </View>

        {/* Gender */}
        <View style={[s.formCard, { backgroundColor: theme.surface, borderColor: theme.ash }]}>
          <Text style={[s.fieldGroupLabel, { color: theme.icon }]}>Gender</Text>
          <View style={s.genderRow}>
            {GENDER_OPTIONS.map((opt) => {
              const active = gender === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[
                    s.genderChip,
                    {
                      backgroundColor: active ? theme.tertiary : theme.background,
                      borderColor: active ? theme.primary : theme.ash,
                      flex: 1,
                    },
                  ]}
                  onPress={() => setGender(opt)}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={opt === "male" ? "male-outline" : "female-outline"}
                    size={16}
                    color={active ? theme.primary : theme.icon}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[s.genderChipText, { color: active ? theme.primary : theme.icon }]}>
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[s.saveFullBtn, { backgroundColor: theme.primary }]}
          onPress={save}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={s.saveFullBtnText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 16, paddingVertical: 12,
    },
    headerTitle: { fontSize: 17, fontWeight: "500", color: theme.text },
    saveBtn: { minWidth: 44, alignItems: "flex-end", justifyContent: "center", height: 36 },
    saveBtnText: { fontSize: 15, fontWeight: "500" },
    scroll: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 },

    // Avatar
    avatarSection: { alignItems: "center", paddingVertical: 24, gap: 6 },
    avatarWrap: {
      width: 80, height: 80, borderRadius: 24,
      justifyContent: "center", alignItems: "center",
      borderWidth: 2, marginBottom: 4,
    },
    avatarImg: { width: "100%", height: "100%", borderRadius: 22 },
    avatarInitials: { fontSize: 28, fontWeight: "600" },
    avatarName: { fontSize: 18, fontWeight: "500" },
    avatarEmail: { fontSize: 13, fontWeight: "300" },

    // Form cards
    formCard: {
      borderRadius: 18, borderWidth: 1,
      padding: 16, marginBottom: 14,
    },
    fieldGroupLabel: {
      fontSize: 11, fontWeight: "600", textTransform: "uppercase",
      letterSpacing: 0.7, marginBottom: 14,
    },

    // Gender
    genderRow: { flexDirection: "row", gap: 10 },
    genderChip: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      paddingVertical: 12, borderRadius: 12, borderWidth: 1,
    },
    genderChipText: { fontSize: 14, fontWeight: "400" },

    // Save full
    saveFullBtn: {
      paddingVertical: 16, borderRadius: 16, alignItems: "center",
      marginTop: 4,
    },
    saveFullBtnText: { color: "#fff", fontSize: 15, fontWeight: "500" },
  });
