import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { toast } from "sonner-native";
import { Theme, useTheme } from "@/constants/theme";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import { AuthScreenContainer, V7Field } from "@/components/ui/auth";
import { Button } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { useSessionStore } from "@/store/useSessionStore";

/**
 * Rider onboarding wizard — v7 unified auth.
 *
 *   Step 1 — Affiliation  (checkbox: invite code? · optional code field)
 *   Step 2 — Profile      (display name required + email optional)
 *   Step 3 — Vehicle      (type + plate required, brand/colour/year opt)
 *
 * Deep-link param `?inviteCode=XXXX` auto-ticks the checkbox and
 * pre-fills the code. Step 1 Continue redeems the invite when ticked,
 * then advances.
 *
 *   Step 1 Continue → (if invite) POST /auth/redeem-invite { code }
 *   Step 2 Continue → PUT /auth/me { displayName, email? }
 *   Step 3 Finish   → POST /api/rider/setup { vehicleType, vehiclePlate, ... }
 *                     → /(auth)/verification/pending?role=rider
 */

type VehicleType = "motorcycle" | "car" | "truck";

interface VehicleConfig {
  id: VehicleType;
  label: string;
  glyph: "bike" | "car" | "truck";
}

const VEHICLES: VehicleConfig[] = [
  { id: "motorcycle", label: "Motorbike", glyph: "bike" },
  { id: "car", label: "Car", glyph: "car" },
  { id: "truck", label: "Truck", glyph: "truck" },
];

export default function RiderWizardScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ inviteCode?: string }>();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const updateUser = useSessionStore((s) => s.updateUser);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1 — Affiliation
  // Auto-tick + lock the code when arrived from a deep-link.
  const deepLinkCode = useMemo(
    () => (typeof params.inviteCode === "string" ? params.inviteCode.trim() : ""),
    [params.inviteCode],
  );
  const [hasInvite, setHasInvite] = useState(!!deepLinkCode);
  const [inviteCode, setInviteCode] = useState(deepLinkCode);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const inviteFromDeepLink = !!deepLinkCode;

  // Step 2 — Profile
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");

  // Step 3 — Vehicle
  const [vehicleType, setVehicleType] = useState<VehicleType>("motorcycle");
  const [plate, setPlate] = useState("");
  const [brand, setBrand] = useState("");
  const [colour, setColour] = useState("");
  const [year, setYear] = useState("");

  useEffect(() => {
    if (deepLinkCode) {
      setHasInvite(true);
      setInviteCode(deepLinkCode);
    }
  }, [deepLinkCode]);

  const step1Valid = !hasInvite || inviteCode.trim().length > 0;
  const step2Valid = displayName.trim().length >= 2;
  const step3Valid = plate.trim().length >= 3;

  const handleStep1Continue = useCallback(async () => {
    if (!step1Valid || submitting) return;
    setSubmitting(true);
    setInviteError(null);
    try {
      if (hasInvite) {
        try {
          await api.post("/auth/redeem-invite", {
            code: inviteCode.trim(),
          });
        } catch (err: any) {
          setInviteError(
            err?.message ?? "Invite code is invalid or expired.",
          );
          setSubmitting(false);
          return;
        }
      }
      setStep(2);
    } finally {
      setSubmitting(false);
    }
  }, [step1Valid, submitting, hasInvite, inviteCode]);

  const handleStep2Continue = useCallback(async () => {
    if (!step2Valid || submitting) return;
    setSubmitting(true);
    try {
      const data = await api.put<{
        displayName?: string;
        email?: string;
      }>("/auth/me", {
        displayName: displayName.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
      });
      updateUser({
        displayName: data.displayName,
        email: data.email ?? "",
      });
      setStep(3);
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't save profile.");
    } finally {
      setSubmitting(false);
    }
  }, [step2Valid, submitting, displayName, email, updateUser]);

  const handleStep3Finish = useCallback(async () => {
    if (!step3Valid || submitting) return;
    setSubmitting(true);
    try {
      await api.post("/api/rider/setup", {
        vehicleType,
        vehiclePlate: plate.trim().toUpperCase(),
        ...(brand.trim() ? { vehicleBrand: brand.trim() } : {}),
        ...(colour.trim() ? { vehicleColor: colour.trim() } : {}),
        ...(year.trim() ? { vehicleYear: parseInt(year, 10) } : {}),
      });
      updateUser({ isOnboarded: true });
      router.replace("/(auth)/verification/pending?role=rider" as never);
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't save vehicle details.");
      setSubmitting(false);
    }
  }, [
    step3Valid,
    submitting,
    vehicleType,
    plate,
    brand,
    colour,
    year,
    updateUser,
    router,
  ]);

  const handleBack = useCallback(() => {
    if (step === 1) {
      router.back();
      return;
    }
    setStep((s) => Math.max(1, (s - 1) as 1 | 2 | 3) as 1 | 2 | 3);
  }, [step, router]);

  return (
    <AuthScreenContainer
      contentStyle={{ paddingTop: 0, paddingHorizontal: 0 }}
      background={theme.bgMuted}
      scrollable={false}
      footer={
        step === 3 ? (
          <Button
            variant="primary"
            size="lg"
            full
            onPress={handleStep3Finish}
            loading={submitting}
            disabled={submitting || !step3Valid}
            accessibilityLabel="Finish rider setup"
          >
            {submitting ? "Saving…" : "Finish"}
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            full
            onPress={step === 1 ? handleStep1Continue : handleStep2Continue}
            loading={submitting}
            disabled={
              submitting ||
              (step === 1 ? !step1Valid : !step2Valid)
            }
            accessibilityLabel="Continue"
          >
            {submitting ? "Saving…" : "Continue"}
          </Button>
        )
      }
    >
      <WizardHeader
        step={step}
        onBack={handleBack}
        theme={theme}
        styles={styles}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {step === 1 ? (
          <Step1
            hasInvite={hasInvite}
            inviteCode={inviteCode}
            inviteError={inviteError}
            inviteFromDeepLink={inviteFromDeepLink}
            setHasInvite={setHasInvite}
            setInviteCode={setInviteCode}
            theme={theme}
            styles={styles}
          />
        ) : null}

        {step === 2 ? (
          <Step2
            displayName={displayName}
            email={email}
            setDisplayName={setDisplayName}
            setEmail={setEmail}
            theme={theme}
            styles={styles}
          />
        ) : null}

        {step === 3 ? (
          <Step3
            vehicleType={vehicleType}
            plate={plate}
            brand={brand}
            colour={colour}
            year={year}
            setVehicleType={setVehicleType}
            setPlate={setPlate}
            setBrand={setBrand}
            setColour={setColour}
            setYear={setYear}
            theme={theme}
            styles={styles}
          />
        ) : null}
      </ScrollView>
    </AuthScreenContainer>
  );
}

