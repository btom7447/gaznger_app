import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
  /**
   * Geo coordinates (decimal degrees). Required for the Map view so
   * pins land on real station locations. The List view ignores these.
   */
  lat?: number;
  lng?: number;
}

interface StationCardProps {
  station: StationCardData;
  selected: boolean;
  onPress: () => void;
}

/**
 * Pull a 2-letter brand monogram off a station name. We slice the
 * shortName when supplied, otherwise the full name; non-alphanum
 * characters are stripped so "TotalEnergies" → "TO" not "TO" with
 * the leading dot the regex would have left.
 */
function brandLetters(s: { shortName?: string; name: string }): string {
  const source = s.shortName ?? s.name;
  return source.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase();
}

export default function StationCard({
  station,
  selected,
  onPress,
}: StationCardProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const a11y = `${station.name}${
    station.distanceKm != null ? `, ${station.distanceKm.toFixed(1)} km away` : ""
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
      {/* Brand-letter tile — primary-tinted bg + green700 text. We
          intentionally don't render `imageUrl` logos here because the
          v3 design uses uniform brand letters across rows for visual
          rhythm, regardless of whether the station has a logo. */}
      <View style={styles.brandTile}>
        <Text style={styles.brandText}>{brandLetters(station)}</Text>
      </View>

      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
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
              <View style={styles.ratingPill}>
                <Ionicons
                  name="star"
                  size={10}
                  color={
                    theme.mode === "dark"
                      ? theme.palette.gold300
                      : theme.palette.gold700
                  }
                />
                <Text style={styles.meta} numberOfLines={1}>
                  {station.rating.toFixed(1)}
                </Text>
              </View>
            </>
          ) : null}
        </View>
      </View>

      <View style={styles.priceCol}>
        <Text style={styles.priceMain}>{formatCurrency(station.perUnit)}</Text>
        <Text style={styles.priceUnit}>per {station.unit.toLowerCase()}</Text>
      </View>
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    /**
     * v3 station card. 14px padding, 14px radius, 1.5px border that
     * flips to primary green on selection (no background tint — the
     * border alone carries the selection state).
     */
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: theme.surface,
      borderColor: theme.divider,
      borderWidth: 1.5,
      borderRadius: 14,
      padding: 14,
    },
    cardSelected: {
      borderColor: theme.primary,
    },
    brandTile: {
      width: 44,
      height: 44,
      borderRadius: 11,
      backgroundColor: theme.primaryTint,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    brandText: {
      fontSize: 13,
      fontWeight: "800",
      color: theme.mode === "dark" ? "#fff" : theme.palette.green700,
    },
    info: { flex: 1, minWidth: 0, gap: 2 },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 2,
    },
    name: {
      fontSize: 14,
      fontWeight: "800",
      color: theme.fg,
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
      gap: 6,
    },
    meta: {
      fontSize: 11.5,
      color: theme.fgMuted,
    },
    metaDot: {
      fontSize: 11.5,
      color: theme.fgMuted,
    },
    ratingPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
    },
    priceCol: {
      alignItems: "flex-end",
    },
    priceMain: {
      fontSize: 16,
      fontWeight: "800",
      color: theme.fg,
      ...theme.type.money,
    },
    priceUnit: {
      fontSize: 10,
      color: theme.fgMuted,
      marginTop: 1,
    },
  });
