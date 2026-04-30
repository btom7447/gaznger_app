import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
  Row,
  ScreenContainer,
  ScreenHeader,
} from "@/components/ui/primitives";
import PickerSheet, {
  PickerOption,
  PickerSheetRef,
} from "@/components/ui/customer/order/PickerSheet";

/**
 * Saved cylinder — v3.
 *
 * Lets the customer view, edit, or clear the cylinder profile that
 * gets reused on the LPG-Swap order flow. The User model holds a
 * SINGLE cylinder (not a list), so this screen is "view + edit + clear"
 * rather than CRUD-list. Wiring:
 *
 *   GET  /auth/me              → savedCylinder hydrated into session store
 *   PUT  /auth/saved-cylinder  → save partial profile (each field optional)
 *   DELETE /auth/saved-cylinder → clear the whole profile
 *
 * The Settings row badge ("1 / 0") is driven by `savedCylinder.brand`.
 */
const BRAND_OPTIONS: PickerOption[] = [
  { id: "nigachem", label: "Nigachem", sub: "Most common in Lagos" },
  { id: "techno-oil", label: "Techno Oil", sub: "Common nationwide" },
  { id: "oando", label: "Oando", sub: "Verified partner brand" },
  { id: "nipco", label: "NIPCO", sub: "Common nationwide" },
  { id: "mrs", label: "MRS", sub: "Common nationwide" },
  { id: "asiko", label: "Asiko", sub: "Lagos and SW" },
  { id: "other", label: "Other", sub: "Manual entry on request" },
];
const VALVE_OPTIONS: PickerOption[] = [
  { id: "pol", label: "POL · standard threaded", sub: "Compatible with all riders" },
  { id: "acme", label: "ACME", sub: "Common on newer cylinders" },
  { id: "opd", label: "OPD", sub: "Auto shut-off, stricter fit" },
  { id: "unknown", label: "Don't know", sub: "We'll inspect on arrival" },
];
const AGE_OPTIONS: PickerOption[] = [
  { id: "lt-1", label: "< 1 year", sub: "Newly purchased" },
  { id: "1-2", label: "1–2 years", sub: "Lightly used" },
  { id: "3-5", label: "3–5 years", sub: "Test certificate not required yet" },
  { id: "6-10", label: "6–10 years", sub: "May require recertification soon" },
  { id: "gt-10", label: "> 10 years", sub: "Cannot be refilled by law" },
  { id: "unknown", label: "Don't know", sub: "We'll inspect on arrival" },
];
const TEST_OPTIONS: PickerOption[] = [
  { id: "lt-1y", label: "Within last year" },
  { id: "1-3y", label: "1–3 years ago" },
  { id: "gt-3y", label: "Over 3 years ago", sub: "Recertification recommended" },
  { id: "never", label: "Never tested" },
  { id: "unknown", label: "Don't know", sub: "We'll inspect on arrival" },
];

function labelFor(opts: PickerOption[], id?: string): string {
  if (!id) return "Pick";
  return opts.find((o) => o.id === id)?.label ?? id;
}

