import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Theme, useTheme } from "@/constants/theme";
import { AuthScreenContainer, TrustStrip } from "@/components/ui/auth";
import { Button, Input } from "@/components/ui/primitives";
import { usePendingSignupStore } from "@/store/usePendingSignupStore";
import type { PendingRiderProfile } from "@/store/usePendingSignupStore";

const VEHICLE_TYPES: NonNullable<PendingRiderProfile["vehicleType"]>[] = [
  "motorcycle",
  "tricycle",
  "van",
];
const VEHICLE_LABELS: Record<NonNullable<PendingRiderProfile["vehicleType"]>, string> = {
  motorcycle: "Motorcycle",
  tricycle: "Tricycle",
  van: "Van",
};

/**
 * Rider profile setup. Plate number is captured exactly as it appears
 * on the plate so the verification + tracking screens can render the
 * same string without normalising. Vehicle type drives the LiveBadge
 * vehicle icon + the rider dispatcher's eligibility filter
 * (motorcycle eligible for all, van eligible for bulk only, etc.).
 */
export default function ProfileRiderScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const stored = usePendingSignupStore((s) => s.profile.rider);
  const patchProfile = usePendingSignupStore((s) => s.patchProfile);
  const setLastStep = usePendingSignupStore((s) => s.setLastStep);

  const [fullName, setFullName] = useState(stored?.fullName ?? "");
  const [email, setEmail] = useState(stored?.email ?? "");
  const [plate, setPlate] = useState(stored?.plate ?? "");
  const [vehicleType, setVehicleType] =
    useState<NonNullable<PendingRiderProfile["vehicleType"]>>(
      stored?.vehicleType ?? "motorcycle"
    );
  const [emailErr, setEmailErr] = useState<string | null>(null);

  const valid =
    fullName.trim().length >= 3 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) &&
    plate.trim().length >= 4;

  const handleContinue = useCallback(() => {
    if (!valid) {
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        setEmailErr("That doesn't look like a valid email.");
      }
      return;
    }
    patchProfile("rider", {
      fullName: fullName.trim(),
      // SECURITY I2 — lowercase to keep server-side email index unique
      // case-insensitively.
      email: email.trim().toLowerCase(),
      plate: plate.trim().toUpperCase(),
      vehicleType,
    });
    setLastStep("/(auth)/signup/pin-create");
    router.push("/(auth)/signup/pin-create" as never);
  }, [valid, email, fullName, plate, vehicleType, patchProfile, setLastStep, router]);

  return (
    <AuthScreenContainer
      contentStyle={{ paddingTop: theme.space.s4, gap: theme.space.s4 }}
      footer={
        <Button
          variant="primary"
          size="lg"
          full
          onPress={handleContinue}
          disabled={!valid}
          accessibilityLabel="Continue to PIN setup"
        >
          Continue
        </Button>
      }
    >
      <View style={styles.headerWrap}>
        <Text style={styles.title}>Rider profile</Text>
        <Text style={styles.sub}>These details appear on delivery cards.</Text>
      </View>

      <Input
        label="FULL NAME"
        value={fullName}
        onChangeText={setFullName}
        placeholder="Your full name"
        autoComplete="name"
        textContentType="name"
        autoCapitalize="words"
      />
      <Input
        label="EMAIL ADDRESS"
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          if (emailErr) setEmailErr(null);
        }}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        autoCapitalize="none"
        error={emailErr ?? undefined}
      />
      <Input
        label="BIKE PLATE NUMBER"
        value={plate}
        onChangeText={(v) => setPlate(v.toUpperCase())}
        placeholder="e.g. LND 123 AA"
        autoCapitalize="characters"
        helper="Exactly as it appears on the plate."
      />

      <View>
        <Text style={styles.segmentLabel}>VEHICLE TYPE</Text>
        <View style={styles.segmentRow}>
          {VEHICLE_TYPES.map((v) => {
            const selected = vehicleType === v;
            return (
              <Pressable
                key={v}
                onPress={() => setVehicleType(v)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={VEHICLE_LABELS[v]}
                style={({ pressed }) => [
                  styles.segmentBtn,
                  selected && styles.segmentBtnSelected,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    selected && styles.segmentTextSelected,
                  ]}
                >
                  {VEHICLE_LABELS[v]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <TrustStrip
        icon="shield-checkmark"
        text="We run a background and validity check on all plate numbers before activation."
      />
    </AuthScreenContainer>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    headerWrap: {
      gap: theme.space.s2,
    },
    title: {
      fontSize: 26,
      lineHeight: 30,
      fontWeight: "800",
      letterSpacing: -0.6,
      color: theme.fg,
    },
    sub: {
      ...theme.type.body,
      color: theme.fgMuted,
    },
    segmentLabel: {
      ...theme.type.micro,
      color: theme.fgMuted,
      marginBottom: 8,
    },
    segmentRow: {
      flexDirection: "row",
      gap: theme.space.s2 + 2,
    },
    segmentBtn: {
      flex: 1,
      height: 44,
      borderRadius: theme.radius.md,
      backgroundColor: theme.bgMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    segmentBtnSelected: {
      backgroundColor: theme.primary,
    },
    segmentText: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      fontWeight: "700",
    },
    segmentTextSelected: {
      color: theme.fgOnPrimary,
    },
  });
