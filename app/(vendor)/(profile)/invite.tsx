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
import { useVendorStationStore } from "@/store/useVendorStationStore";

interface InviteApiResponse {
  invite: {
    _id: string;
    phone: string;
    token: string;
    status: string;
    station: string;
  };
  inviteUrl: string;
}

export default function VendorInviteRiderScreen() {
  const router = useRouter();
  const theme = useTheme();
  const stations = useVendorStationStore((s) => s.stations);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  // Default to the first station so a single-station vendor doesn't
  // have to interact with the picker.
  const [stationId, setStationId] = useState<string | null>(
    stations[0]?.id ?? null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<InviteApiResponse | null>(null);

  const styles = useMemo(() => makeStyles(theme), [theme]);

  // Keep stationId in sync if stations hydrate after mount.
  React.useEffect(() => {
    if (!stationId && stations[0]) setStationId(stations[0].id);
  }, [stations, stationId]);

  const canSubmit = useMemo(() => {
    if (!stationId) return false;
    const cleaned = phone.replace(/\s+/g, "");
    return /^\+?\d{10,15}$/.test(cleaned);
  }, [phone, stationId]);

  const handleInvite = useCallback(async () => {
    if (!canSubmit || !stationId) return;
    setSubmitting(true);
    try {
      const res = await api.post<InviteApiResponse>(
        "/api/vendor/riders/invite",
        {
          phone: phone.trim(),
          displayName: name.trim() || undefined,
          stationId,
        },
      );
      setResult(res);
      toast.success("Invite created");
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't create invite");
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, phone, name, stationId]);

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
    <VendorScreenShell title="Invite rider" hideStationSwitcher>
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
              <Text style={styles.cardLabel}>Assign to station</Text>
              {stations.length === 0 ? (
                <Text style={styles.helperText}>
                  Add a station first to assign a rider.
                </Text>
              ) : (
                <View style={styles.stationList}>
                  {stations.map((s) => {
                    const picked = s.id === stationId;
                    return (
                      <Pressable
                        key={s.id}
                        onPress={() => setStationId(s.id)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: picked }}
                        accessibilityLabel={`Assign to ${s.name}`}
                        style={({ pressed }) => [
                          styles.stationRow,
                          picked && styles.stationRowActive,
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <View
                          style={[
                            styles.radio,
                            picked && styles.radioActive,
                          ]}
                        >
                          {picked ? <View style={styles.radioDot} /> : null}
                        </View>
                        <Text
                          style={styles.stationName}
                          numberOfLines={1}
                        >
                          {s.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
              <Text style={styles.helperFooter}>
                Riders are bound to one station. You can reassign later from the
                rider's profile.
              </Text>
            </VendorCard>

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
    stationList: {
      gap: 8,
    },
    stationRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: theme.radius.md,
      backgroundColor: theme.bg,
      borderWidth: 1,
      borderColor: theme.divider,
    },
    stationRowActive: {
      borderColor: theme.primary,
      backgroundColor: theme.primaryTint,
    },
    radio: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
    },
    radioActive: {
      borderColor: theme.primary,
    },
    radioDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.primary,
    },
    stationName: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
      flexShrink: 1,
    },
    helperText: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    helperFooter: {
      ...theme.type.caption,
      color: theme.fgMuted,
      marginTop: 10,
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
