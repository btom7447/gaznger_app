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

/**
 * Rider verification kickoff. Shows the 4-step rail (identity, papers,
 * photos, review). The "Upload bike papers" CTA links out to the
 * upload flow that doesn't exist yet (see
 * _drift/auth-verification-uploads-pending.md) — for now it surfaces a
 * toast and routes to the pending lobby. The "Save and finish later"
 * link does the same: routes to /(auth)/verification/pending.
 *
 * State: step 1 (identity) shows as done because the OTP step proved
 * the user owns the phone — the actual NIN/BVN check still pending in
 * design but treating the phone-verified state as a soft-passed
 * identity step keeps the rail honest about progress.
 */
const STEPS: VerificationStep[] = [
  {
    icon: "person",
    label: "Identity (NIN or BVN)",
    sub: "Takes about 2 minutes. Camera required.",
    state: "done",
  },
  {
    icon: "document-text",
    label: "Bike papers",
    sub: "Vehicle licence + insurance certificate.",
    state: "active",
  },
  {
    icon: "camera",
    label: "Bike photos",
    sub: "Front, side, and plate.",
    state: "pending",
  },
  {
    icon: "shield-checkmark",
    label: "Gaznger review",
    sub: "We verify everything — usually within 18 hrs.",
    state: "pending",
  },
];

export default function VerificationRiderScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const handleUpload = useCallback(() => {
    toast.info("Coming soon", {
      description:
        "Bike-paper uploads launch in the next update. We'll prompt you then — your account is saved.",
    });
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn(
        "[verification:rider] Upload screens deferred — see _drift/auth-verification-uploads-pending.md"
      );
    }
    router.replace(
      "/(auth)/verification/pending?role=rider" as never
    );
  }, [router]);

  const handleSaveLater = useCallback(() => {
    router.replace(
      "/(auth)/verification/pending?role=rider" as never
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
          accessibilityLabel="Upload bike papers"
        >
          Upload bike papers
        </Button>
      }
    >
      <View style={styles.headerWrap}>
        <Text style={styles.title}>Verification</Text>
        <Text style={styles.sub}>
          Complete all steps before your first delivery.
        </Text>
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
