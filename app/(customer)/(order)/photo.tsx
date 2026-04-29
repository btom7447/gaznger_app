import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { toast } from "sonner-native";
import { Theme, useTheme } from "@/constants/theme";
import { useOrderStore } from "@/store/useOrderStore";
import { useSessionStore } from "@/store/useSessionStore";
import { api } from "@/lib/api";
import {
  FloatingCTA,
  ProgressDots,
  ScreenContainer,
  ScreenHeader,
} from "@/components/ui/primitives";
import { useFlowProgress } from "@/components/ui/customer/order/useFlowProgress";
import PhotoPickSheet, {
  PhotoPickSheetRef,
  PhotoSource,
} from "@/components/ui/customer/order/PhotoPickSheet";

type SlotKey = "whole" | "valve";

interface SlotMeta {
  key: SlotKey;
  title: string;
  sub: string;
}

const SLOTS: SlotMeta[] = [
  {
    key: "whole",
    title: "Whole cylinder",
    sub: "Stand it upright, full body in frame",
  },
  {
    key: "valve",
    title: "Valve close-up",
    sub: "Top of cylinder, focus on threads",
  },
];

/**
 * LPG-swap step 3 — two photos. The actual upload pipeline (Cloudinary)
 * stays out of scope for this slice; we capture URIs and persist them.
 *
 * Skip option appears for users with 5+ completed LPG orders — gated by
 * a flag we'll wire when /api/users/me returns lpgOrderCount.
 */
