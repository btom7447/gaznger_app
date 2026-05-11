import React, { useCallback, useMemo, useRef } from "react";
import { InteractionManager, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme, formatCurrency } from "@/constants/theme";
import { api } from "@/lib/api";
import { Station } from "@/types";
import StationPhotoStrip from "./StationPhotoStrip";

/**
 * "Let Gaznger Choose" — partner-weighted auto-pick.
 *
 * Three pieces live here so callers can compose them per surface:
 *   - GaznerChooseCard  : list-view banner (full-width primary card).
 *   - GaznerChoosePill  : map-view floating pill (compact, primary).
 *   - GaznerChoosePickedSheet : result sheet shown after a successful
 *     auto-pick; renders a hero photo + 3 reasoning rows + Use/Cancel.
 *
 * The hook `useGaznerAutoPick` wraps the POST /api/stations/auto-pick
 * call so callers don't repeat the body shape + error-stash logic.
 */

export interface AutoPickResult {
  station: Station & {
    isPartner?: boolean;
    distance?: number;
    etaMinutes?: number;
  };
  reasons: string[];
  score: number;
  pool: number;
  usedPartnerFilter: boolean;
}

export interface AutoPickArgs {
  lat: number;
  lng: number;
  radiusKm?: number;
  fuelTypeId?: string;
}

export async function fetchAutoPick(args: AutoPickArgs): Promise<AutoPickResult> {
  return api.post<AutoPickResult>("/api/stations/auto-pick", args, {
    timeoutMs: 12000,
  });
}

/* ─────────────────────────── Banner ─────────────────────────── */

/**
 * List-view promo banner. Sits ABOVE the sort chips so it's the first
 * thing users see when the list view loads. Dark green primary fill +
 * sparkles + BETA tag mirroring rev3 lines 297-340.
 */
export function GaznerChooseCard({
  onPress,
  loading,
  disabled,
}: {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const styles = useMemo(() => bannerStyles(theme), [theme]);
  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel="Let Gaznger choose the best station"
      style={({ pressed }) => [
        styles.card,
        pressed && { opacity: 0.94 },
        disabled && { opacity: 0.6 },
      ]}
    >
      <SparklesBackdrop />
      <View style={styles.iconTile}>
        <Ionicons name="sparkles" size={22} color="#fff" />
      </View>
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Let Gaznger choose</Text>
          <View style={styles.betaTag}>
            <Text style={styles.betaText}>BETA</Text>
          </View>
        </View>
        <Text style={styles.sub} numberOfLines={2}>
          Best mix of price, ETA & reliability — picks from verified partners first.
        </Text>
      </View>
      <View style={styles.tryPill}>
        <Text style={styles.tryText}>{loading ? "Picking…" : "Try it"}</Text>
        <Ionicons name="chevron-forward" size={13} color={theme.palette.green700} />
      </View>
    </Pressable>
  );
}

/* ─────────────────────────── Floating pill ─────────────────────────── */

/** Map-view variant — compact pill that floats over the map. */
export function GaznerChoosePill({
  onPress,
  loading,
  disabled,
}: {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const styles = useMemo(() => pillStyles(theme), [theme]);
  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel="Let Gaznger choose the best station"
      style={({ pressed }) => [
        styles.pill,
        pressed && { opacity: 0.92 },
        disabled && { opacity: 0.6 },
      ]}
    >
      <Ionicons name="sparkles" size={14} color="#fff" />
      <Text style={styles.text}>{loading ? "Picking…" : "Let Gaznger choose"}</Text>
      <View style={styles.betaTag}>
        <Text style={styles.betaText}>BETA</Text>
      </View>
    </Pressable>
  );
}

/* ─────────────────────────── Picked sheet body ─────────────────────────── */

/**
 * Body content for the BottomSheetModal that shows after a successful
 * auto-pick. Keep this pure-render so callers own the sheet ref +
 * snap behaviour. The "Use this station" CTA promotes the picked
 * station to selectedId via the parent's onSelect.
 */
