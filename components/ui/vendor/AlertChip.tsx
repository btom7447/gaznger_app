import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";

/**
 * Alert chip — full-width row with icon + title + sub + optional CTA.
 *
 * Vendor screens use these for dispatch warnings ("Pending > 90s"),
 * supply alerts ("Tank at 18% · restock soon"), info notices (low
 * balance), edge errors (plant rejected). Tone selects icon + colors.
 *
 * Terse copy convention: title is 1 short clause, sub adds one
 * factual second clause. The whole chip is tappable when `onPress`
 * is supplied — useful for "tap to assign" / "tap to top up".
 */
export type AlertTone = "warning" | "info" | "success" | "error" | "primary";

export interface AlertChipProps {
  tone?: AlertTone;
  /** Override the default tone icon. */
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  sub?: string;
  /** When set, the whole chip is pressable. */
  onPress?: () => void;
  /** Optional inline CTA label (right side). */
  cta?: string;
  /** A11y label override. */
  accessibilityLabel?: string;
}

function defaultIcon(tone: AlertTone): keyof typeof Ionicons.glyphMap {
  switch (tone) {
    case "warning":
      return "warning";
    case "info":
      return "information-circle";
    case "success":
      return "checkmark-circle";
    case "error":
      return "alert-circle";
    case "primary":
      return "flash";
  }
}

function paletteFor(theme: Theme, tone: AlertTone) {
  switch (tone) {
    case "warning":
      return { bg: theme.warningTint, fg: theme.warning, border: theme.warning + "33" };
    case "info":
      return { bg: theme.infoTint, fg: theme.info, border: theme.info + "33" };
    case "success":
      return { bg: theme.successTint, fg: theme.success, border: theme.success + "33" };
    case "error":
      return { bg: theme.errorTint, fg: theme.error, border: theme.error + "33" };
    case "primary":
      return { bg: theme.primaryTint, fg: theme.primary, border: theme.primary + "33" };
  }
}

export default function AlertChip({
  tone = "warning",
  icon,
  title,
  sub,
  onPress,
  cta,
  accessibilityLabel,
}: AlertChipProps) {
  const theme = useTheme();
  const palette = paletteFor(theme, tone);
  const iconName = icon ?? defaultIcon(tone);
  const styles = useMemo(
    () => makeStyles(theme, palette),
    [theme, palette],
  );

  const a11y = accessibilityLabel ?? (sub ? `${title}. ${sub}` : title);

  const body = (
    <>
      <View style={styles.iconWrap}>
        <Ionicons name={iconName} size={18} color={palette.fg} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {sub ? (
          <Text style={styles.sub} numberOfLines={2}>
            {sub}
          </Text>
        ) : null}
      </View>
      {cta ? (
        <Text style={[styles.cta, { color: palette.fg }]} numberOfLines={1}>
          {cta}
        </Text>
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        hitSlop={4}
        style={({ pressed }) => [
          styles.wrap,
          pressed && { opacity: 0.92 },
        ]}
      >
        {body}
      </Pressable>
    );
  }

  return (
    <View style={styles.wrap} accessible accessibilityLabel={a11y}>
      {body}
    </View>
  );
}

const makeStyles = (
  theme: Theme,
  palette: { bg: string; fg: string; border: string },
) =>
  StyleSheet.create({
    wrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: theme.radius.lg,
      backgroundColor: palette.bg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: palette.border,
    },
    iconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.surface + "DD",
      alignItems: "center",
      justifyContent: "center",
    },
    text: {
      flex: 1,
      gap: 2,
    },
    title: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
    },
    sub: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    cta: {
      ...theme.type.bodySm,
      fontWeight: "700",
    },
  });
