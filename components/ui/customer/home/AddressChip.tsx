import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";

interface AddressChipProps {
  /** Default address label (e.g. "Home"). Null/undefined → "Add an address" CTA. */
  address: string | null;
  /** Optional secondary line (e.g. street + city). */
  subLabel?: string | null;
  onPress?: () => void;
}

/**
 * "DELIVER TO" pill on Home.
 * When no address: shows a primary-fill CTA tile prompting to add one.
 */
export default function AddressChip({ address, subLabel, onPress }: AddressChipProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const empty = !address;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        empty
          ? "Add an address."
          : `Deliver to ${address}. Tap to change.`
      }
      style={({ pressed }) => [
        styles.chip,
        empty && styles.chipEmpty,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Ionicons
        name={empty ? "add-circle" : "location"}
        size={20}
        color={empty ? theme.fgOnPrimary : theme.primary}
      />
      <View style={styles.body}>
        {empty ? (
          <Text style={[styles.label, { color: theme.fgOnPrimary }]}>
            Add an address
          </Text>
        ) : (
          <>
            <Text style={[styles.eyebrow, { color: theme.fgMuted }]}>
              DELIVER TO
            </Text>
            <Text
              style={[styles.label, { color: theme.fg }]}
              numberOfLines={1}
            >
              {address}
            </Text>
            {subLabel ? (
              <Text
                style={[styles.sub, { color: theme.fgMuted }]}
                numberOfLines={1}
              >
                {subLabel}
              </Text>
            ) : null}
          </>
        )}
      </View>
      {!empty ? (
        <Ionicons name="chevron-down" size={18} color={theme.fgMuted} />
      ) : null}
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    chip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.bgMuted,
      borderRadius: theme.radius.lg,
      paddingHorizontal: theme.space.s3,
      paddingVertical: theme.space.s2 + 2,
      gap: theme.space.s2 + 2,
    },
    chipEmpty: {
      backgroundColor: theme.primary,
    },
    body: { flex: 1 },
    eyebrow: {
      ...theme.type.micro,
    },
    label: {
      ...theme.type.body,
      fontWeight: "700",
      marginTop: 2,
    },
    sub: {
      ...theme.type.caption,
      marginTop: 1,
    },
  });
