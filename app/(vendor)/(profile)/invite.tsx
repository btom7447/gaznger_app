import React, { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { toast } from "sonner-native";
import {
  AlertChip,
  VendorCard,
  VendorScreenShell,
} from "@/components/ui/vendor";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";

interface InviteApiResponse {
  invite: {
    _id: string;
    phone: string;
    token: string;
    status: string;
  };
  inviteUrl: string;
}

export default function VendorInviteRiderScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<InviteApiResponse | null>(null);

  const styles = useMemo(() => makeStyles(theme), [theme]);

  const canSubmit = useMemo(() => {
    // Loose phone validation — server normalises + validates strictly.
    const cleaned = phone.replace(/\s+/g, "");
    return /^\+?\d{10,15}$/.test(cleaned);
  }, [phone]);

  const handleInvite = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await api.post<InviteApiResponse>(
        "/api/vendor/riders/invite",
        {
          phone: phone.trim(),
          displayName: name.trim() || undefined,
        },
      );
      setResult(res);
      toast.success("Invite created");
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't create invite");
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, phone, name]);

  const handleShare = useCallback(async () => {
    if (!result) return;
    try {
      await Share.share({
        message:
          `You've been invited to ride with us on Gaznger. ` +
          `Open this link to accept: ${result.inviteUrl}`,
      });
    } catch {
      toast.error("Couldn't share");
    }
  }, [result]);

  return (
    <VendorScreenShell title="Invite rider">
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
        <Text style={styles.backText}>Back to team</Text>
      </Pressable>

      <View style={styles.body}>
        {!result ? (
          <>
            <VendorCard>
              <Text style={styles.cardLabel}>Rider phone</Text>
              <TextInput
                style={styles.input}
                placeholder="+2348012345678"
                placeholderTextColor={theme.fgMuted}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                accessibilityLabel="Rider phone"
              />

              <Text style={[styles.cardLabel, { marginTop: 14 }]}>
                Name (optional)
              </Text>
              <TextInput
                style={styles.inputSm}
                placeholder="e.g. Tunde"
                placeholderTextColor={theme.fgMuted}
                value={name}
                onChangeText={setName}
                accessibilityLabel="Rider name"
              />
            </VendorCard>

            <AlertChip
              tone="info"
              icon="paper-plane"
              title="They'll get an invite link"
              sub="Once they tap it and sign up, you'll see them on Team."
            />

            <Pressable
              onPress={handleInvite}
              disabled={!canSubmit || submitting}
              accessibilityRole="button"
              accessibilityLabel="Send invite"
              style={({ pressed }) => [
                styles.primaryBtn,
                (!canSubmit || submitting) && { opacity: 0.5 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.primaryBtnText}>
                {submitting ? "Creating…" : "Send invite"}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <VendorCard tone="success">
              <View style={styles.successHeader}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={theme.success}
                />
                <Text style={styles.successTitle}>Invite ready</Text>
              </View>
              <Text style={styles.successSub}>
                Share this link with {result.invite.phone}. It expires in 7
                days.
              </Text>
              <View style={styles.urlBox}>
                <Text style={styles.urlText} numberOfLines={2}>
                  {result.inviteUrl}
                </Text>
              </View>
            </VendorCard>

            <Pressable
              onPress={handleShare}
              accessibilityRole="button"
              accessibilityLabel="Share invite link"
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Ionicons name="share-outline" size={18} color={theme.fgOnPrimary} />
              <Text style={styles.primaryBtnText}>Share link</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setResult(null);
                setPhone("");
                setName("");
              }}
              accessibilityRole="button"
              accessibilityLabel="Invite another"
              style={({ pressed }) => [
                styles.ghostBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.ghostBtnText}>Invite another</Text>
            </Pressable>
          </>
        )}
      </View>
    </VendorScreenShell>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    backRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 20,
      paddingTop: 4,
    },
    backText: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      fontWeight: "600",
    },
    body: {
      padding: 20,
      gap: 14,
    },
    cardLabel: {
      ...theme.type.caption,
      color: theme.fgMuted,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginBottom: 6,
    },
    input: {
      ...theme.type.h2,
      color: theme.fg,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: theme.radius.lg,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: theme.surface,
    },
    inputSm: {
      ...theme.type.body,
      color: theme.fg,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: theme.radius.lg,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: theme.surface,
    },
    primaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: theme.primary,
      paddingVertical: 14,
      borderRadius: theme.radius.pill,
    },
    primaryBtnText: {
      ...theme.type.body,
      color: theme.fgOnPrimary,
      fontWeight: "800",
    },
    ghostBtn: {
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 14,
      borderRadius: theme.radius.pill,
      alignItems: "center",
    },
    ghostBtnText: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
    },
    successHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 6,
    },
    successTitle: {
      ...theme.type.h2,
      color: theme.fg,
    },
    successSub: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      marginBottom: 10,
    },
    urlBox: {
      backgroundColor: theme.bg,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: theme.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    urlText: {
      ...theme.type.bodySm,
      color: theme.fg,
      fontFamily: "monospace",
    },
  });
