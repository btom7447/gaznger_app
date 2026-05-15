import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";

/**
 * Tappable nav row for profile / settings surfaces.
 *
 *   [icon disc]  Title              chevron
 *                Optional sub
 *
 * Tone-tinted icon. `value` shows a right-side metric (e.g. "3
 * stations") instead of the chevron when present.
 */
export interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconTone?: "neutral" | "primary" | "success" | "warning" | "error" | "info";
  title: string;
  sub?: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
}

function iconColors(
  theme: Theme,
  tone: NonNullable<SettingsRowProps["iconTone"]>,
) {
  switch (tone) {
    case "primary":
      return { bg: theme.primaryTint, fg: theme.primary };
    case "success":
      return { bg: theme.successTint, fg: theme.success };
    case "warning":
      return { bg: theme.warningTint, fg: theme.warning };
    case "error":
      return { bg: theme.errorTint, fg: theme.error };
    case "info":
      return { bg: theme.infoTint, fg: theme.info };
    case "neutral":
    default:
      return { bg: theme.bgMuted, fg: theme.fgMuted };
  }
}

export default function SettingsRow({
  icon,
  iconTone = "neutral",
  title,
  sub,
  value,
  onPress,
  destructive,
}: SettingsRowProps) {
  const theme = useTheme();
  const tone = iconColors(theme, destructive ? "error" : iconTone);
  const styles = useMemo(() => makeStyles(theme, tone), [theme, tone]);

  const body = (
    <>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={18} color={tone.fg} />
      </View>
      <View style={styles.text}>
        <Text
          style={[styles.title, destructive && { color: theme.error }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {sub ? (
          <Text style={styles.sub} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={theme.fgSubtle} />
      )}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={sub ? `${title}, ${sub}` : title}
        style={({ pressed }) => [
          styles.row,
          pressed && { opacity: 0.92 },
        ]}
      >
        {body}
      </Pressable>
    );
  }
  return (
    <View style={styles.row} accessible accessibilityLabel={title}>
      {body}
    </View>
  );
}

const makeStyles = (
  theme: Theme,
  tone: { bg: string; fg: string },
) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      backgroundColor: theme.surface,
      borderRadius: theme.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: tone.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    text: { flex: 1, gap: 2 },
    title: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
    },
    sub: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    value: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      fontWeight: "700",
    },
  });
