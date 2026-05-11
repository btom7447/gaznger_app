import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  selected: boolean;
  /** Use this option as the recommended/highlighted choice on first render. */
  onPress: () => void;
  disabled?: boolean;
}

/**
 * Face / Touch / PIN-only choice row on the Security Setup screen.
 * Same visual language as RoleSelectCard (icon tile + body + radio
 * dot) but smaller — 14pt label, 12pt sub.
 */
export default function SecurityOptionCard({
  icon,
  label,
  sub,
  selected,
  onPress,
  disabled = false,
}: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <Pressable
      onPress={!disabled ? onPress : undefined}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${label}. ${sub}`}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        disabled && { opacity: 0.5 },
        pressed && !disabled && { opacity: 0.92 },
      ]}
    >
      <View style={[styles.iconTile, selected && styles.iconTileSelected]}>
        <Ionicons
          name={icon}
          size={22}
          color={selected ? theme.fgOnPrimary : theme.fgMuted}
        />
      </View>
      <View style={styles.body}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.radioInner} /> : null}
      </View>
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s3 + 2,
      padding: theme.space.s4,
      borderRadius: theme.radius.lg,
      borderWidth: 2,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    cardSelected: {
      borderColor: theme.primary,
      backgroundColor: theme.primaryTint,
    },
    iconTile: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.md,
      backgroundColor: theme.bgMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    iconTileSelected: {
      backgroundColor: theme.primary,
    },
    body: {
      flex: 1,
      gap: 2,
    },
    label: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "800",
      fontSize: 14,
    },
    sub: {
      ...theme.type.caption,
      color: theme.fgMuted,
    },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
    },
    radioSelected: {
      borderColor: theme.primary,
      backgroundColor: theme.primary,
    },
    radioInner: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.fgOnPrimary,
    },
  });
