import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { toast } from "sonner-native";
import { Theme, useTheme } from "@/constants/theme";
import { api } from "@/lib/api";
import { useSessionStore } from "@/store/useSessionStore";
import { pickAndUploadProfileImage } from "@/lib/uploadProfileImage";
import {
  FloatingCTA,
  ScreenContainer,
  ScreenHeader,
  Skeleton,
} from "@/components/ui/primitives";

/**
 * Personal info — v3.
 *
 * Edit name, phone, gender, profile photo. Email is read-only — change
 * requires the verify-email-again flow which we don't surface here.
 *
 * Save fires PUT /auth/me with only the dirty fields. The avatar tap
 * uploads to /api/upload/image first, then PUT /auth/me with the URL.
 *
 * Phone validation lives client-side (`/^\+?\d{10,14}$/`) since the
 * server's existing rule is permissive (>=10 chars).
 */

const GENDER_OPTIONS: Array<{
  value: "male" | "female";
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}> = [
  { value: "male", label: "Male", icon: "male-outline" },
  { value: "female", label: "Female", icon: "female-outline" },
];

const PHONE_REGEX = /^\+?\d{10,14}$/;

export default function PersonalInfoScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const { user, updateUser } = useSessionStore();

  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [gender, setGender] = useState<"male" | "female" | undefined>(
    (user?.gender as "male" | "female" | undefined) ?? undefined
  );
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const initials = (user?.displayName ?? "G")
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const dirty =
    displayName !== (user?.displayName ?? "") ||
    phone !== (user?.phone ?? "") ||
    gender !== ((user?.gender as "male" | "female" | undefined) ?? undefined);

  const phoneValid = !phone || PHONE_REGEX.test(phone);
  const nameValid = displayName.trim().length >= 2;
  const canSave = dirty && nameValid && phoneValid && !saving;

  const handleAvatarTap = useCallback(async () => {
    setUploadingAvatar(true);
    try {
      const url = await pickAndUploadProfileImage();
      if (!url) return; // user cancelled
      await api.put("/auth/me", { profileImage: url });
      updateUser({ profileImage: url });
      toast.success("Profile photo updated");
    } catch (err: any) {
      toast.error("Couldn't update photo", {
        description: err?.message ?? "Try again in a moment.",
      });
    } finally {
      setUploadingAvatar(false);
    }
  }, [updateUser]);

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      if (displayName !== (user?.displayName ?? ""))
        payload.displayName = displayName.trim();
      if (phone !== (user?.phone ?? "")) payload.phone = phone.trim();
      if (
        gender !== ((user?.gender as "male" | "female" | undefined) ?? undefined)
      )
        payload.gender = gender;

      const data = await api.put<{
        displayName?: string;
        phone?: string;
        gender?: "male" | "female";
      }>("/auth/me", payload);
      updateUser({
        displayName: data.displayName,
        phone: data.phone,
        gender: data.gender,
      });
      toast.success("Profile updated");
      router.back();
    } catch (err: any) {
      toast.error("Couldn't save", {
        description: err?.message ?? "Try again in a moment.",
      });
    } finally {
      setSaving(false);
    }
  }, [canSave, displayName, phone, gender, user, updateUser, router]);

  return (
    <ScreenContainer
      edges={["top", "bottom"]}
      header={
        <ScreenHeader title="Personal info" onBack={() => router.back()} />
      }
      footer={
        <FloatingCTA
          label={saving ? "Saving…" : "Save changes"}
          subtitle={!dirty ? "No changes yet" : undefined}
          disabled={!canSave}
          loading={saving}
          onPress={handleSave}
          floating={false}
        />
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          <Pressable
            onPress={handleAvatarTap}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            style={({ pressed }) => [pressed && { opacity: 0.85 }]}
          >
            <View style={styles.avatar}>
              {uploadingAvatar ? (
                <Skeleton width={88} height={88} borderRadius={44} />
              ) : user?.profileImage ? (
                <Image
                  source={{ uri: user.profileImage }}
                  style={styles.avatarImg}
                  accessibilityLabel="Profile photo"
                />
              ) : (
                <Text style={styles.avatarText}>{initials}</Text>
              )}
              <View style={styles.avatarBadge}>
                <Ionicons name="camera" size={14} color={theme.fg} />
              </View>
            </View>
          </Pressable>
          <Text style={styles.avatarHint}>Tap to change photo</Text>
        </View>

        {/* Identity */}
        <Text style={styles.sectionLabel}>IDENTITY</Text>
        <View style={styles.fieldGroup}>
          <Field
            label="Full name"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your full name"
            icon="person-outline"
            error={
              displayName.length > 0 && !nameValid
                ? "At least 2 characters"
                : undefined
            }
          />
          <Field
            label="Phone number"
            value={phone}
            onChangeText={setPhone}
            placeholder="+234..."
            keyboardType="phone-pad"
            icon="call-outline"
            error={!phoneValid ? "10–14 digits, optional + prefix" : undefined}
          />
          <Field
            label="Email"
            value={user?.email ?? ""}
            placeholder=""
            icon="mail-outline"
            editable={false}
            sub="To change your email, contact support."
          />
        </View>

        {/* Gender */}
        <Text style={styles.sectionLabel}>GENDER</Text>
        <View style={styles.genderRow}>
          {GENDER_OPTIONS.map((opt) => {
            const active = gender === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setGender(opt.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={opt.label}
                style={({ pressed }) => [
                  styles.genderCard,
                  active && styles.genderCardActive,
                  pressed && { opacity: 0.92 },
                ]}
              >
                <Ionicons
                  name={opt.icon}
                  size={20}
                  color={
                    active
                      ? theme.mode === "dark"
                        ? "#fff"
                        : theme.palette.green700
                      : theme.fg
                  }
                />
                <Text
                  style={[
                    styles.genderText,
                    active && styles.genderTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Soft warning when phone is changed — server may require re-OTP. */}
        {phone !== (user?.phone ?? "") && phoneValid ? (
          <View style={styles.tipCard}>
            <Ionicons
              name="information-circle"
              size={16}
              color={theme.info}
            />
            <Text style={styles.tipText}>
              Changing your phone number doesn't trigger a re-verification yet.
              Make sure it's reachable — riders use it for delivery questions.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

/* ─────────────────────── Field primitive ─────────────────────── */

interface FieldProps {
  label: string;
  value: string;
  onChangeText?: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
  editable?: boolean;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  sub?: string;
  error?: string;
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  editable = true,
  icon,
  sub,
  error,
}: FieldProps) {
  const theme = useTheme();
  const styles = useMemo(() => fieldStyles(theme), [theme]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputRow,
          !editable && styles.inputRowReadOnly,
          error && styles.inputRowError,
        ]}
      >
        <Ionicons
          name={icon}
          size={16}
          color={editable ? theme.fgMuted : theme.fgSubtle}
        />
        <TextInput
          style={[
            styles.input,
            !editable && { color: theme.fgMuted },
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.fgSubtle}
          keyboardType={keyboardType}
          editable={editable}
          selectionColor={theme.primary}
          autoCapitalize={keyboardType === "phone-pad" ? "none" : "words"}
          autoCorrect={false}
        />
        {!editable ? (
          <Ionicons
            name="lock-closed-outline"
            size={14}
            color={theme.fgSubtle}
          />
        ) : null}
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : sub ? (
        <Text style={styles.subText}>{sub}</Text>
      ) : null}
    </View>
  );
}

const fieldStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: { gap: 6 },
    label: {
      ...theme.type.caption,
      color: theme.fgMuted,
      letterSpacing: 0.4,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 14,
      height: 50,
      borderRadius: 12,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    inputRowReadOnly: {
      backgroundColor: theme.bgMuted,
      borderColor: theme.divider,
    },
    inputRowError: {
      borderColor: theme.error,
    },
    input: {
      flex: 1,
      ...theme.type.body,
      color: theme.fg,
      paddingVertical: 0,
    },
    subText: {
      ...theme.type.caption,
      color: theme.fgMuted,
      paddingLeft: 2,
    },
    errorText: {
      ...theme.type.caption,
      color: theme.error,
      paddingLeft: 2,
    },
  });

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    scroll: {
      paddingHorizontal: theme.space.s4,
      paddingTop: theme.space.s2,
      paddingBottom: theme.space.s5,
    },

    avatarWrap: {
      alignItems: "center",
      marginBottom: theme.space.s4,
    },
    avatar: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: theme.primaryTint,
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    },
    avatarText: {
      ...theme.type.h1,
      fontSize: 28,
      color: theme.mode === "dark" ? "#fff" : theme.palette.green700,
      fontWeight: "800",
    },
    avatarImg: {
      width: 88,
      height: 88,
      borderRadius: 44,
    },
    avatarBadge: {
      position: "absolute",
      bottom: -2,
      right: -2,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.surface,
      borderWidth: 2,
      borderColor: theme.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarHint: {
      ...theme.type.caption,
      color: theme.fgMuted,
      marginTop: 8,
    },

    sectionLabel: {
      ...theme.type.micro,
      color: theme.fgMuted,
      letterSpacing: 0.5,
      paddingTop: theme.space.s4,
      paddingBottom: theme.space.s2,
    },
    fieldGroup: {
      gap: theme.space.s3,
    },

    genderRow: {
      flexDirection: "row",
      gap: theme.space.s2,
    },
    genderCard: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      height: 52,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    genderCardActive: {
      backgroundColor: theme.primaryTint,
      borderColor: theme.primary,
    },
    genderText: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
    },
    genderTextActive: {
      color: theme.mode === "dark" ? "#fff" : theme.palette.green700,
    },

    tipCard: {
      flexDirection: "row",
      gap: 10,
      marginTop: theme.space.s4,
      padding: 14,
      borderRadius: theme.radius.md,
      backgroundColor: theme.infoTint,
    },
    tipText: {
      flex: 1,
      ...theme.type.caption,
      color: theme.fg,
      lineHeight: 17,
    },
  });
