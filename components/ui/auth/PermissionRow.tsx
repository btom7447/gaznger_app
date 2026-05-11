import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  /** Adds a "Required" pill next to the label. */
  required?: boolean;
}

/**
 * Permissions priming list row. Read-only — actual prompt fires when
 * the user taps the screen-level "Allow and continue" CTA.
 */
export default function PermissionRow({
  icon,
  label,
  sub,
  required = false,
}: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.card}>
      <View style={styles.iconTile}>
        <Ionicons name={icon} size={20} color={theme.primary} />
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.label}>{label}</Text>
          {required ? (
            <View style={styles.pill}>
              <Text style={styles.pillText}>Required</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.sub}>{sub}</Text>
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.space.s3 + 2,
      paddingHorizontal: theme.space.s4,
      paddingVertical: theme.space.s3 + 2,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.surface,
    },
    iconTile: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.md,
      backgroundColor: theme.bgMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    body: {
      flex: 1,
      gap: 3,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s2,
    },
    label: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "800",
      fontSize: 14,
    },
    pill: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.primaryTint,
    },
    pillText: {
      ...theme.type.micro,
      color: theme.primary,
    },
    sub: {
      ...theme.type.caption,
      color: theme.fgMuted,
      lineHeight: 17,
    },
  });