export default function SavedCylinderScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const user = useSessionStore((s) => s.user);
  const updateUser = useSessionStore((s) => s.updateUser);
  const saved = user?.savedCylinder;

  // Local mirror seeded from store. Edits stay local until Save fires.
  const [brand, setBrand] = useState<string | undefined>(saved?.brand);
  const [valve, setValve] = useState<string | undefined>(saved?.valve);
  const [age, setAge] = useState<string | undefined>(saved?.age);
  const [test, setTest] = useState<string | undefined>(saved?.test);
  // Photos are two labeled slots: index 0 = cylinder body, index 1 =
  // valve close-up. Empty string = empty slot. We store sparse so the
  // server's photos array stays semantic (slot N is always the same
  // angle) rather than relying on insertion order.
  const [bodyPhoto, setBodyPhoto] = useState<string>(
    saved?.photos?.[0] ?? ""
  );
  const [valvePhoto, setValvePhoto] = useState<string>(
    saved?.photos?.[1] ?? ""
  );
  const [photoBusySlot, setPhotoBusySlot] = useState<
    "body" | "valve" | null
  >(null);
  const [submitting, setSubmitting] = useState(false);

  const brandRef = useRef<PickerSheetRef>(null);
  const valveRef = useRef<PickerSheetRef>(null);
  const ageRef = useRef<PickerSheetRef>(null);
  const testRef = useRef<PickerSheetRef>(null);

  const hasAnyField =
    !!(brand || valve || age || test || bodyPhoto || valvePhoto);
  const savedBody = saved?.photos?.[0] ?? "";
  const savedValve = saved?.photos?.[1] ?? "";
  const photosDirty =
    bodyPhoto !== savedBody || valvePhoto !== savedValve;
  const dirty =
    brand !== saved?.brand ||
    valve !== saved?.valve ||
    age !== saved?.age ||
    test !== saved?.test ||
    photosDirty;

  /**
   * Pick + upload a photo for one of the two labeled slots. We persist
   * on the next Save tap so the user can retake before committing.
   */
  const setSlotPhoto = useCallback(
    async (slot: "body" | "valve") => {
      setPhotoBusySlot(slot);
      try {
        const url = await pickAndUploadProfileImage();
        if (!url) return;
        if (slot === "body") setBodyPhoto(url);
        else setValvePhoto(url);
      } catch (err: any) {
        toast.error("Couldn't upload photo", {
          description: err?.message ?? "Try again in a moment.",
        });
      } finally {
        setPhotoBusySlot(null);
      }
    },
    []
  );

  const clearSlotPhoto = useCallback((slot: "body" | "valve") => {
    if (slot === "body") setBodyPhoto("");
    else setValvePhoto("");
  }, []);

  const handleSave = useCallback(async () => {
    if (!hasAnyField) {
      toast.error("Pick at least one field");
      return;
    }
    setSubmitting(true);
    try {
      // Compact the two-slot array — server schema accepts up to 3
      // URLs; empty slots are dropped so we don't store empty strings.
      const photos = [bodyPhoto, valvePhoto].filter(Boolean);
      const res = await api.put<{ savedCylinder: typeof saved }>(
        "/auth/saved-cylinder",
        { brand, valve, age, test, photos }
      );
      updateUser({ savedCylinder: res.savedCylinder ?? undefined });
      toast.success("Cylinder profile saved");
      router.back();
    } catch (err: any) {
      toast.error("Couldn't save", {
        description: err?.message ?? "Try again in a moment.",
      });
    } finally {
      setSubmitting(false);
    }
  }, [hasAnyField, brand, valve, age, test, bodyPhoto, valvePhoto, updateUser, router]);

  const handleClear = useCallback(() => {
    Alert.alert(
      "Clear saved cylinder?",
      "Your next LPG-Swap order will need full cylinder details again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete("/auth/saved-cylinder");
              updateUser({ savedCylinder: undefined });
              setBrand(undefined);
              setValve(undefined);
              setAge(undefined);
              setTest(undefined);
              setBodyPhoto("");
              setValvePhoto("");
              toast.success("Cylinder profile cleared");
            } catch (err: any) {
              toast.error("Couldn't clear", {
                description: err?.message ?? "Try again in a moment.",
              });
            }
          },
        },
      ]
    );
  }, [updateUser]);

  return (
    <ScreenContainer
      edges={["top", "bottom"]}
      header={
        <ScreenHeader title="Saved cylinder" onBack={() => router.back()} />
      }
      footer={
        <FloatingCTA
          label={hasAnyField ? "Save changes" : "Pick at least one field"}
          subtitle={
            dirty && hasAnyField
              ? "We'll pre-fill these on your next LPG-Swap order"
              : undefined
          }
          disabled={!hasAnyField || !dirty || submitting}
          loading={submitting}
          onPress={handleSave}
          floating={false}
        />
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Hero card — explains why this screen exists. */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons
              name="cube"
              size={20}
              color={theme.mode === "dark" ? "#fff" : theme.palette.green700}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>One profile, faster orders</Text>
            <Text style={styles.heroBody}>
              When you place an LPG-Swap order, we'll pre-fill these
              fields and skip the photo step (when we have at least 2
              cylinder photos saved).
            </Text>
          </View>
        </View>

        {/* Profile fields */}
        <Text style={styles.sectionLabel}>CYLINDER PROFILE</Text>
        <View style={styles.rowGroup}>
          <Row
            icon="business-outline"
            label="Brand"
            meta={labelFor(BRAND_OPTIONS, brand)}
            onPress={() => brandRef.current?.open()}
          />
          <Row
            icon="git-branch-outline"
            label="Valve type"
            meta={labelFor(VALVE_OPTIONS, valve)}
            onPress={() => valveRef.current?.open()}
          />
          <Row
            icon="hourglass-outline"
            label="Age"
            meta={labelFor(AGE_OPTIONS, age)}
            onPress={() => ageRef.current?.open()}
          />
          <Row
            icon="checkmark-done-outline"
            label="Last test"
            meta={labelFor(TEST_OPTIONS, test)}
            divider={false}
            onPress={() => testRef.current?.open()}
          />
        </View>

        {/* Photos — two labeled slots (cylinder body + valve close-up).
            Each slot shows the saved image when present and acts as
            an upload tile when empty. Tap to replace; tap × to clear. */}
        <Text style={styles.sectionLabel}>PHOTOS</Text>
        <Text style={styles.photoHint}>
          Two clear angles help the rider bring the right kit.
        </Text>
        <View style={styles.photoGrid}>
          <PhotoSlot
            theme={theme}
            url={bodyPhoto}
            label="Cylinder body"
            hint="Full cylinder, label visible"
            busy={photoBusySlot === "body"}
            onPress={() => setSlotPhoto("body")}
            onClear={() => clearSlotPhoto("body")}
            disabled={photoBusySlot !== null}
          />
          <PhotoSlot
            theme={theme}
            url={valvePhoto}
            label="Valve close-up"
            hint="Top of cylinder, valve visible"
            busy={photoBusySlot === "valve"}
            onPress={() => setSlotPhoto("valve")}
            onClear={() => clearSlotPhoto("valve")}
            disabled={photoBusySlot !== null}
          />
        </View>

        {/* Saved metadata */}
        {saved?.savedAt ? (
          <Text style={styles.savedAt}>
            Saved {new Date(saved.savedAt).toLocaleDateString("en-NG", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </Text>
        ) : null}

        {/* Clear */}
        {saved?.brand ? (
          <Pressable
            onPress={handleClear}
            accessibilityRole="button"
            accessibilityLabel="Clear saved cylinder"
            style={({ pressed }) => [
              styles.clearRow,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons
              name="trash-outline"
              size={16}
              color={theme.error}
            />
            <Text style={styles.clearText}>Clear saved cylinder</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <PickerSheet
        ref={brandRef}
        title="Cylinder brand"
        description="Pick the closest match — the rider can confirm on arrival."
        options={BRAND_OPTIONS}
        value={brand ?? null}
        onChange={(id) => setBrand(id)}
      />
      <PickerSheet
        ref={valveRef}
        title="Valve type"
        description="Riders carry adapters for all three. Pick what matches."
        options={VALVE_OPTIONS}
        value={valve ?? null}
        onChange={(id) => setValve(id)}
      />
      <PickerSheet
        ref={ageRef}
        title="Cylinder age"
        description="Helps us bring the right re-test paperwork."
        options={AGE_OPTIONS}
        value={age ?? null}
        onChange={(id) => setAge(id)}
      />
      <PickerSheet
        ref={testRef}
        title="Last hydrostatic test"
        options={TEST_OPTIONS}
        value={test ?? null}
        onChange={(id) => setTest(id)}
      />
    </ScreenContainer>
  );
}

/* ─────────────────────── PhotoSlot ─────────────────────────── */

/**
 * One labeled cylinder-photo slot. Shows the saved image when present
 * with a × overlay to clear; shows a dashed upload tile when empty.
 * The label sits below so the user always knows which angle they're
 * filling, even after the image is uploaded.
 */
function PhotoSlot({
  theme,
  url,
  label,
  hint,
  busy,
  disabled,
  onPress,
  onClear,
}: {
  theme: Theme;
  url: string;
  label: string;
  hint: string;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
  onClear: () => void;
}) {
  const styles = useMemo(() => photoSlotStyles(theme), [theme]);
  const filled = !!url;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={
          filled ? `Replace ${label}` : `Upload ${label}`
        }
        style={({ pressed }) => [
          filled ? styles.tileFilled : styles.tileEmpty,
          pressed && { opacity: 0.85 },
          disabled && !busy && { opacity: 0.5 },
        ]}
      >
        {busy ? (
          <View style={styles.busy}>
            <Ionicons
              name="cloud-upload-outline"
              size={20}
              color={theme.fgMuted}
            />
          </View>
        ) : filled ? (
          <Image
            source={{ uri: url }}
            style={styles.img}
            accessibilityLabel={label}
          />
        ) : (
          <>
            <Ionicons name="camera" size={22} color={theme.fgMuted} />
            <Text style={styles.tileEmptyText}>Tap to add</Text>
          </>
        )}
        {filled && !busy ? (
          <Pressable
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label}`}
            hitSlop={8}
            style={styles.removeBtn}
          >
            <Ionicons name="close" size={12} color="#fff" />
          </Pressable>
        ) : null}
      </Pressable>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

const photoSlotStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: {
      flex: 1,
      gap: 6,
    },
    tileEmpty: {
      height: 116,
      borderRadius: 12,
      backgroundColor: theme.bgMuted,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: theme.borderStrong,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    tileEmptyText: {
      ...theme.type.caption,
      fontSize: 11,
      color: theme.fgMuted,
      fontWeight: "700",
    },
    tileFilled: {
      height: 116,
      borderRadius: 12,
      backgroundColor: theme.bgMuted,
      overflow: "hidden",
      position: "relative",
    },
    img: {
      width: "100%",
      height: "100%",
    },
    busy: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    removeBtn: {
      position: "absolute",
      top: 6,
      right: 6,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: "rgba(0,0,0,0.65)",
      alignItems: "center",
      justifyContent: "center",
    },
    label: {
      ...theme.type.caption,
      fontSize: 12,
      color: theme.fg,
      fontWeight: "800",
    },
    hint: {
      fontSize: 10.5,
      color: theme.fgMuted,
      lineHeight: 14,
    },
  });

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    scroll: {
      paddingBottom: theme.space.s5,
    },

    hero: {
      flexDirection: "row",
      gap: 12,
      marginHorizontal: theme.space.s4,
      marginTop: theme.space.s2,
      padding: 14,
      borderRadius: 14,
      backgroundColor: theme.primaryTint,
      borderWidth: 1,
      borderColor:
        theme.mode === "dark" ? theme.border : theme.palette.green100,
    },
    heroIcon: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor:
        theme.mode === "dark" ? "rgba(255,255,255,0.06)" : theme.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    heroTitle: {
      fontSize: 14,
      fontWeight: "800",
      color: theme.fg,
    },
    heroBody: {
      fontSize: 12,
      color: theme.fgMuted,
      marginTop: 4,
      lineHeight: 17,
    },

    sectionLabel: {
      ...theme.type.micro,
      color: theme.fgMuted,
      letterSpacing: 0.5,
      paddingHorizontal: theme.space.s4,
      paddingTop: theme.space.s4,
      paddingBottom: theme.space.s2,
    },
    rowGroup: {
      backgroundColor: theme.surface,
      marginHorizontal: theme.space.s4,
      borderRadius: theme.radius.md + 2,
      borderWidth: 1,
      borderColor: theme.divider,
      overflow: "hidden",
    },

    /* Photos */
    photoHint: {
      ...theme.type.caption,
      color: theme.fgMuted,
      paddingHorizontal: theme.space.s4,
      marginTop: -theme.space.s1,
      marginBottom: theme.space.s2,
    },
    photoGrid: {
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: theme.space.s4,
    },

    savedAt: {
      ...theme.type.caption,
      color: theme.fgMuted,
      textAlign: "center",
      paddingTop: theme.space.s3,
    },

    clearRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 6,
      paddingVertical: theme.space.s4,
      marginTop: theme.space.s2,
    },
    clearText: {
      ...theme.type.body,
      color: theme.error,
      fontWeight: "700",
    },
  });
