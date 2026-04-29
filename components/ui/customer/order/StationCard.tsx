import React, { useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme, formatCurrency } from "@/constants/theme";

export interface StationCardData {
  id: string;
  name: string;
  shortName?: string;
  address: string;
  /** Distance in km. */
  distanceKm?: number;
  /** ETA in minutes. */
  etaMinutes?: number;
  /** Star rating (0–5). */
  rating?: number;
  /** Per-unit price in Naira (whole). */
  perUnit: number;
  /** Unit (`L` or `kg`). */
  unit: string;
  /** Verified partner flag. */
  verified?: boolean;
  /** Station logo / hero image (optional). */
  imageUrl?: string;
}

interface StationCardProps {
  station: StationCardData;
  selected: boolean;
  onPress: () => void;
}

export default function StationCard({
  station,
  selected,
  onPress,
}: StationCardProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const initials = (station.shortName ?? station.name)
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 4)
    .toUpperCase();

  // Track image load failures so we fall back to the initials tile.
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = !!station.imageUrl && !imgFailed;

  const a11y = `${station.name}${
    station.distanceKm != null ? `, ${station.distanceKm.toFixed(1)} km away` : ""
  }${
    station.etaMinutes != null ? `, ETA ${station.etaMinutes} minutes` : ""
  }${station.rating != null ? `, rating ${station.rating} stars` : ""}, ${formatCurrency(
    station.perUnit
  )} per ${station.unit}${station.verified ? ", verified partner" : ""}.`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={a11y}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
      ]}
    >
      <View style={styles.logoTile}>
        {showImage ? (
          <Image
            source={{ uri: station.imageUrl }}
            style={styles.logoImage}
            resizeMode="cover"
            onError={() => setImgFailed(true)}
            accessibilityLabel={`${station.name} logo`}
          />
        ) : (
          <Text style={styles.logoText}>{initials}</Text>
        )}
      </View>

      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text
            style={styles.name}
            numberOfLines={1}
          >
            {station.name}
          </Text>
          {station.verified ? (
            <View
              style={styles.verifiedBadge}
              accessibilityLabel="Verified partner station"
            >
              <Ionicons name="checkmark" size={10} color="#fff" />
            </View>
          ) : null}
        </View>
        <View style={styles.metaRow}>
          {station.distanceKm != null ? (
            <Text style={styles.meta} numberOfLines={1}>
              {station.distanceKm.toFixed(1)} km
            </Text>
          ) : null}
          {station.rating != null ? (
            <>
              <Text style={styles.metaDot}>·</Text>
              <Ionicons
                name="star"
                size={11}
                color={theme.accent}
                style={styles.starIcon}
              />
              <Text style={styles.meta} numberOfLines={1}>
                {station.rating.toFixed(1)}
              </Text>
            </>
          ) : null}
          {station.etaMinutes != null ? (
            <>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.meta} numberOfLines={1}>
                ~{station.etaMinutes} min
              </Text>
            </>
          ) : null}
        </View>
      </View>

      <View style={styles.priceCol}>
        <Text style={styles.priceMain}>{formatCurrency(station.perUnit)}</Text>
        <Text style={styles.priceUnit}>per {station.unit}</Text>
      </View>
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
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
    cardSelected: {
      backgroundColor: theme.primaryTint,
      borderColor: theme.primary,
      borderWidth: 1.5,
    },
    logoTile: {
      width: 48,
      height: 48,
      borderRadius: theme.radius.md,
      backgroundColor: theme.bgMuted,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    logoImage: {
      width: "100%",
      height: "100%",
    },
    logoText: {
      ...theme.type.micro,
      fontSize: 11,
      letterSpacing: 0.4,
      color: theme.fgMuted,
      fontWeight: "800",
    },
    info: { flex: 1, gap: 2 },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    name: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
      flexShrink: 1,
    },
    verifiedBadge: {
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: theme.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      flexWrap: "wrap",
    },
    meta: {
      ...theme.type.caption,
      color: theme.fgMuted,
    },
    metaDot: {
      ...theme.type.caption,
      color: theme.fgMuted,
    },
    starIcon: {
      marginLeft: 2,
    },
    priceCol: {
      alignItems: "flex-end",
    },
    priceMain: {
      ...theme.type.body,
      ...theme.type.money,
      color: theme.fg,
      fontWeight: "800",
    },
    priceUnit: {
      ...theme.type.caption,
      color: theme.fgMuted,
    },
  });