/* ─────────────── Wizard chrome ─────────────── */

function WizardHeader({
  step,
  onBack,
  theme,
  styles,
}: {
  step: number;
  onBack: () => void;
  theme: Theme;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.wizardHeader}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={6}
        style={({ pressed }) => [
          styles.headerBackBtn,
          pressed && { opacity: 0.85 },
        ]}
      >
        <Ionicons name="chevron-back" size={22} color={theme.fg} />
      </Pressable>
      <View style={styles.progressTrack}>
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.progressSeg,
              i <= step && styles.progressSegActive,
            ]}
          />
        ))}
      </View>
      <Text style={styles.progressCount}>{step}/3</Text>
    </View>
  );
}

function StepHeading({
  eyebrow,
  title,
  sub,
  styles,
}: {
  eyebrow: string;
  title: string;
  sub: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.stepHeading}>
      <Text style={styles.stepEyebrow}>{eyebrow}</Text>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepSub}>{sub}</Text>
    </View>
  );
}

/* ─────────────── Step 1 ─────────────── */

function Step1({
  hasInvite,
  inviteCode,
  inviteError,
  inviteFromDeepLink,
  setHasInvite,
  setInviteCode,
  theme,
  styles,
}: {
  hasInvite: boolean;
  inviteCode: string;
  inviteError: string | null;
  inviteFromDeepLink: boolean;
  setHasInvite: (v: boolean) => void;
  setInviteCode: (v: string) => void;
  theme: Theme;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View>
      <StepHeading
        eyebrow="Step 1 of 3 · Affiliation"
        title="Riding for a vendor?"
        sub="Affiliated riders get priority orders from their station. Freelance riders can pick from any nearby station."
        styles={styles}
      />
      <View style={styles.fields}>
        <Pressable
          onPress={inviteFromDeepLink ? undefined : () => setHasInvite(!hasInvite)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: hasInvite }}
          accessibilityLabel="I have a vendor invite code"
          style={[
            styles.checkboxRow,
            hasInvite && styles.checkboxRowActive,
            inviteFromDeepLink && { opacity: 0.95 },
          ]}
        >
          <View
            style={[
              styles.checkBox,
              hasInvite && styles.checkBoxActive,
            ]}
          >
            {hasInvite ? (
              <Ionicons name="checkmark" size={14} color="#fff" />
            ) : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.checkboxTitle}>
              I have a vendor invite code
            </Text>
            <Text style={styles.checkboxSub}>
              {hasInvite
                ? "You'll be linked to the vendor's station after verification."
                : "Leave this unchecked to ride freelance — you can still join a vendor later."}
            </Text>
          </View>
        </Pressable>

        {hasInvite ? (
          <>
            <V7Field
              label="Invite code"
              required
              value={inviteCode}
              onChangeText={(t) => setInviteCode(t.trim().toUpperCase())}
              placeholder="ABKN-XXXX"
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!inviteFromDeepLink}
              error={inviteError}
              hint={
                inviteFromDeepLink && !inviteError
                  ? "Pre-filled from your invite link. Untick the box above to sign up as freelance instead."
                  : undefined
              }
              suffix={
                inviteFromDeepLink ? (
                  <View style={styles.fromLinkPill}>
                    <Ionicons
                      name="link"
                      size={11}
                      color={theme.palette.green700}
                    />
                    <Text style={styles.fromLinkPillText}>From link</Text>
                  </View>
                ) : undefined
              }
            />
            {inviteFromDeepLink && !inviteError ? (
              <View style={styles.vendorPreviewCard}>
                <View style={styles.vendorPreviewTile}>
                  <Ionicons
                    name="business"
                    size={20}
                    color={theme.palette.green700}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.vendorPreviewTitle}>
                    From your invite link
                  </Text>
                  <Text style={styles.vendorPreviewSub} numberOfLines={1}>
                    You'll be assigned to the vendor's home station after
                    verification.
                  </Text>
                </View>
                <View style={styles.vendorPreviewPill}>
                  <Text style={styles.vendorPreviewPillText}>Joining</Text>
                </View>
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.freelanceCard}>
            <View style={styles.freelanceTile}>
              <Ionicons
                name="information-circle"
                size={18}
                color={theme.palette.green700}
              />
            </View>
            <Text style={styles.freelanceText}>
              You'll sign up as a{" "}
              <Text style={styles.freelanceStrong}>freelance rider</Text>.
              You can join a vendor anytime later from your profile.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

/* ─────────────── Step 2 ─────────────── */

function Step2({
  displayName,
  email,
  setDisplayName,
  setEmail,
  theme,
  styles,
}: {
  displayName: string;
  email: string;
  setDisplayName: (v: string) => void;
  setEmail: (v: string) => void;
  theme: Theme;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View>
      <StepHeading
        eyebrow="Step 2 of 3 · Profile"
        title="A few quick details"
        sub="So we can address you correctly and reach you for payouts."
        styles={styles}
      />
      <View style={styles.fields}>
        <V7Field
          label="Display name"
          required
          hint="Shown to customers and your vendor."
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Your full name"
          autoCapitalize="words"
        />
        <V7Field
          label="Email"
          hint="Optional — for receipts and tax records."
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <View style={styles.infoNote}>
          <Ionicons
            name="information-circle"
            size={18}
            color={theme.info}
          />
          <Text style={styles.infoText}>
            We'll ask for your NIN, driver's licence, and bike papers at
            the verification step — not now.
          </Text>
        </View>
      </View>
    </View>
  );
}

/* ─────────────── Step 3 ─────────────── */

function Step3({
  vehicleType,
  plate,
  brand,
  colour,
  year,
  setVehicleType,
  setPlate,
  setBrand,
  setColour,
  setYear,
  theme,
  styles,
}: {
  vehicleType: VehicleType;
  plate: string;
  brand: string;
  colour: string;
  year: string;
  setVehicleType: (v: VehicleType) => void;
  setPlate: (v: string) => void;
  setBrand: (v: string) => void;
  setColour: (v: string) => void;
  setYear: (v: string) => void;
  theme: Theme;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View>
      <StepHeading
        eyebrow="Step 3 of 3 · Vehicle"
        title="Your delivery vehicle"
        sub="So we route the right size of orders to you."
        styles={styles}
      />
      <View style={styles.fields}>
        <View>
          <Text style={styles.fieldLabel}>Vehicle type</Text>
          <View style={styles.segmented}>
            {VEHICLES.map((v) => {
              const active = vehicleType === v.id;
              return (
                <Pressable
                  key={v.id}
                  onPress={() => setVehicleType(v.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={v.label}
                  style={[
                    styles.segmentBtn,
                    active && styles.segmentBtnActive,
                  ]}
                >
                  <VehicleGlyph kind={v.glyph} theme={theme} active={active} />
                  <Text
                    style={[
                      styles.segmentText,
                      active && styles.segmentTextActive,
                    ]}
                  >
                    {v.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <V7Field
          label="Plate number"
          required
          hint="Letters are auto-uppercased."
          value={plate}
          onChangeText={(t) => setPlate(t.toUpperCase())}
          placeholder="LSD 000 ABC"
          autoCapitalize="characters"
        />

        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <V7Field
              label="Brand"
              value={brand}
              onChangeText={setBrand}
              placeholder="e.g. Bajaj"
              autoCapitalize="words"
            />
          </View>
          <View style={{ flex: 1 }}>
            <V7Field
              label="Year"
              value={year}
              onChangeText={(t) =>
                setYear(t.replace(/[^0-9]/g, "").slice(0, 4))
              }
              placeholder="2022"
              keyboardType="number-pad"
              autoCapitalize="none"
            />
          </View>
        </View>

        <V7Field
          label="Colour"
          value={colour}
          onChangeText={setColour}
          placeholder="e.g. Red"
          autoCapitalize="words"
        />

        <View style={styles.infoNote}>
          <Ionicons name="shield-checkmark" size={18} color={theme.info} />
          <Text style={styles.infoText}>
            Plate, brand, and year are double-checked against your photos
            during verification.
          </Text>
        </View>
      </View>
    </View>
  );
}

function VehicleGlyph({
  kind,
  theme,
  active,
}: {
  kind: "bike" | "car" | "truck";
  theme: Theme;
  active: boolean;
}) {
  const color = active ? theme.fg : theme.fgMuted;
  return (
    <Svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === "bike" && (
        <>
          <Circle cx={6} cy={17} r={3} />
          <Circle cx={18} cy={17} r={3} />
          <Path d="M6 17 L 12 10 L 16 10 L 18 17" />
          <Line x1={12} y1={7} x2={15} y2={7} />
        </>
      )}
      {kind === "car" && (
        <>
          <Path d="M4 15 L 5 11 L 7 9 L 17 9 L 19 11 L 20 15" />
          <Rect x={3} y={15} width={18} height={4} rx={1} />
          <Circle cx={7} cy={19} r={1.2} fill={color} stroke="none" />
          <Circle cx={17} cy={19} r={1.2} fill={color} stroke="none" />
        </>
      )}
      {kind === "truck" && (
        <>
          <Rect x={3} y={8} width={11} height={9} rx={1} />
          <Path d="M14 11 L 18 11 L 20 14 L 20 17 L 14 17" />
          <Circle cx={7} cy={19} r={1.5} />
          <Circle cx={17} cy={19} r={1.5} />
        </>
      )}
    </Svg>
  );
}

/* ─────────────── Styles ─────────────── */

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wizardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 12,
    },
    headerBackBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.bgMuted,
    },
    progressTrack: {
      flex: 1,
      flexDirection: "row",
      gap: 6,
    },
    progressSeg: {
      flex: 1,
      height: 6,
      borderRadius: 999,
      backgroundColor: theme.divider,
    },
    progressSegActive: {
      backgroundColor: theme.primary,
    },
    progressCount: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.fgMuted,
      minWidth: 32,
      textAlign: "right",
    },
    scroll: {
      paddingHorizontal: 16,
      paddingBottom: 140,
    },
    stepHeading: {
      paddingHorizontal: 4,
      paddingBottom: 16,
      gap: 4,
    },
    stepEyebrow: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: theme.warning,
    },
    stepTitle: {
      ...theme.type.h1,
      color: theme.fg,
      fontWeight: "800",
      letterSpacing: -0.3,
      fontSize: 22,
      marginTop: 4,
    },
    stepSub: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      lineHeight: 20,
      marginTop: 4,
    },
    fields: {
      gap: 12,
    },
    fieldLabel: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: theme.fgMuted,
      marginBottom: 6,
      marginHorizontal: 2,
    },
    field: {
      height: 52,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: theme.surface,
      borderWidth: 1.5,
      borderColor: theme.divider,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    fieldFocused: {
      borderColor: theme.primary,
    },
    input: {
      flex: 1,
      fontSize: 15,
      fontWeight: "700",
      color: theme.fg,
      paddingVertical: 0,
    },
    fieldHint: {
      fontSize: 11.5,
      color: theme.fgMuted,
      marginTop: 6,
      marginHorizontal: 2,
    },
    errorText: {
      fontSize: 12,
      color: theme.error,
      fontWeight: "700",
      marginTop: 6,
      marginHorizontal: 2,
    },
    checkboxRow: {
      flexDirection: "row",
      gap: 12,
      alignItems: "flex-start",
      padding: 14,
      borderRadius: 14,
      backgroundColor: theme.surface,
      borderWidth: 1.5,
      borderColor: theme.divider,
    },
    checkboxRowActive: {
      backgroundColor: theme.primaryTint,
      borderColor: theme.primary,
    },
    checkBox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.8,
      borderColor: theme.divider,
      alignItems: "center",
      justifyContent: "center",
    },
    checkBoxActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    checkboxTitle: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "800",
    },
    checkboxSub: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      marginTop: 4,
      lineHeight: 18,
    },
    fromLinkPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: theme.primaryTint,
    },
    fromLinkPillText: {
      fontSize: 10.5,
      fontWeight: "800",
      color: theme.palette.green700,
    },
    freelanceCard: {
      padding: 14,
      borderRadius: 14,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.divider,
      flexDirection: "row",
      gap: 12,
      alignItems: "flex-start",
    },
    freelanceTile: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: theme.palette.green50,
      alignItems: "center",
      justifyContent: "center",
    },
    freelanceText: {
      flex: 1,
      ...theme.type.bodySm,
      color: theme.fgMuted,
      lineHeight: 20,
    },
    freelanceStrong: {
      color: theme.fg,
      fontWeight: "800",
    },
    vendorPreviewCard: {
      padding: 14,
      borderRadius: 14,
      backgroundColor: theme.primaryTint,
      borderWidth: 1,
      borderColor: theme.primary,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    vendorPreviewTile: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    vendorPreviewTitle: {
      fontSize: 14,
      fontWeight: "800",
      color: theme.palette.green700,
    },
    vendorPreviewSub: {
      fontSize: 12,
      color: theme.palette.green700,
      opacity: 0.8,
      marginTop: 2,
    },
    vendorPreviewPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: theme.success,
    },
    vendorPreviewPillText: {
      fontSize: 10.5,
      fontWeight: "800",
      color: "#fff",
      letterSpacing: 0.4,
    },
    infoNote: {
      padding: 14,
      borderRadius: 14,
      backgroundColor: theme.infoTint,
      borderWidth: 1,
      borderColor: theme.info + "33",
      flexDirection: "row",
      gap: 10,
      alignItems: "flex-start",
    },
    infoText: {
      flex: 1,
      ...theme.type.bodySm,
      color: theme.info,
      lineHeight: 20,
    },
    segmented: {
      flexDirection: "row",
      gap: 4,
      padding: 4,
      borderRadius: 14,
      backgroundColor: theme.bgMuted,
    },
    segmentBtn: {
      flex: 1,
      height: 44,
      borderRadius: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    segmentBtnActive: {
      backgroundColor: theme.surface,
    },
    segmentText: {
      fontSize: 13,
      fontWeight: "800",
      color: theme.fgMuted,
    },
    segmentTextActive: {
      color: theme.fg,
    },
  });
