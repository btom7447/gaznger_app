import React, { useMemo } from "react";
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Theme, useTheme } from "@/constants/theme";

export interface OrderFuelTile {
  id: string;
  label: string;
  sublabel: string;
  icon: ImageSourcePropType;
}

interface FuelSelectGridProps {
  items: OrderFuelTile[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
}

/**
 * 2-column fuel grid for the Order screen.
 * Layered card layout: icon tile top-left, label below, sublabel below that.
 * Taller min-height matches the design.
 */
export default function FuelSelectGrid({
  items,
  selectedId,
  onSelect,
}: FuelSelectGridProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const rows: OrderFuelTile[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(items.slice(i, i + 2));
  }

  return (
    <View style={styles.col}>
      {rows.map((row, ri) => (
        <View key={`row-${ri}`} style={styles.row}>
          {row.map((item) => {
            const isSel = selectedId === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => onSelect(item.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSel }}
                accessibilityLabel={`${item.label}. ${item.sublabel}.`}
                style={({ pressed }) => [
                  styles.card,
                  isSel && styles.cardSelected,
                  pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
                ]}
              >
                <View
                  style={[
                    styles.iconTile,
                    isSel && { backgroundColor: theme.surface },
                  ]}
                >
                  <Image
                    source={item.icon}
                    style={styles.iconImage}
                    resizeMode="contain"
                  />
                </View>
                <View style={styles.labels}>
                  <Text
                    style={[
                      styles.label,
                      { color: isSel ? theme.primary : theme.fg },
                    ]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                  <Text style={styles.sublabel} numberOfLines={1}>
                    {item.sublabel}
                  </Text>
                </View>
              </Pressable>
            );
          })}
          {row.length === 1 ? <View style={styles.cell} /> : null}
        </View>
      ))}
    </View>
  );
}

/** Full 4-tile customer set per direction.md/screen spec. */
export const ALL_FUELS: OrderFuelTile[] = [
  {
    id: "petrol",
    label: "Petrol",
    sublabel: "PMS",
    icon: require("../../../../assets/icons/fuel/petrol-icon.png"),
  },
  {
    id: "lpg",
    label: "LPG",
    sublabel: "Cooking gas",
    icon: require("../../../../assets/icons/fuel/gas-icon.png"),
  },
  {
    id: "diesel",
    label: "Diesel",
    sublabel: "AGO",
    icon: require("../../../../assets/icons/fuel/diesel-icon.png"),
  },
  {
    id: "kero",
    label: "Kerosene",
    sublabel: "DPK",
    icon: require("../../../../assets/icons/fuel/oil-icon.png"),
  },
];

/** Back-compat alias for callers that imported LIQUID_FUELS. */
export const LIQUID_FUELS = ALL_FUELS.filter((f) => f.id !== "lpg");

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    col: { gap: theme.space.s2 + 2 }, // 10
    row: { flexDirection: "row", gap: theme.space.s2 + 2 },
    cell: { flex: 1 },
    card: {
      flex: 1,
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: theme.radius.lg,
      paddingHorizontal: theme.space.s4,
      paddingVertical: theme.space.s4,
      gap: theme.space.s3,
      minHeight: 138,
    },
    cardSelected: {
      backgroundColor: theme.primaryTint,
      borderColor: theme.primary,
      borderWidth: 1.5,
    },
    iconTile: {
      width: 48,
      height: 48,
      borderRadius: theme.radius.md,
      backgroundColor: theme.bgMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    iconImage: {
      width: 32,
      height: 32,
    },
    labels: { gap: 2 },
    label: {
      ...theme.type.body,
      fontWeight: "800",
    },
    sublabel: {
      ...theme.type.caption,
      color: theme.fgMuted,
    },
  });
