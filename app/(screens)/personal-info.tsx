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
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { toast } from "sonner-native";
import { useSessionStore } from "@/store/useSessionStore";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";
import BackButton from "@/components/ui/global/BackButton";

const GENDER_OPTIONS = ["male", "female", "prefer not to say"] as const;

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText?: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
  editable?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={fieldStyles(theme).wrap}>
      <Text style={fieldStyles(theme).label}>{label}</Text>
      <TextInput
        style={fieldStyles(theme).input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor={theme.icon}
        keyboardType={keyboardType}
        editable={editable}
        selectionColor={theme.primary}
      />
    </View>
  );
}

const fieldStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    wrap: { marginBottom: 16 },
    label: { fontSize: 12, fontWeight: "400", color: theme.icon, marginBottom: 6, paddingLeft: 2 },
    input: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.ash,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 15,
      fontWeight: "300",
      color: theme.text,
    },
  });

export default function PersonalInfoScreen() {
  const theme = useTheme();
  const { user, updateUser } = useSessionStore();

  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [gender, setGender] = useState<string>(user?.gender ?? "");
  const [birthday, setBirthday] = useState("");
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

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle={theme.mode === "dark" ? "light-content" : "dark-content"} />

      <View style={s.header}>
        <BackButton />
        <Text style={s.headerTitle}>Personal Info</Text>
        <TouchableOpacity onPress={save} disabled={saving} style={s.saveBtn}>
          {saving ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Text style={[s.saveBtnText, { color: theme.primary }]}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Field label="Full Name" value={displayName} onChangeText={setDisplayName} placeholder="Your full name" />
        <Field label="Phone Number" value={phone} onChangeText={setPhone} placeholder="+234..." keyboardType="phone-pad" />
        <Field label="Email" value={user?.email ?? ""} editable={false} />
        <Field label="Birthday" value={birthday} onChangeText={setBirthday} placeholder="DD / MM / YYYY" />

        {/* Gender picker */}
        <View style={{ marginBottom: 16 }}>
          <Text style={[s.genderLabel, { color: theme.icon }]}>Gender</Text>
          <View style={s.genderRow}>
            {GENDER_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[
                  s.genderChip,
                  {
                    backgroundColor: gender === opt ? theme.tertiary : theme.surface,
                    borderColor: gender === opt ? theme.primary : theme.ash,
                  },
                ]}
                onPress={() => setGender(opt)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    s.genderChipText,
                    { color: gender === opt ? theme.primary : theme.icon },
                  ]}
                >
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
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
    saveBtn: { minWidth: 44, alignItems: "flex-end" },
    saveBtnText: { fontSize: 15, fontWeight: "500" },
    scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
    genderLabel: { fontSize: 12, fontWeight: "400", marginBottom: 10, paddingLeft: 2 },
    genderRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    genderChip: {
      paddingHorizontal: 18, paddingVertical: 10,
      borderRadius: 20, borderWidth: 1,
    },
    genderChipText: { fontSize: 14, fontWeight: "400" },
  });
