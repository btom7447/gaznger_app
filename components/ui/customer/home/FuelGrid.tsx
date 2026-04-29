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

export type FuelProduct = "liquid" | "lpg";

export interface FuelTile {
  /** Stable key (matches a server fuel id when wired). */
  id: string;
  /** Customer-facing short label (max 4 chars per spec). */
  label: string;
  /** Sublabel — fuel code or context. (Not shown on the card; used for a11y.) */
  sublabel: string;
  /** Drives router branching: liquid → Order; lpg → Order/lpg. */
  product: FuelProduct;
  /** Custom raster icon (assets/icons/fuel/*.png). */
  icon: ImageSourcePropType;
}

interface FuelGridProps {
  items: FuelTile[];
  onSelect: (item: FuelTile) => void;
}

/**
 * 4-up single row of fuel tiles. NO PRICE — per pricing rule.
 * Cards show icon + label only.
 */
export default function FuelGrid({ items, onSelect }: FuelGridProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => onSelect(item)}
          accessibilityRole="button"
          accessibilityLabel={`Order ${item.label}. ${item.sublabel}.`}
          accessibilityHint="Opens order screen"
          style={({ pressed }) => [
            styles.card,
            pressed && styles.cardPressed,
          ]}
        >
          <View style={styles.iconTile}>
            <Image
              source={item.icon}
              style={styles.iconImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.label} numberOfLines={1}>
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Default 4-tile customer set per direction.md/screen spec. */
export const DEFAULT_FUEL_TILES: FuelTile[] = [
  {
    id: "petrol",
    label: "Petrol",
    sublabel: "PMS",
    product: "liquid",
    icon: require("../../../../assets/icons/fuel/petrol-icon.png"),
  },
  {
    id: "lpg",
    label: "LPG",
    sublabel: "Cooking gas",
    product: "lpg",
    icon: require("../../../../assets/icons/fuel/gas-icon.png"),
  },
  {
    id: "diesel",
    label: "Diesel",
    sublabel: "AGO",
    product: "liquid",
    icon: require("../../../../assets/icons/fuel/diesel-icon.png"),
  },
  {
    id: "kero",
    label: "Kero",
    sublabel: "DPK",
    product: "liquid",
    icon: require("../../../../assets/icons/fuel/oil-icon.png"),
  },
];

const TILE_GAP = 8;

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    grid: {
      flexDirection: "row",
      flexWrap: "nowrap",
      gap: TILE_GAP,
    },
    card: {
      flex: 1,
      paddingVertical: theme.space.s3,
      paddingHorizontal: theme.space.s2,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      alignItems: "center",
      gap: 10,
      minHeight: 100,
    },
    cardPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.98 }],
    },
    iconTile: {
      width: 52,
      height: 52,
      borderRadius: theme.radius.md,
      backgroundColor: theme.bgMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    iconImage: {
      width: 36,
      height: 36,
    },
    label: {
      ...theme.type.caption,
      color: theme.fg,
      fontWeight: "700",
    },
  });
