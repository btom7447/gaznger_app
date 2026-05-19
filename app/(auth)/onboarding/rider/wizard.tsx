import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
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
import { AuthScreenContainer } from "@/components/ui/auth";
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
 * Rebuilt 2026-05-17 with inline TextInputs (no extracted V7Field /
 * sub-step components) so the soft keyboard stays open while typing.
 *
 * Server calls:
 *   Step 1 Continue → (if invite) POST /auth/redeem-invite { code }
 *   Step 2 Continue → PUT /auth/me { displayName, email? }
 *   Step 3 Finish   → POST /api/rider/setup { vehicleType, vehiclePlate, ... }
 *                     → /(auth)/verification/pending?role=rider
 */

type VehicleType = "motorcycle" | "car" | "truck";

const VEHICLES: { id: VehicleType; label: string; glyph: "bike" | "car" | "truck" }[] = [
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

  const deepLinkCode = useMemo(
    () =>
      typeof params.inviteCode === "string"
        ? params.inviteCode.trim()
        : "",
    [params.inviteCode],
  );
  const [hasInvite, setHasInvite] = useState(!!deepLinkCode);
  const [inviteCode, setInviteCode] = useState(deepLinkCode);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const inviteFromDeepLink = !!deepLinkCode;

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");

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
        ...(email.trim() ? { email: email.trim().toLowerCase() } : {}),
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
      contentStyle={{ paddingTop: 0, paddingHorizontal: 0, gap: 0 }}
      background={theme.bgMuted}
      showBack={false}
      showHelp={false}
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
            disabled={submitting || (step === 1 ? !step1Valid : !step2Valid)}
            accessibilityLabel="Continue"
          >
            {submitting ? "Saving…" : "Continue"}
          </Button>
        )
      }
    >
      <View style={styles.wizardHeader}>
        <Pressable
          onPress={handleBack}
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

      {/* Step 1 — Affiliation */}
      {step === 1 ? (
        <View style={styles.stepWrap}>
          <View style={styles.stepHeading}>
            <Text style={styles.stepEyebrow}>
              Step 1 of 3 · Affiliation
            </Text>
            <Text style={styles.stepTitle}>Riding for a vendor?</Text>
            <Text style={styles.stepSub}>
              Affiliated riders get priority orders from their station.
              Freelance riders can pick from any nearby station.
            </Text>
          </View>
          <View style={styles.fields}>
            <Pressable
              onPress={
                inviteFromDeepLink ? undefined : () => setHasInvite(!hasInvite)
              }
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
                <View>
                  <View style={styles.labelRow}>
                    <Text style={styles.fieldLabel}>Invite code</Text>
                    <Text style={styles.requiredMark}> ·</Text>
                  </View>
                  <View
                    style={[
                      styles.input,
                      inviteError && { borderColor: theme.error },
                    ]}
                  >
                    <TextInput
                      value={inviteCode}
                      onChangeText={(t) => setInviteCode(t.trim().toUpperCase())}
                      placeholder="ABKN-XXXX"
                      placeholderTextColor={theme.fgMuted}
                      style={styles.inputText}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      editable={!inviteFromDeepLink}
                      selectionColor={theme.primary}
                    />
                    {inviteFromDeepLink ? (
                      <View style={styles.fromLinkPill}>
                        <Ionicons
                          name="link"
                          size={11}
                          color={theme.palette.green700}
                        />
                        <Text style={styles.fromLinkPillText}>From link</Text>
                      </View>
                    ) : null}
                  </View>
                  {inviteError ? (
                    <View style={styles.errorRow}>
                      <Ionicons
                        name="warning"
                        size={14}
                        color={theme.error}
                      />
                      <Text style={styles.errorText}>{inviteError}</Text>
                    </View>
                  ) : inviteFromDeepLink ? (
                    <Text style={styles.fieldHint}>
                      Pre-filled from your invite link. Untick the box above
                      to sign up as freelance instead.
                    </Text>
                  ) : null}
                </View>

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
                      <Text
                        style={styles.vendorPreviewSub}
                        numberOfLines={2}
                      >
                        You'll be assigned to the vendor's home station
                        after verification.
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
      ) : null}

      {/* Step 2 — Profile */}
      {step === 2 ? (
        <View style={styles.stepWrap}>
          <View style={styles.stepHeading}>
            <Text style={styles.stepEyebrow}>
              Step 2 of 3 · Profile
            </Text>
            <Text style={styles.stepTitle}>A few quick details</Text>
            <Text style={styles.stepSub}>
              So we can address you correctly and reach you for payouts.
            </Text>
          </View>
          <View style={styles.fields}>
            <View>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>Display name</Text>
                <Text style={styles.requiredMark}> ·</Text>
              </View>
              <View style={styles.input}>
                <TextInput
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Your full name"
                  placeholderTextColor={theme.fgMuted}
                  style={styles.inputText}
                  autoCapitalize="words"
                  selectionColor={theme.primary}
                />
              </View>
              <Text style={styles.fieldHint}>
                Shown to customers and your vendor.
              </Text>
            </View>
            <View>
              <Text style={styles.fieldLabel}>Email</Text>
              <View style={styles.input}>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={theme.fgMuted}
                  style={styles.inputText}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  selectionColor={theme.primary}
                />
              </View>
              <Text style={styles.fieldHint}>
                Optional — for receipts and tax records.
              </Text>
            </View>
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
      ) : null}

      {/* Step 3 — Vehicle */}
      {step === 3 ? (
        <View style={styles.stepWrap}>
          <View style={styles.stepHeading}>
            <Text style={styles.stepEyebrow}>Step 3 of 3 · Vehicle</Text>
            <Text style={styles.stepTitle}>Your delivery vehicle</Text>
            <Text style={styles.stepSub}>
              So we route the right size of orders to you.
            </Text>
          </View>
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
                      <VehicleGlyph
                        kind={v.glyph}
                        theme={theme}
                        active={active}
                      />
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

            <View>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>Plate number</Text>
                <Text style={styles.requiredMark}> ·</Text>
              </View>
              <View style={styles.input}>
                <TextInput
                  value={plate}
                  onChangeText={(t) => setPlate(t.toUpperCase())}
                  placeholder="LSD 000 ABC"
                  placeholderTextColor={theme.fgMuted}
                  style={styles.inputText}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  selectionColor={theme.primary}
                />
              </View>
              <Text style={styles.fieldHint}>
                Letters are auto-uppercased.
              </Text>
            </View>

            <View style={styles.gridRow}>
              <View style={styles.gridCol}>
                <Text style={styles.fieldLabel}>Brand</Text>
                <View style={styles.input}>
                  <TextInput
                    value={brand}
                    onChangeText={setBrand}
                    placeholder="e.g. Bajaj"
                    placeholderTextColor={theme.fgMuted}
                    style={styles.inputText}
                    autoCapitalize="words"
                    selectionColor={theme.primary}
                  />
                </View>
              </View>
              <View style={styles.gridCol}>
                <Text style={styles.fieldLabel}>Year</Text>
                <View style={styles.input}>
                  <TextInput
                    value={year}
                    onChangeText={(t) =>
                      setYear(t.replace(/[^0-9]/g, "").slice(0, 4))
                    }
                    placeholder="2022"
                    placeholderTextColor={theme.fgMuted}
                    style={styles.inputText}
                    keyboardType="number-pad"
                    maxLength={4}
                    selectionColor={theme.primary}
                  />
                </View>
              </View>
            </View>

            <View>
              <Text style={styles.fieldLabel}>Colour</Text>
              <View style={styles.input}>
                <TextInput
                  value={colour}
                  onChangeText={setColour}
                  placeholder="e.g. Red"
                  placeholderTextColor={theme.fgMuted}
                  style={styles.inputText}
                  autoCapitalize="words"
                  selectionColor={theme.primary}
                />
              </View>
            </View>

            <View style={styles.infoNote}>
              <Ionicons
                name="shield-checkmark"
                size={18}
                color={theme.info}
              />
              <Text style={styles.infoText}>
                Plate, brand, and year are double-checked against your
                photos during verification.
              </Text>
            </View>
          </View>
        </View>
      ) : null}
    </AuthScreenContainer>
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

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wizardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 16,
    },
    headerBackBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surface,
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
    stepWrap: {
      paddingHorizontal: 16,
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
    labelRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 6,
      marginHorizontal: 2,
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
    requiredMark: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.palette.green700,
    },
    input: {
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
    inputText: {
      flex: 1,
      fontSize: 15,
      fontWeight: "700",
      color: theme.fg,
      paddingVertical: 0,
    },
    fieldHint: {
      marginTop: 6,
      fontSize: 11.5,
      color: theme.fgMuted,
      marginHorizontal: 2,
    },
    errorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 6,
      marginHorizontal: 2,
    },
    errorText: {
      fontSize: 12,
      color: theme.error,
      fontWeight: "700",
      flex: 1,
    },
    gridRow: {
      flexDirection: "row",
      gap: 10,
    },
    gridCol: {
      flex: 1,
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
      marginTop: 6,
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
