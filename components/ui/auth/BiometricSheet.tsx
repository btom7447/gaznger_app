import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";
import type { BiometricType } from "@/lib/permissions";

interface Props {
  kind: BiometricType;
  /** Tap "Use PIN instead". */
  onUsePin: () => void;
  /** Optional retry button — visible after a fail. */
  onRetry?: () => void;
}

/**
 * Visual scaffold for the biometric prompt screen. The actual OS
 * sheet (Face ID / Touch ID dialog) is drawn by the OS itself when
 * `authenticateBiometric` runs; this component renders the dimmed
 * page background + the "Use PIN instead" fallback row that's
 * always present in our UI even when the OS prompt is dismissed.
 *
 * On iOS we render copy that matches the system label; on Android
 * we keep it generic since the OS draws its own fingerprint sheet.
 */
export default function BiometricSheet({ kind, onUsePin, onRetry }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const isFace = kind === "face";

  return (
    <View style={styles.sheet}>
      <View style={styles.iconBubble}>
        <Ionicons
          name={isFace ? "scan-outline" : "finger-print"}
          size={40}
          color={theme.primary}
        />
      </View>
      <Text style={styles.title}>
        {isFace ? "Face ID for Gaznger" : "Fingerprint for Gaznger"}
      </Text>
      <Text style={styles.body}>
        {isFace
          ? "Look at your phone to unlock."
          : "Touch the sensor to unlock."}
      </Text>
      <View style={styles.divider} />
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Try again"
          style={({ pressed }) => [pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.retryLink}>Try again</Text>
        </Pressable>
      ) : null}
      <Pressable
        onPress={onUsePin}
        accessibilityRole="button"
        accessibilityLabel="Use PIN instead"
        style={({ pressed }) => [pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.fallbackLink}>Use PIN instead</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    sheet: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      paddingHorizontal: theme.space.s5,
      paddingTop: theme.space.s5 + 4,
      paddingBottom: theme.space.s5,
      alignItems: "center",
      gap: theme.space.s3 + 2,
      ...theme.elevation.modal,
    },
    iconBubble: {
      width: 76,
      height: 76,
      borderRadius: 38,
      backgroundColor: theme.primaryTint,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      ...theme.type.bodyLg,
      color: theme.fg,
      fontWeight: "800",
      textAlign: "center",
    },
    body: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      textAlign: "center",
    },
    divider: {
      width: "100%",
      height: 1,
      backgroundColor: theme.divider,
      marginVertical: theme.space.s2,
    },
    retryLink: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
    },
    fallbackLink: {
      ...theme.type.body,
      color: theme.primary,
      fontWeight: "700",
    },
  });