export function GaznerChoosePickedBody({
  result,
  onUse,
  onPickAnother,
}: {
  result: AutoPickResult;
  onUse: () => void;
  onPickAnother: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => pickedStyles(theme), [theme]);
  const s = result.station;

  // Resolve a representative perUnit for the price line. The server
  // doesn't echo a single canonical price; we surface the cheapest
  // available fuel as a reasonable summary.
  const perUnit = useMemo(() => {
    const prices = (s.fuels ?? [])
      .map((f) => f.pricePerUnit)
      .filter((p) => typeof p === "number" && p > 0);
    return prices.length ? Math.min(...prices) : 0;
  }, [s.fuels]);

  // Press lag fix: synchronously dismissing the sheet AND running the
  // parent callback in the same frame stutters because the parent's
  // state update re-renders this body just as the sheet animation
  // starts. The `firedRef` blocks duplicate taps; the InteractionManager
  // defers the callback to after the dismiss animation completes so
  // there's no contention for the JS thread.
  const firedRef = useRef(false);
  const handleUse = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    InteractionManager.runAfterInteractions(() => {
      onUse();
      // Reset on next mount via key prop change; we don't reset here
      // because the sheet is closing.
    });
  }, [onUse]);
  const handlePickAnother = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    InteractionManager.runAfterInteractions(() => {
      onPickAnother();
    });
  }, [onPickAnother]);

  return (
    <View style={styles.root}>
      <View style={styles.eyebrowRow}>
        <Ionicons name="sparkles" size={14} color={theme.primary} />
        <Text style={styles.eyebrow}>Picked by Gaznger</Text>
      </View>

      {/* Prefer the multi-image strip when the station has uploaded
          one; fall back to the single hero `image` so seeded stations
          (which only set `image`) still show real photos. The SVG
          placeholder only appears when the station genuinely has no
          imagery at all. */}
      <StationPhotoStrip
        images={
          s.images && s.images.length > 0
            ? s.images
            : s.image
            ? [s.image]
            : undefined
        }
        height={140}
      />

      <View style={styles.heroRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.heroName} numberOfLines={1}>
            {s.name}
          </Text>
          <Text style={styles.heroAddress} numberOfLines={2}>
            {s.address}
          </Text>
        </View>
        {perUnit > 0 ? (
          <View style={styles.priceCol}>
            <Text style={styles.priceMain}>{formatCurrency(perUnit)}</Text>
            <Text style={styles.priceSub}>per unit</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.reasoning}>
        <Text style={styles.reasoningEyebrow}>Why this one</Text>
        {result.reasons.map((r, i) => (
          <View key={`${r}-${i}`} style={styles.reasonRow}>
            <View style={styles.reasonDot}>
              <Ionicons name="checkmark" size={11} color="#fff" />
            </View>
            <Text style={styles.reasonText}>{r}</Text>
          </View>
        ))}
      </View>

      <View style={styles.ctaRow}>
        <Pressable
          onPress={handlePickAnother}
          accessibilityRole="button"
          accessibilityLabel="Pick another station myself"
          style={({ pressed }) => [
            styles.secondaryBtn,
            pressed && { opacity: 0.9 },
          ]}
        >
          <Text style={styles.secondaryText}>Pick another</Text>
        </Pressable>
        <Pressable
          onPress={handleUse}
          accessibilityRole="button"
          accessibilityLabel={`Use ${s.name}`}
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && { opacity: 0.92 },
          ]}
        >
          <Text style={styles.primaryText}>Use this station</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ─────────────────────────── Internals ─────────────────────────── */

function SparklesBackdrop() {
  return (
    <Svg
      width={120}
      height={100}
      viewBox="0 0 120 100"
      style={{ position: "absolute", right: -10, top: -8, opacity: 0.18 }}
    >
      <Path d="M30 20l4 12 12 4-12 4-4 12-4-12-12-4 12-4z" fill="#fff" />
      <Path d="M80 50l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" fill="#fff" />
      <Path d="M60 78l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="#fff" />
    </Svg>
  );
}

const bannerStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: 14,
      backgroundColor:
        theme.mode === "dark" ? theme.palette.green950 : theme.palette.green700,
      overflow: "hidden",
    },
    iconTile: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: "rgba(255,255,255,0.15)",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    copy: { flex: 1, minWidth: 0 },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    title: {
      fontSize: 14,
      fontWeight: "800",
      color: "#fff",
    },
    betaTag: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: theme.palette.gold500,
    },
    betaText: {
      fontSize: 9,
      fontWeight: "800",
      color: "#1a1a1a",
      letterSpacing: 0.5,
    },
    sub: {
      fontSize: 11.5,
      color: "rgba(255,255,255,0.85)",
      marginTop: 2,
      lineHeight: 16,
    },
    tryPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      height: 36,
      paddingHorizontal: 14,
      borderRadius: 18,
      backgroundColor: "#fff",
      flexShrink: 0,
    },
    tryText: {
      fontSize: 12.5,
      fontWeight: "800",
      color: theme.palette.green700,
    },
  });

const pillStyles = (theme: Theme) =>
  StyleSheet.create({
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      height: 36,
      paddingHorizontal: 14,
      borderRadius: 18,
      backgroundColor:
        theme.mode === "dark" ? theme.palette.green950 : theme.palette.green700,
      ...theme.elevation.card,
    },
    text: {
      fontSize: 12.5,
      fontWeight: "800",
      color: "#fff",
    },
    betaTag: {
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 3,
      backgroundColor: theme.palette.gold500,
      marginLeft: 2,
    },
    betaText: {
      fontSize: 9,
      fontWeight: "800",
      color: "#1a1a1a",
      letterSpacing: 0.5,
    },
  });

const pickedStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 24,
      gap: 14,
    },
    eyebrowRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    eyebrow: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.5,
      color: theme.primary,
      textTransform: "uppercase",
    },
    heroRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },
    heroName: {
      fontSize: 18,
      fontWeight: "800",
      letterSpacing: -0.2,
      color: theme.fg,
    },
    heroAddress: {
      fontSize: 12.5,
      color: theme.fgMuted,
      marginTop: 3,
      lineHeight: 18,
    },
    priceCol: { alignItems: "flex-end" },
    priceMain: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.fg,
      ...theme.type.money,
    },
    priceSub: {
      fontSize: 10,
      color: theme.fgMuted,
      marginTop: 1,
    },
    reasoning: {
      gap: 8,
      padding: 12,
      borderRadius: 12,
      backgroundColor: theme.bgMuted,
    },
    reasoningEyebrow: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.fgMuted,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      marginBottom: 2,
    },
    reasonRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
    },
    reasonDot: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 1,
    },
    reasonText: {
      flex: 1,
      fontSize: 12.5,
      color: theme.fg,
      lineHeight: 18,
    },
    ctaRow: {
      flexDirection: "row",
      gap: 10,
    },
    secondaryBtn: {
      flex: 1,
      height: 50,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: theme.divider,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    secondaryText: {
      fontSize: 13.5,
      fontWeight: "800",
      color: theme.fg,
    },
    primaryBtn: {
      flex: 1.4,
      height: 50,
      borderRadius: 14,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
      ...theme.elevation.card,
    },
    primaryText: {
      fontSize: 13.5,
      fontWeight: "800",
      color: theme.fgOnPrimary,
    },
  });
