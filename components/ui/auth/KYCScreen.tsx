import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { toast } from "sonner-native";
import { Theme, useTheme } from "@/constants/theme";
import { AuthScreenContainer } from "@/components/ui/auth";
import { Button } from "@/components/ui/primitives";
import { api } from "@/lib/api";

/**
 * Per-doc slot definition. Used by both VendorKYCScreen and RiderKYCScreen.
 */
export interface KYCDoc {
  /** Stable identifier. Sent to the server as the document kind. */
  id: string;
  label: string;
  /** Short reminder ("NIN slip or card"). */
  sub: string;
  /** One-line hint about what makes a good photo. */
  hint: string;
}

interface SlotState {
  status: "empty" | "uploading" | "uploaded";
  url?: string;
}

interface Props {
  role: "vendor" | "rider";
  docs: KYCDoc[];
  /** Headline + sub override; defaults read role-aware copy. */
  title?: string;
  sub?: string;
}

/**
 * Shared KYC upload screen — slot grid with per-doc upload, progress
 * bar across the top, submit-for-review button gated on all-uploaded.
 *
 * Submits the docs as a `documents` array on User.vendorVerification /
 * User.verificationDocs via the existing /auth/verification/submit
 * endpoint (server already has it). Uploads use /api/upload/image.
 */
export default function KYCScreen({ role, docs, title, sub }: Props) {
  const router = useRouter();
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [slots, setSlots] = useState<Record<string, SlotState>>({});
  const [submitting, setSubmitting] = useState(false);

  const done = useMemo(
    () =>
      Object.values(slots).filter((s) => s?.status === "uploaded").length,
    [slots],
  );
  const allDone = done === docs.length;
  const pct = docs.length ? Math.round((done / docs.length) * 100) : 0;

  const pickAndUpload = useCallback(
    async (docId: string) => {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast.error("Photo library access denied");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.85,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.uri) return;

      setSlots((s) => ({ ...s, [docId]: { status: "uploading" } }));
      try {
        const filename =
          asset.fileName ??
          asset.uri.split("/").pop() ??
          `${docId}-${Date.now()}.jpg`;
        const type = asset.mimeType ?? "image/jpeg";
        const form = new FormData();
        form.append("image", {
          uri: asset.uri,
          name: filename,
          type,
        } as any);
        const data = await api.uploadForm<{ url?: string }>(
          "/api/upload/image",
          form,
          "POST",
        );
        if (!data.url) throw new Error("No URL returned");
        setSlots((s) => ({
          ...s,
          [docId]: { status: "uploaded", url: data.url },
        }));
      } catch (err: any) {
        setSlots((s) => ({ ...s, [docId]: { status: "empty" } }));
        toast.error(err?.message ?? "Couldn't upload document");
      }
    },
    [],
  );

  const handleSubmit = useCallback(async () => {
    if (!allDone || submitting) return;
    setSubmitting(true);
    try {
      const documents = docs
        .map((d) => {
          const s = slots[d.id];
          if (!s?.url) return null;
          return { kind: d.id, url: s.url };
        })
        .filter(Boolean);
      await api.patch("/auth/verification", { documents });
      router.replace({
        pathname:
          role === "vendor"
            ? ("/(auth)/verification/pending" as never)
            : ("/(auth)/verification/pending" as never),
        params: { role, submitted: "true" },
      } as never);
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't submit for review");
      setSubmitting(false);
    }
  }, [allDone, submitting, docs, slots, role, router]);

  return (
    <AuthScreenContainer
      contentStyle={{ paddingTop: 0, paddingHorizontal: 0 }}
      footer={
        <Button
          variant="primary"
          size="lg"
          full
          onPress={handleSubmit}
          loading={submitting}
          disabled={!allDone || submitting}
          accessibilityLabel="Submit for review"
        >
          {submitting
            ? "Submitting…"
            : allDone
              ? "Submit for review"
              : `${docs.length - done} doc${docs.length - done === 1 ? "" : "s"} remaining`}
        </Button>
      }
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={6}
          style={({ pressed }) => [
            styles.backBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons name="chevron-back" size={22} color={theme.fg} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>
            {done} of {docs.length} ready
          </Text>
          <Text style={styles.title}>{title ?? "Verify your account"}</Text>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[styles.progressFill, { width: `${pct}%` }]}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sub}>
          {sub ??
            (role === "vendor"
              ? "Gaznger compliance checks these before approving your station."
              : "Gaznger compliance checks these before approving you to ride.")}
        </Text>

        <View style={styles.list}>
          {docs.map((d) => (
            <DocSlotView
              key={d.id}
              doc={d}
              state={slots[d.id] ?? { status: "empty" }}
              onPick={() => pickAndUpload(d.id)}
              theme={theme}
              styles={styles}
            />
          ))}
        </View>

        <View style={styles.privacyNote}>
          <Ionicons name="shield-checkmark" size={18} color={theme.primary} />
          <Text style={styles.privacyText}>
            Documents are stored encrypted and used only for identity
            verification. We don't share them with vendors or riders.
          </Text>
        </View>
      </ScrollView>
    </AuthScreenContainer>
  );
}

