import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";
import { ServiceType } from "@/store/useOrderStore";

interface LpgServicePickerProps {
  value: ServiceType | null;
  onChange: (v: ServiceType) => void;
}

/**
 * LPG service mode picker — Refill (in-place top-up) vs Cylinder swap.
 * 2-column row of cards with checkmark badge top-right on the selected card.
 */
export default function LpgServicePicker({ value, onChange }: LpgServicePickerProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.row}>
      <ServiceCard
        selected={value === "refill"}
        onPress={() => onChange("refill")}
        icon="flame"
        title="Refill"
        sublabel="Top up your cylinder"
      />
      <ServiceCard
        selected={value === "swap"}
        onPress={() => onChange("swap")}
        icon="refresh-outline"
        title="Cylinder swap"
        sublabel="Trade in for a full one"
      />
    </View>
  );
}

function ServiceCard({
  selected,
  onPress,
  icon,
  title,
  sublabel,
}: {
  selected: boolean;
  onPress: () => void;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  sublabel: string;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}. ${sublabel}.`}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
      ]}
    >
      <View style={styles.iconTile}>
        <Ionicons
          name={icon}
          size={20}
          color={selected ? theme.primary : theme.fgMuted}
        />
      </View>
      <Text
        style={[
          styles.title,
          { color: selected ? theme.primary : theme.fg },
        ]}
        numberOfLines={1}
      >
        {title}
      </Text>
      <Text style={styles.sublabel} numberOfLines={1}>
        {sublabel}
      </Text>
      {selected ? (
        <View style={styles.check}>
          <Ionicons name="checkmark" size={12} color="#fff" />
        </View>
      ) : null}
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: { flexDirection: "row", gap: theme.space.s2 },
    card: {
      flex: 1,
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: theme.radius.lg,
      padding: theme.space.s3 + 2,
      gap: 6,
      minHeight: 110,
    },
    cardSelected: {
      backgroundColor: theme.primaryTint,
      borderColor: theme.primary,
      borderWidth: 1.5,
    },
    iconTile: {
      width: 32,
      height: 32,
      borderRadius: theme.radius.md,
      backgroundColor: theme.bgMuted,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 2,
    },
    title: {
      ...theme.type.body,
      fontWeight: "800",
    },
    sublabel: {
      ...theme.type.caption,
      color: theme.fgMuted,
    },
    check: {
      position: "absolute",
      top: 10,
      right: 10,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
    },
  });
