import React, { useMemo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme, formatCurrency } from "@/constants/theme";
import StationBadges from "./StationBadges";

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
  /** NMDPRA / admin-verified flag — independent of the Gaznger
   *  Partner programme. The list row surfaces both badges separately
   *  so the user can distinguish "trusted operator" from "in our paid
   *  partner tier". */
  verified?: boolean;
  /** Gaznger Partner programme — vendor opted into the paid plan,
   *  promo placement, etc. Same shield style, gold tint instead of
   *  primary green. */
  isPartner?: boolean;
  /** Station logo / hero image (optional, single). */
  imageUrl?: string;
  /** Multiple station photos for the detail-sheet photo strip. Falls
   *  back to a single placeholder SVG when empty. */
  images?: string[];
  /** Total number of customer ratings — shown as `(N reviews)` next to
   *  the star on the detail sheet. */
  totalRatings?: number;
  /** Vendor partner programme metadata — formatted "Mar 2026" string,
   *  derived from `partnerBadge.subscribedAt` on the server. */
  partnerSince?: string;
  /** Operating hours string (e.g. "06:00 – 22:00" or "24/7"). Surfaced
   *  as an amenity chip when set. */
  operatingHours?: string;
  /** Available products / fuel grades displayed as amenity chips. */
  availableFuels?: string[];
  /** Service-time copy ("~12 min from accept"). Amenity chip. */
  serviceTime?: string;
  /** Payment options accepted at the station. NO cash on delivery. */
  paymentOptions?: string[];
  /** Pre-formatted "X ago" string for last successful Gaznger dispense
   *  ("4 min ago", "2 hr ago"). Server timestamp converted in adapter. */
  lastDispenseAgo?: string;
  /** Rolling on-time rate, 0–100. Optional — first-timers have no data. */
  onTimeRate?: number;
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

/**
 * Per-unit price label — `Ltr` for liquid fuels, `Kg` for LPG. The raw
 * `unit` field on StationCardData is "L" or "kg" (canonical, lowercase
 * for kg); this helper produces a display-ready label so we don't render
 * a one-letter "l" that's hard to scan. Exported so the map view + any
 * other surface can render the same tag.
 */
export function formatUnit(unit: string): string {
  if (unit.toLowerCase() === "kg") return "Kg";
  return "Ltr";
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
  )} per ${formatUnit(station.unit)}${station.verified ? ", verified partner" : ""}.`;

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
      {/* Cover-image thumbnail — falls back to a monogram tile when the
          station has no `imageUrl`. The fallback uses the same
          primary-tinted bg + green700 text so the row layout looks
          uniform whether or not photos are available. */}
      <View style={styles.brandTile}>
        {station.imageUrl ? (
          <Image
            source={{ uri: station.imageUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        ) : (
          <Text style={styles.brandText}>{brandLetters(station)}</Text>
        )}
      </View>

      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {station.name}
          </Text>
          {/* Verified (shield) + partner (ribbon) badges. Star
              icon is reserved for rating display only — never reused
              as a status badge here. */}
          <StationBadges
            verified={station.verified}
            isPartner={station.isPartner}
          />
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
          {(station.verified || station.isPartner) ? (
            <>
              <Text style={styles.metaDot}>·</Text>
              <Text
                style={[styles.meta, { color: theme.primary, fontWeight: "700" }]}
                numberOfLines={1}
              >
                {station.verified && station.isPartner
                  ? "Verified · Partner"
                  : station.verified
                  ? "Verified"
                  : "Partner"}
              </Text>
            </>
          ) : null}
        </View>
      </View>

      <View style={styles.priceCol}>
        <Text style={styles.priceMain}>{formatCurrency(station.perUnit)}</Text>
        <Text style={styles.priceUnit}>per {formatUnit(station.unit)}</Text>
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
      overflow: "hidden",
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
