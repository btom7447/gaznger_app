import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Theme, useTheme } from "@/constants/theme";

export type SelectCardVariant =
  | "fuel"
  | "address-type"
  | "service-type"
  | "cylinder-size"
  | "generic";

interface SelectCardProps {
  variant?: SelectCardVariant;
  selected: boolean;
  onPress: () => void;
  /** Leading icon node — already rendered (e.g., a tile with an Ionicon inside). */
  icon?: React.ReactNode;
  label: string;
  sublabel?: string;
  /** Right-side meta — e.g., distance/price (Stations). */
  meta?: React.ReactNode;
  disabled?: boolean;
  disabledReason?: string;
  accessibilityLabel?: string;
  style?: ViewStyle;
}

/**
 * Single source for selectable cards across Order/Delivery/Stations.
 * Replaces SelectService, CylinderTypeSelect, DeliveryTypeSelect, DeliveryLocationSelect.
 */
export default function SelectCard({
  variant = "generic",
  selected,
  onPress,
  icon,
  label,
  sublabel,
  meta,
  disabled = false,
  disabledReason,
  accessibilityLabel,
  style,
}: SelectCardProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const isCenter =
    variant === "cylinder-size" || variant === "service-type" || variant === "fuel";

  return (
    <Pressable
      onPress={!disabled ? onPress : undefined}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={
        accessibilityLabel ??
        `${label}${sublabel ? `. ${sublabel}` : ""}${
          disabled && disabledReason ? `. ${disabledReason}` : ""
        }`
      }
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        disabled && styles.cardDisabled,
        pressed && !disabled && styles.cardPressed,
        isCenter && styles.cardCenter,
        style,
      ]}
    >
      {icon ? <View style={styles.iconWrap}>{icon}</View> : null}

      <View style={[styles.body, isCenter && styles.bodyCenter]}>
        <Text
          style={[
            styles.label,
            { color: disabled ? theme.fgMuted : theme.fg },
          ]}
          numberOfLines={2}
        >
          {label}
        </Text>
        {sublabel ? (
          <Text
            style={[styles.sublabel, { color: theme.fgMuted }]}
            numberOfLines={2}
          >
            {sublabel}
          </Text>
        ) : null}
        {disabled && disabledReason ? (
          <Text style={[styles.sublabel, { color: theme.fgMuted, marginTop: 4 }]}>
            {disabledReason}
          </Text>
        ) : null}
      </View>

      {meta ? <View style={styles.meta}>{meta}</View> : null}
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: theme.radius.lg,
      padding: theme.space.s3 + 2, // 14
      gap: theme.space.s3,
    },
    cardCenter: {
      alignItems: "center",
      justifyContent: "center",
    },
    cardSelected: {
      backgroundColor: theme.primaryTint,
      borderColor: theme.primary,
      borderWidth: 1.5,
    },
    cardPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    cardDisabled: { opacity: 0.5 },
    iconWrap: {},
    body: { flex: 1 },
    bodyCenter: { alignItems: "center", flex: 0 },
    label: {
      ...theme.type.body,
      fontWeight: "700",
    },
    sublabel: {
      ...theme.type.caption,
      marginTop: 2,
    },
    meta: { marginLeft: theme.space.s2 },
  });
