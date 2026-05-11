import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { Marker } from "react-native-maps";
import { Theme, useTheme } from "@/constants/theme";

/**
 * react-native-maps caches custom-view markers as bitmaps. If we
 * mount with `tracksViewChanges={false}` the very first frame is
 * what gets captured — and on Android that's often a 0×0 view
 * (children haven't laid out yet) so the pin renders as nothing.
 *
 * Workaround used by every nontrivial RN-Maps app: track view
 * changes for the first 600 ms, then turn it off. Long enough for
 * Ionicons to load + the bubble to lay out; short enough that
 * we're never paying the per-frame redraw cost during pan/zoom.
 */
function useInitialTracksViewChanges(durationMs = 600): boolean {
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setTracks(false), durationMs);
    return () => clearTimeout(t);
  }, [durationMs]);
  return tracks;
}

/**
 * Semantic map pins for the Track screens — used by both customer and
 * rider views so the two reads as one shared map of the trip.
 *
 * Pin glyphs:
 *   - Rider:       motorbike (MaterialCommunityIcons) — green-on-white
 *                  bubble. Static; pulse halo lives map-native via
 *                  Circle so the bitmap stays sharp on Android.
 *   - Station:     local-gas-station (MaterialIcons) — same primary
 *                  green tint as the rider screen used pre-refactor.
 *   - Destination: dynamic Ionicon glyph from the saved address
 *                  (home / briefcase / location-sharp / …) — matches
 *                  the icon the customer chose in their address book.
 *
 * All three share a balloon shape (round bubble + triangular tail) so
 * they read as a single set. The bubble border colour codes the
 * semantic role: primary green for station, red for destination,
 * green for rider.
 *
 * `tracksViewChanges={false}` everywhere — these are static pins and
 * react-native-maps caches them as bitmaps. Setting `true` forces a
 * per-frame re-render which tanks scroll perf on Android. The rider
 * pin's coord change is handled by the parent re-keying with the
 * latitude in the key prop, which forces a fresh native marker.
 */

interface PinProps {
  coordinate: { latitude: number; longitude: number };
}

/* ─────────────────────────── Station ─────────────────────────── */
export function StationMapPin({ coordinate }: PinProps) {
  const theme = useTheme();
  const styles = pinStyles(theme);
  const tracks = useInitialTracksViewChanges();
  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={tracks}
      accessibilityLabel="Station"
    >
      <View style={styles.wrapper}>
        <View
          style={[
            styles.bubble,
            { borderColor: theme.primary, borderWidth: 1.5 },
          ]}
        >
          <MaterialIcons
            name="local-gas-station"
            size={16}
            color={theme.primary}
          />
        </View>
        <View style={[styles.tail, { borderTopColor: theme.primary }]} />
      </View>
    </Marker>
  );
}

/* ─────────────────────────── Destination ─────────────────────────── */

/**
 * Destination pin — uses the saved address's icon glyph
 * (home-outline, briefcase-outline, etc.) so the customer's view of
 * "where my fuel is going" matches the address-book entry exactly.
 * Falls back to `location-sharp` when no icon is set on the saved
 * address (legacy data, GPS-only addresses).
 */
export function DestinationMapPin({
  coordinate,
  iconName,
}: PinProps & {
  /** Ionicon glyph from saved address. Defaults to location-sharp. */
  iconName?: string;
}) {
  const theme = useTheme();
  const styles = pinStyles(theme);
  // Border + glyph share the same red so the destination always
  // reads as the "go here" target. Picked dark red rather than the
  // theme's `error` so it doesn't conflate with error states.
  const accent = "#1A6B1A";
  const tracks = useInitialTracksViewChanges();
  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={tracks}
      accessibilityLabel="Delivery location"
    >
      <View style={styles.wrapper}>
        <View
          style={[
            styles.bubble,
            { borderColor: accent, borderWidth: 1.5 },
          ]}
        >
          <Ionicons
            name={(iconName ?? "location-sharp") as never}
            size={17}
            color={accent}
          />
        </View>
        <View style={[styles.tail, { borderTopColor: accent }]} />
      </View>
    </Marker>
  );
}

/* ─────────────────────────── Rider ─────────────────────────── */

/**
 * Rider pin — motorbike glyph in a primary-tinted circle. Static
 * bitmap (no Reanimated children) so react-native-maps captures the
 * full marker on first paint without needing tracksViewChanges. The
 * "live" feel comes from a separate map-native Circle pulse drawn by
 * the parent screen — same trick used on the Stations halo.
 *
 * `keyId` is consumed by the parent to force a fresh native marker
 * when the coordinate changes (Android caches markers aggressively).
 * Pass the rider's lat or a coord hash as the React `key` on this
 * component from the parent.
 */
export function RiderMapPin({ coordinate }: PinProps) {
  const theme = useTheme();
  const styles = pinStyles(theme);
  const tracks = useInitialTracksViewChanges();
  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracks}
      flat
      accessibilityLabel="Rider location"
    >
      <View style={styles.riderRing}>
        <View style={styles.riderTile}>
          <MaterialCommunityIcons
            name="motorbike"
            size={16}
            color={theme.fgOnPrimary}
          />
        </View>
      </View>
    </Marker>
  );
}

const pinStyles = (theme: Theme) =>
  StyleSheet.create({
    wrapper: {
      alignItems: "center",
    },
    bubble: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "#fff",
      alignItems: "center",
      justifyContent: "center",
      ...theme.elevation.card,
    },
    tail: {
      width: 0,
      height: 0,
      borderLeftWidth: 5,
      borderRightWidth: 5,
      borderTopWidth: 8,
      borderLeftColor: "transparent",
      borderRightColor: "transparent",
      marginTop: -1,
    },
    /** Rider — circular tile with a thicker white halo so it reads as
     *  "moving" against any map background. */
    riderRing: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "#fff",
      alignItems: "center",
      justifyContent: "center",
      ...theme.elevation.card,
    },
    riderTile: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
    },
  });
