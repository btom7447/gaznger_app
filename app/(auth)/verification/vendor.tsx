import React, { useCallback, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { toast } from "sonner-native";
import { Theme, useTheme } from "@/constants/theme";
import {
  AuthScreenContainer,
  VerificationTimeline,
  type VerificationStep,
} from "@/components/ui/auth";
import { Button } from "@/components/ui/primitives";

const STEPS: VerificationStep[] = [
  {
    icon: "document-text",
    label: "NMDPRA licence",
    sub: "Upload a clear photo or PDF.",
    state: "done",
  },
  {
    icon: "business",
    label: "Station photos",
    sub: "Exterior, dispensers, and signage.",
    state: "active",
  },
  {
    icon: "cash",
    label: "Bank account",
    sub: "Where your payouts land.",
    state: "pending",
  },
  {
    icon: "shield-checkmark",
    label: "Gaznger review",
    sub: "Physical or remote inspection — usually 48 hrs.",
    state: "pending",
  },
];

/**
 * Vendor verification kickoff. Same shape as rider — kickoff +
 * pending lobby only. Upload flows pending design (see
 * _drift/auth-verification-uploads-pending.md). Step 1 (NMDPRA
 * licence) shows as done because the licence number was captured
 * during the vendor profile form; actual document upload is one of
 * the deferred screens.
 */
export default function VerificationVendorScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const handleUpload = useCallback(() => {
    toast.info("Coming soon", {
      description:
        "Station-photo uploads launch in the next update. We'll prompt you then — your account is saved.",
    });
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn(
        "[verification:vendor] Upload screens deferred — see _drift/auth-verification-uploads-pending.md"
      );
    }
    router.replace(
      "/(auth)/verification/pending?role=vendor" as never
    );
  }, [router]);

  const handleSaveLater = useCallback(() => {
    router.replace(
      "/(auth)/verification/pending?role=vendor" as never
    );
  }, [router]);

  return (
    <AuthScreenContainer
      contentStyle={{ paddingTop: theme.space.s4, gap: theme.space.s4 }}
      footer={
        <Button
          variant="primary"
          size="lg"
          full
          onPress={handleUpload}
          accessibilityLabel="Upload station photos"
        >
          Upload station photos
        </Button>
      }
    >
      <View style={styles.headerWrap}>
        <Text style={styles.title}>Station verification</Text>
        <Text style={styles.sub}>Complete all steps to go live.</Text>
      </View>

      <View style={styles.rail}>
        <VerificationTimeline steps={STEPS} />
      </View>

      <Button
        variant="ghost"
        size="md"
        full
        onPress={handleSaveLater}
        accessibilityLabel="Save and finish later"
      >
        Save and finish later
      </Button>
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
    rail: {
      paddingTop: theme.space.s2,
    },
  });
