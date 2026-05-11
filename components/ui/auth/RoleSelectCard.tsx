import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";

export type Role = "customer" | "rider" | "vendor";

interface RoleSelectCardProps {
  role: Role;
  selected: boolean;
  onPress: () => void;
}

/**
 * Role select card with radio dot. Composes its own layout (icon tile
 * + body + radio) rather than wrapping `SelectCard` because the radio
 * + tinted icon-tile combo is specific to this surface — wrapping
 * would require a tail of escape-hatch props that erode SelectCard's
 * shape. Token-pure: every color/space/radius/type sources from theme.
 */
const ROLE_META: Record<
  Role,
  {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    sub: string;
  }
> = {
  customer: {
    icon: "flame",
    title: "Customer",
    sub: "Order petrol, diesel, kerosene, or LPG to your door.",
  },
  rider: {
    icon: "bicycle",
    title: "Rider / Dispatch",
    sub: "Earn by collecting and delivering fuel orders.",
  },
  vendor: {
    icon: "business",
    title: "Station owner",
    sub: "List your station, set prices, and receive orders.",
  },
};

export default function RoleSelectCard({
  role,
  selected,
  onPress,
}: RoleSelectCardProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const meta = ROLE_META[role];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${meta.title}. ${meta.sub}`}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && { opacity: 0.92 },
      ]}
    >
      <View style={[styles.iconTile, selected && styles.iconTileSelected]}>
        <Ionicons
          name={meta.icon}
          size={22}
          color={selected ? theme.fgOnPrimary : theme.fgMuted}
        />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{meta.title}</Text>
        <Text style={styles.sub} numberOfLines={2}>
          {meta.sub}
        </Text>
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
      alignItems: "flex-start",
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
      gap: 3,
    },
    title: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "800",
      fontSize: 15,
    },
    sub: {
      ...theme.type.caption,
      color: theme.fgMuted,
      lineHeight: 17,
    },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
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
