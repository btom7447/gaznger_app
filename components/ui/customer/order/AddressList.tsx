import React, { useMemo } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";
import { Skeleton } from "@/components/ui/primitives";

export interface AddressLite {
  id: string;
  label: string;
  line: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
}

interface AddressListProps {
  addresses: AddressLite[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
}

export default function AddressList({
  addresses,
  selectedId,
  onSelect,
  loading = false,
}: AddressListProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  if (loading) {
    return (
      <View style={styles.col}>
        {[0, 1].map((i) => (
          <Skeleton
            key={i}
            width="100%"
            height={72}
            borderRadius={theme.radius.lg}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.col}>
      {addresses.map((a) => {
        const isSel = a.id === selectedId;
        return (
          <Pressable
            key={a.id}
            onPress={() => onSelect(a.id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSel }}
            accessibilityLabel={`${a.label}: ${a.line}`}
            style={({ pressed }) => [
              styles.row,
              isSel && styles.rowSelected,
              pressed && { opacity: 0.9 },
            ]}
          >
            <View
              style={[
                styles.iconTile,
                {
                  backgroundColor: isSel ? theme.surface : theme.bgMuted,
                },
              ]}
            >
              <Ionicons
                name={a.icon ?? "location-outline"}
                size={18}
                color={isSel ? theme.primary : theme.fgMuted}
              />
            </View>
            <View style={styles.body}>
              <Text style={styles.label} numberOfLines={1}>
                {a.label}
              </Text>
              <Text style={styles.line} numberOfLines={1}>
                {a.line}
              </Text>
            </View>
            <View
              style={[
                styles.dot,
                {
                  borderColor: isSel ? theme.primary : theme.borderStrong,
                  backgroundColor: isSel ? theme.primary : "transparent",
                },
              ]}
            >
              {isSel ? (
                <Ionicons name="checkmark" size={12} color="#fff" />
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    col: { gap: theme.space.s2 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s3,
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: theme.radius.lg,
      paddingHorizontal: theme.space.s3 + 2,
      paddingVertical: theme.space.s3,
    },
    rowSelected: {
      backgroundColor: theme.primaryTint,
      borderColor: theme.primary,
      borderWidth: 1.5,
    },
    iconTile: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    body: { flex: 1, gap: 2 },
    label: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "800",
    },
    line: {
      ...theme.type.caption,
      color: theme.fgMuted,
    },
    dot: {
      width: 22,
      height: 22,
      borderRadius: theme.radius.pill,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
    },
  });
