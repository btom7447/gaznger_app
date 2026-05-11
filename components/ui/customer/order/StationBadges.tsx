import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";

/**
 * Station status badges. Two distinct icons + the rating star — never
 * conflated:
 *   - Verified (NMDPRA / admin-verified) → shield-checkmark, primary green.
 *   - Gaznger Partner → ribbon glyph, gold accent. Same icon legacy
 *     vendor surfaces use for the partner badge, so users see one
 *     consistent symbol across the app.
 *   - Rating uses the star elsewhere — it's NEVER a status badge in
 *     this component, so callers can safely use `star` for rating.
 *
 * Per UX direction the badges render as bare icons in the row layout
 * (no circle tile) so they read as status flags, not extra dots.
 * `compact` reduces icon size from 14px to 12px for tight rows.
 */

export interface StationBadgesProps {
  verified?: boolean;
  isPartner?: boolean;
  /** Compact (12px) for bottom-sheet rows, regular (14px) elsewhere. */
  compact?: boolean;
}

export default function StationBadges({
  verified,
  isPartner,
  compact = false,
}: StationBadgesProps) {
  const theme = useTheme();
  const styles = useMemo(
    () => makeStyles(theme, compact),
    [theme, compact]
  );

  if (!verified && !isPartner) return null;
  const iconSize = compact ? 12 : 14;
  const goldColor =
    theme.mode === "dark" ? theme.palette.gold300 : theme.palette.gold700;

  return (
    <View style={styles.row}>
      {verified ? (
        <Ionicons
          name="shield-checkmark"
          size={iconSize}
          color={theme.primary}
          accessibilityLabel="NMDPRA-verified station"
        />
      ) : null}
      {isPartner ? (
        <Ionicons
          name="ribbon"
          size={iconSize}
          color={goldColor}
          accessibilityLabel="Gaznger Partner station"
        />
      ) : null}
    </View>
  );
}

const makeStyles = (_theme: Theme, _compact: boolean) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
  });
