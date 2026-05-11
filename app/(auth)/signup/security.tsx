import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Theme, useTheme } from "@/constants/theme";
import { AuthScreenContainer, SecurityOptionCard } from "@/components/ui/auth";
import { Button } from "@/components/ui/primitives";
import {
  biometricLabel,
  checkBiometricAvailability,
  type BiometricType,
} from "@/lib/permissions";
import { setBiometricEnabled } from "@/lib/auth";
import { usePendingSignupStore } from "@/store/usePendingSignupStore";

type Choice = "face" | "touch" | "pin";

interface Opt {
  id: Choice;
  icon: "scan-outline" | "finger-print" | "key";
  label: string;
  sub: string;
}

/**
 * Security method choice. Probes biometric availability on mount; if
 * the device has Face/Touch hardware AND the user has enrolled, we
 * pre-select that as the recommended option (matches the design's
 * "Face ID pre-selected" frame). Otherwise PIN-only is the only
 * option and we still let the user continue.
 *
 * The choice is persisted in two places:
 *   - usePendingSignupStore.securityChoice (sent to /auth/signup as
 *     `biometricPreference`)
 *   - SecureStore `gaznger.biometric-enabled` (drives the bootstrap
 *     router's biometric/PIN unlock decision on subsequent launches)
 */
export default function SecuritySetupScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const stored = usePendingSignupStore((s) => s.securityChoice);
  const setSecurityChoice = usePendingSignupStore((s) => s.setSecurityChoice);
  const setLastStep = usePendingSignupStore((s) => s.setLastStep);

  const [bioType, setBioType] = useState<BiometricType>("none");
  const [bioReady, setBioReady] = useState(false);
  const [choice, setChoice] = useState<Choice>(stored ?? "pin");

  // Probe biometric availability once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { available, type } = await checkBiometricAvailability();
      if (cancelled) return;
      setBioType(type);
      setBioReady(true);
      if (available && !stored) {
        setChoice(type === "face" ? "face" : "touch");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stored]);

  const options: Opt[] = useMemo(() => {
    const list: Opt[] = [];
    if (bioType === "face") {
      list.push({
        id: "face",
        icon: "scan-outline",
        label: biometricLabel("face"),
        sub: "Unlock instantly with your face.",
      });
    }
    if (bioType === "touch" || (Platform.OS === "android" && bioType === "face")) {
      // Some Android devices report face but only expose fingerprint
      // through the system prompt — keep the touch option visible.
      list.push({
        id: "touch",
        icon: "finger-print",
        label: biometricLabel("touch"),
        sub: "Unlock with your fingerprint.",
      });
    }
    list.push({
      id: "pin",
      icon: "key",
      label: "PIN only",
      sub: "Use the 4-digit PIN you just created.",
    });
    return list;
  }, [bioType]);

  const handleContinue = useCallback(async () => {
    setSecurityChoice(choice);
    await setBiometricEnabled(choice !== "pin");
    setLastStep("/(auth)/signup/permissions");
    router.push("/(auth)/signup/permissions" as never);
  }, [choice, setSecurityChoice, setLastStep, router]);

  const ctaLabel =
    choice === "pin"
      ? "Continue with PIN"
      : choice === "face"
      ? `Enable ${biometricLabel("face")}`
      : `Enable ${biometricLabel("touch")}`;

  return (
    <AuthScreenContainer
      contentStyle={{ paddingTop: theme.space.s4, gap: theme.space.s4 }}
      footer={
        <Button
          variant="primary"
          size="lg"
          full
          onPress={handleContinue}
          accessibilityLabel={`Continue with ${ctaLabel}`}
        >
          {ctaLabel}
        </Button>
      }
    >
      <View style={styles.headerWrap}>
        <Text style={styles.title}>Lock screen</Text>
        <Text style={styles.sub}>Choose how to unlock the app.</Text>
      </View>

      {bioReady ? (
        <View style={styles.cards}>
          {options.map((o) => (
            <SecurityOptionCard
              key={o.id}
              icon={o.icon}
              label={o.label}
              sub={o.sub}
              selected={choice === o.id}
              onPress={() => setChoice(o.id)}
            />
          ))}
        </View>
      ) : null}

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
    cards: {
      gap: theme.space.s2 + 2,
    },
  });
