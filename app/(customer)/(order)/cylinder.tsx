import React, { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Theme, useTheme } from "@/constants/theme";
import {
  FloatingCTA,
  ProgressDots,
  ScreenContainer,
  ScreenHeader,
} from "@/components/ui/primitives";
import { useFlowProgress } from "@/components/ui/customer/order/useFlowProgress";
import PickerSheet, {
  PickerOption,
  PickerSheetRef,
} from "@/components/ui/customer/order/PickerSheet";
import { useOrderStore } from "@/store/useOrderStore";
import { useSessionStore } from "@/store/useSessionStore";

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
  { id: "pol", label: "POL · standard threaded", sub: "Compatible with all Gaznger riders" },
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
  { id: "lt-1y", label: "Within last year", sub: "" },
  { id: "1-3y", label: "1–3 years ago", sub: "" },
  { id: "gt-3y", label: "Over 3 years ago", sub: "Recertification recommended" },
  { id: "never", label: "Never tested", sub: "" },
  { id: "unknown", label: "Don't know", sub: "We'll inspect on arrival" },
];

interface FieldState {
  id: string;
  label: string;
  sub: string;
}

function findOption(opts: PickerOption[], id: string): FieldState {
  const o = opts.find((x) => x.id === id) ?? opts[0];
  return { id: o.id, label: o.label, sub: o.sub ?? "" };
}

/**
 * LPG-swap step 2 — cylinder details. Each row opens a bottom-sheet picker.
 *
 * Saved-cylinder card is hidden for first-time users (no prior LPG order).
 * Once we wire `lpgOrderCount` from /api/users/me + a "save cylinder" prompt
 * on a successful first swap, returning users will see their default profile
 * pre-filled.
 */