function DocSlotView({
  doc,
  state,
  onPick,
  theme,
  styles,
}: {
  doc: KYCDoc;
  state: SlotState;
  onPick: () => void;
  theme: Theme;
  styles: ReturnType<typeof makeStyles>;
}) {
  const isUp = state.status === "uploaded";
  const isProg = state.status === "uploading";

  const tintBg = isUp
    ? theme.successTint
    : isProg
      ? theme.infoTint
      : theme.surface;
  const borderColor = isUp
    ? theme.success + "55"
    : isProg
      ? theme.info + "55"
      : theme.divider;

  return (
    <Pressable
      onPress={onPick}
      disabled={isProg}
      accessibilityRole="button"
      accessibilityLabel={
        isUp
          ? `${doc.label} uploaded. Tap to replace.`
          : isProg
            ? `${doc.label} uploading`
            : `Upload ${doc.label}`
      }
      style={({ pressed }) => [
        styles.slot,
        { backgroundColor: tintBg, borderColor },
        pressed && { opacity: 0.94 },
      ]}
    >
      <View style={styles.thumbWrap}>
        {isUp && state.url ? (
          <Image
            source={{ uri: state.url }}
            style={styles.thumbImage}
            contentFit="cover"
          />
        ) : isProg ? (
          <View style={styles.thumbProg}>
            <ActivityIndicator size="small" color={theme.info} />
          </View>
        ) : (
          <View style={styles.thumbEmpty}>
            <Ionicons name="add" size={22} color={theme.fgMuted} />
          </View>
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.docLabel}>{doc.label}</Text>
        <Text style={styles.docSub}>
          {isUp ? `Uploaded · ${doc.sub}` : isProg ? "Uploading…" : doc.sub}
        </Text>
        {!isUp && !isProg ? (
          <Text style={styles.docHint}>{doc.hint}</Text>
        ) : null}
      </View>
      {isUp ? (
        <View style={[styles.pill, { backgroundColor: theme.success }]}>
          <Text style={[styles.pillText, { color: "#fff" }]}>Done</Text>
        </View>
      ) : isProg ? (
        <View style={[styles.pill, { backgroundColor: theme.info }]}>
          <Text style={[styles.pillText, { color: "#fff" }]}>Uploading</Text>
        </View>
      ) : (
        <View style={styles.uploadCTA}>
          <Ionicons name="add" size={12} color={theme.primary} />
          <Text style={styles.uploadCTAText}>Upload</Text>
        </View>
      )}
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.bgMuted,
    },
    eyebrow: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: theme.fgMuted,
    },
    title: {
      ...theme.type.h1,
      color: theme.fg,
      fontWeight: "800",
      letterSpacing: -0.3,
      fontSize: 20,
    },
    sub: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 10,
      lineHeight: 20,
    },
    progressTrack: {
      height: 8,
      borderRadius: 999,
      backgroundColor: theme.divider,
      marginHorizontal: 16,
      marginTop: 12,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      backgroundColor: theme.primary,
      borderRadius: 999,
    },
    scroll: {
      paddingHorizontal: 16,
      paddingBottom: 140,
    },
    list: {
      gap: 10,
    },
    slot: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      borderRadius: 16,
      borderWidth: 1,
    },
    thumbWrap: {
      width: 56,
      height: 72,
      borderRadius: 10,
      overflow: "hidden",
      backgroundColor: theme.bgMuted,
    },
    thumbEmpty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.divider,
      borderStyle: "dashed",
    },
    thumbProg: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    thumbImage: {
      width: "100%",
      height: "100%",
    },
    docLabel: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "800",
    },
    docSub: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      marginTop: 2,
    },
    docHint: {
      fontSize: 11,
      color: theme.fgMuted,
      marginTop: 2,
      opacity: 0.85,
    },
    pill: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
    },
    pillText: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.2,
    },
    uploadCTA: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.primary,
    },
    uploadCTAText: {
      fontSize: 11.5,
      fontWeight: "800",
      color: theme.primary,
    },
    privacyNote: {
      marginTop: 18,
      padding: 14,
      borderRadius: 14,
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.divider,
      flexDirection: "row",
      gap: 12,
      alignItems: "flex-start",
    },
    privacyText: {
      flex: 1,
      ...theme.type.bodySm,
      color: theme.fgMuted,
      lineHeight: 20,
    },
  });