export default function PhotoScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const { step, total } = useFlowProgress("photo");
  const setCylinderPhotos = useOrderStore((s) => s.setCylinderPhotos);
  // Stable selector — return undefined when empty so Zustand's Object.is
  // equality short-circuits identical states. Returning `?? []` would yield
  // a new array reference every render and trigger an infinite re-render
  // loop (Maximum update depth exceeded).
  const existing = useOrderStore((s) => s.order.cylinderPhotos);

  const [photos, setPhotos] = useState<Record<SlotKey, string | null>>({
    whole: existing?.[0] ?? null,
    valve: existing?.[1] ?? null,
  });

  // Track which slot the user is filling so the sheet's source pick knows
  // where to write back.
  const pendingSlotRef = useRef<SlotKey | null>(null);
  const sheetRef = useRef<PhotoPickSheetRef>(null);

  const writePhoto = useCallback(
    (key: SlotKey, uri: string) => {
      setPhotos((prev) => {
        const next = { ...prev, [key]: uri };
        setCylinderPhotos(
          [next.whole, next.valve].filter(Boolean) as string[]
        );
        return next;
      });
    },
    [setCylinderPhotos]
  );

  const launchSource = useCallback(
    async (source: PhotoSource) => {
      const key = pendingSlotRef.current;
      if (!key) return;

      // Close the picker sheet first, then wait for its dismiss animation
      // to finish before launching the native picker. iOS otherwise races
      // the modal-presenter and the picker dismisses itself immediately
      // ("photo upload not selecting").
      sheetRef.current?.close();
      await new Promise((r) => setTimeout(r, 350));

      try {
        // MediaType array form — the older MediaTypeOptions enum is
        // deprecated in expo-image-picker v17+.
        const opts: ImagePicker.ImagePickerOptions = {
          mediaTypes: ["images"],
          quality: 0.85,
          allowsEditing: false,
        };

        let result: ImagePicker.ImagePickerResult;
        if (source === "camera") {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) return;
          result = await ImagePicker.launchCameraAsync(opts);
        } else {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) return;
          result = await ImagePicker.launchImageLibraryAsync(opts);
        }

        if (result.canceled || !result.assets?.[0]?.uri) return;
        writePhoto(key, result.assets[0].uri);
      } catch {
        // Pick error (rare — e.g., iOS asset library can't render a
        // representation type). Best-effort; user can try again.
      }
    },
    [writePhoto]
  );

  const handlePick = useCallback((key: SlotKey) => {
    pendingSlotRef.current = key;
    sheetRef.current?.open();
  }, []);

  // Real saved-cylinder flag — gated on /auth/me lpgOrderCount.
  const lpgOrderCount = useSessionStore((s) => s.user?.lpgOrderCount ?? 0);
  const savedCylinder = useSessionStore((s) => s.user?.savedCylinder);
  const hasSavedCylinder =
    !!savedCylinder?.photos && lpgOrderCount > 0 && savedCylinder.photos.length >= 2;

  const both = !!(photos.whole && photos.valve);

  const [uploading, setUploading] = useState(false);

  /**
   * Upload a single local URI to Cloudinary via the server's
   * /api/upload/image endpoint. Returns the secure_url. Server rejects
   * anything but JPEG/PNG/WebP and >5MB, so we trust those checks.
   */
  const uploadOne = useCallback(async (uri: string): Promise<string> => {
    // RN-safe FormData — `uri` is the file:// path, name + type are
    // required for multer to parse it.
    const filename = uri.split("/").pop() ?? "cylinder.jpg";
    const ext = filename.split(".").pop()?.toLowerCase();
    const mime =
      ext === "png"
        ? "image/png"
        : ext === "webp"
        ? "image/webp"
        : "image/jpeg";

    const form = new FormData();
    // RN's FormData accepts the { uri, name, type } object form.
    form.append("image", {
      uri,
      name: filename,
      type: mime,
    } as unknown as Blob);

    const data = await api.uploadForm<{ url: string }>(
      "/api/upload/image",
      form,
      "POST"
    );
    return data.url;
  }, []);

  const handleContinue = useCallback(async () => {
    if (!both) return;
    if (!photos.whole || !photos.valve) return;

    // If both URIs are already remote (https), skip the upload — happens
    // when the user goes back and forward between Photo and Delivery.
    const isRemote = (u: string) => u.startsWith("http");
    if (isRemote(photos.whole) && isRemote(photos.valve)) {
      router.push("/(customer)/(order)/delivery" as never);
      return;
    }

    setUploading(true);
    try {
      const [wholeUrl, valveUrl] = await Promise.all([
        isRemote(photos.whole) ? photos.whole : uploadOne(photos.whole),
        isRemote(photos.valve) ? photos.valve : uploadOne(photos.valve),
      ]);
      // Replace the local URIs with the Cloudinary URLs so the order
      // POST sends server-resolvable refs.
      setPhotos({ whole: wholeUrl, valve: valveUrl });
      setCylinderPhotos([wholeUrl, valveUrl]);
      router.push("/(customer)/(order)/delivery" as never);
    } catch (err: any) {
      toast.error("Couldn't upload photos", {
        description: err?.message ?? "Check your connection and try again.",
      });
    } finally {
      setUploading(false);
    }
  }, [both, photos.whole, photos.valve, uploadOne, setCylinderPhotos, router]);

  return (
    <ScreenContainer
      edges={["top", "bottom"]}
      contentStyle={styles.scroll}
      header={<ScreenHeader title="Show us your cylinder" />}
      footer={
        <FloatingCTA
          label="Continue · delivery"
          disabled={!both}
          loading={uploading}
          onPress={handleContinue}
          floating={false}
          accessibilityHint={
            uploading ? "Uploading your photos…" : undefined
          }
        />
      }
    >
      <View style={styles.body}>
        <ProgressDots step={step} total={total} variant="bars" />

        <Text style={styles.lead}>
          Two photos. Helps the rider bring the right valve and protects you
          if it's damaged on arrival.
        </Text>

        <View style={styles.slotsRow}>
          {SLOTS.map((slot) => {
            const uri = photos[slot.key];
            const filled = !!uri;
            return (
              <Pressable
                key={slot.key}
                onPress={() => handlePick(slot.key)}
                accessibilityRole="button"
                accessibilityLabel={`${filled ? "Replace" : "Add"} ${slot.title} photo. ${slot.sub}.`}
                style={({ pressed }) => [
                  styles.slot,
                  filled && styles.slotFilled,
                  pressed && { opacity: 0.92 },
                ]}
              >
                {filled ? (
                  <>
                    <Image
                      source={{ uri: uri as string }}
                      style={styles.slotImage}
                      resizeMode="cover"
                    />
                    <View style={styles.slotCheck}>
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    </View>
                    <Text style={styles.slotLabelOnImage}>{slot.title}</Text>
                  </>
                ) : (
                  <>
                    <View style={styles.addCircle}>
                      <Ionicons name="add" size={20} color="#fff" />
                    </View>
                    <Text style={styles.slotTitle}>{slot.title}</Text>
                    <Text style={styles.slotSub}>{slot.sub}</Text>
                  </>
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.tipCard}>
          <Ionicons
            name="help-circle-outline"
            size={18}
            color={theme.info}
          />
          <View style={styles.tipBody}>
            <Text style={styles.tipTitle}>Why we need this</Text>
            <Text style={styles.tipText}>
              Cylinders {">"} 10 years or with rust around the valve can't be
              refilled by law. We catch it before the rider rolls out, so your
              trip isn't wasted.
            </Text>
          </View>
        </View>

        {/*
         * Skip option only renders when the user has previously saved a
         * cylinder profile (= they've completed an LPG swap and confirmed
         * the "save cylinder" prompt). First-time users see the photo
         * slots only.
         */}
        {hasSavedCylinder ? (
          <View style={styles.skipRow}>
            <Text style={styles.skipText}>Used Gaznger before? </Text>
            <Pressable
              onPress={handleContinue}
              accessibilityRole="button"
              accessibilityLabel="Skip photo upload. Use photos from last LPG order."
              hitSlop={6}
            >
              <Text style={styles.skipLink}>Skip — use last photos</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <PhotoPickSheet
        ref={sheetRef}
        title="Add cylinder photo"
        onPick={launchSource}
      />
    </ScreenContainer>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    scroll: { paddingBottom: theme.space.s5 },
    body: {
      paddingHorizontal: theme.space.s4,
      gap: theme.space.s4,
      paddingTop: theme.space.s2,
    },
    lead: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    slotsRow: {
      flexDirection: "row",
      gap: theme.space.s3,
    },
    slot: {
      flex: 1,
      aspectRatio: 4 / 5,
      borderRadius: theme.radius.lg,
      borderWidth: 1.5,
      borderColor: theme.borderStrong,
      borderStyle: "dashed",
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.s2,
      padding: theme.space.s3,
      overflow: "hidden",
    },
    slotFilled: {
      borderStyle: "solid",
      borderColor: theme.success,
    },
    slotImage: {
      ...StyleSheet.absoluteFillObject,
    },
    slotCheck: {
      position: "absolute",
      top: 8,
      right: 8,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.success,
      alignItems: "center",
      justifyContent: "center",
    },
    slotLabelOnImage: {
      position: "absolute",
      bottom: 10,
      left: 10,
      ...theme.type.caption,
      color: "#fff",
      fontWeight: "800",
    },
    addCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    slotTitle: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "800",
      textAlign: "center",
    },
    slotSub: {
      ...theme.type.caption,
      color: theme.fgMuted,
      textAlign: "center",
    },
    tipCard: {
      flexDirection: "row",
      gap: theme.space.s3,
      backgroundColor: theme.infoTint,
      borderRadius: theme.radius.md,
      padding: theme.space.s3,
    },
    tipBody: { flex: 1, gap: 2 },
    tipTitle: {
      ...theme.type.body,
      color: theme.info,
      fontWeight: "800",
    },
    tipText: {
      ...theme.type.bodySm,
      color: theme.fg,
    },
    skipRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      flexWrap: "wrap",
    },
    skipText: {
      ...theme.type.caption,
      color: theme.fgMuted,
    },
    skipLink: {
      ...theme.type.caption,
      color: theme.primary,
      fontWeight: "800",
    },
  });