export default function CylinderScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const { step, total } = useFlowProgress("cylinder");

  // Real saved-cylinder profile from /auth/me (populated when the
  // customer has previously saved a cylinder via the post-delivery
  // prompt — see /auth/me lpgOrderCount + savedCylinder fields).
  const savedCylinder = useSessionStore((s) => s.user?.savedCylinder);
  const lpgOrderCount = useSessionStore((s) => s.user?.lpgOrderCount ?? 0);
  const hasSavedCylinder = !!savedCylinder && lpgOrderCount > 0;

  const setCylinderDetails = useOrderStore((s) => s.setCylinderDetails);
  const draftDetails = useOrderStore((s) => s.order.cylinderDetails);

  // Seed: prior draft (returning to this screen mid-flow) → saved
  // cylinder profile → empty placeholder.
  const seedField = useCallback(
    (
      opts: PickerOption[],
      draftId: string | undefined,
      savedId: string | undefined,
      placeholder: string
    ): FieldState => {
      if (draftId) return findOption(opts, draftId);
      if (hasSavedCylinder && savedId) return findOption(opts, savedId);
      return { id: "", label: placeholder, sub: "" };
    },
    [hasSavedCylinder]
  );

  const [brand, setBrand] = useState<FieldState>(
    seedField(BRAND_OPTIONS, draftDetails?.brand, savedCylinder?.brand, "Pick a brand")
  );
  const [valve, setValve] = useState<FieldState>(
    seedField(VALVE_OPTIONS, draftDetails?.valve, savedCylinder?.valve, "Pick a valve type")
  );
  const [age, setAge] = useState<FieldState>(
    seedField(AGE_OPTIONS, draftDetails?.age, savedCylinder?.age, "Pick an age range")
  );
  const [test, setTest] = useState<FieldState>(
    seedField(TEST_OPTIONS, draftDetails?.test, savedCylinder?.test, "Pick last test date")
  );

  const brandRef = useRef<PickerSheetRef>(null);
  const valveRef = useRef<PickerSheetRef>(null);
  const ageRef = useRef<PickerSheetRef>(null);
  const testRef = useRef<PickerSheetRef>(null);

  const handleContinue = useCallback(() => {
    setCylinderDetails({
      brand: brand.id || undefined,
      valve: valve.id || undefined,
      age: age.id || undefined,
      test: test.id || undefined,
    });
    router.push("/(customer)/(order)/photo" as never);
  }, [brand.id, valve.id, age.id, test.id, setCylinderDetails, router]);

  const rows = [
    { key: "brand", label: "Brand", state: brand, ref: brandRef },
    { key: "valve", label: "Valve type", state: valve, ref: valveRef },
    { key: "age", label: "Age of cylinder", state: age, ref: ageRef },
    { key: "test", label: "Last test date", state: test, ref: testRef },
  ];

  return (
    <ScreenContainer
      edges={["top", "bottom"]}
      contentStyle={styles.scroll}
      header={<ScreenHeader title="Tell us about it" />}
      footer={
        <FloatingCTA
          label="Continue · upload photo"
          onPress={handleContinue}
          floating={false}
        />
      }
    >
      <View style={styles.body}>
        <ProgressDots step={step} total={total} variant="bars" />

        <Text style={styles.lead}>
          {hasSavedCylinder
            ? "So our rider arrives with the right kit. We saved your cylinder from last time — change anything you need."
            : "So our rider arrives with the right kit. Pick the details — we'll inspect on arrival to confirm."}
        </Text>

        {hasSavedCylinder ? (
          <View style={styles.savedCard}>
            <View style={styles.savedIcon}>
              <Ionicons name="cube-outline" size={20} color={theme.primary} />
            </View>
            <View style={styles.savedBody}>
              <Text style={styles.savedTitle}>Your cylinder</Text>
              <Text style={styles.savedSub}>Saved · used 4 times</Text>
            </View>
            <View style={styles.defaultPill}>
              <Text style={styles.defaultPillText}>Default</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.fields}>
          {rows.map((row) => (
            <Pressable
              key={row.key}
              onPress={() => row.ref.current?.open()}
              accessibilityRole="button"
              accessibilityLabel={`${row.label}: ${row.state.label}.`}
              accessibilityHint="Opens picker"
              style={({ pressed }) => [
                styles.fieldRow,
                pressed && { opacity: 0.92 },
              ]}
            >
              <View style={styles.fieldBody}>
                <Text style={styles.fieldLabel}>{row.label}</Text>
                <Text
                  style={[
                    styles.fieldValue,
                    !row.state.id && { color: theme.fgMuted, fontWeight: "600" },
                  ]}
                  numberOfLines={1}
                >
                  {row.state.label}
                </Text>
                {row.state.sub ? (
                  <Text style={styles.fieldSub} numberOfLines={1}>
                    {row.state.sub}
                  </Text>
                ) : null}
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={theme.fgMuted}
              />
            </Pressable>
          ))}
        </View>
      </View>

      <PickerSheet
        ref={brandRef}
        title="Cylinder brand"
        description="Pick the brand printed on the cylinder."
        options={BRAND_OPTIONS}
        value={brand.id || null}
        onChange={(id) => setBrand(findOption(BRAND_OPTIONS, id))}
      />
      <PickerSheet
        ref={valveRef}
        title="Valve type"
        description="The fitting at the top of the cylinder. Not sure? Pick Don't know."
        options={VALVE_OPTIONS}
        value={valve.id || null}
        onChange={(id) => setValve(findOption(VALVE_OPTIONS, id))}
      />
      <PickerSheet
        ref={ageRef}
        title="Age of cylinder"
        description="Cylinders over 10 years old can't be refilled by law."
        options={AGE_OPTIONS}
        value={age.id || null}
        onChange={(id) => setAge(findOption(AGE_OPTIONS, id))}
      />
      <PickerSheet
        ref={testRef}
        title="Last test date"
        description="Hydrostatic test — usually stamped near the valve."
        options={TEST_OPTIONS}
        value={test.id || null}
        onChange={(id) => setTest(findOption(TEST_OPTIONS, id))}
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
    savedCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s3,
      backgroundColor: theme.primaryTint,
      borderColor: theme.primary,
      borderWidth: 1,
      borderRadius: theme.radius.lg,
      paddingHorizontal: theme.space.s3 + 2,
      paddingVertical: theme.space.s3,
    },
    savedIcon: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.md,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    savedBody: { flex: 1, gap: 2 },
    savedTitle: {
      ...theme.type.body,
      color: theme.primary,
      fontWeight: "800",
    },
    savedSub: {
      ...theme.type.caption,
      color: theme.fgMuted,
    },
    defaultPill: {
      backgroundColor: theme.surface,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.space.s3,
      paddingVertical: 4,
    },
    defaultPillText: {
      ...theme.type.caption,
      color: theme.fg,
      fontWeight: "700",
    },
    fields: { gap: theme.space.s2 },
    fieldRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s3,
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: theme.radius.lg,
      paddingHorizontal: theme.space.s3 + 2,
      paddingVertical: theme.space.s3,
    },
    fieldBody: { flex: 1, gap: 2 },
    fieldLabel: {
      ...theme.type.caption,
      color: theme.fgMuted,
    },
    fieldValue: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "800",
    },
    fieldSub: {
      ...theme.type.caption,
      color: theme.fgMuted,
    },
  });
