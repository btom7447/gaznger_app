import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Theme, useTheme, formatCurrency } from "@/constants/theme";
import { Chip } from "@/components/ui/primitives";
import StationsViewToggle, { StationsViewMode } from "./StationsViewToggle";
import type { StationCardData } from "./StationCard";

/**
 * Map view for Stations rev2.
 *
 * Renders a full-screen Google Map with:
 *   - Destination pin at the delivery address.
 *   - One pin per nearby station, colour-flipped + scaled when selected.
 *   - A peek/mid/full bottom sheet listing the same stations as compact
 *     rows. Sort chips inside the sheet mirror the list view's chips.
 *
 * The selected station + tap-to-select is owned by the parent screen so
 * the FloatingCTA continues to read from a single source of truth.
 */

type SortKey = "nearest" | "cheapest" | "top-rated";

interface Props {
  stations: StationCardData[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  destination: { lat: number; lng: number } | null;
  destinationLabel?: string;
  sort: SortKey;
  onSort: (next: SortKey) => void;
  /** Bottom inset to clear the FloatingCTA. */
  bottomInset?: number;
  /** Current view mode + setter so the toggle in the sheet header can flip back to List. */
  viewMode: StationsViewMode;
  onViewModeChange: (next: StationsViewMode) => void;
}

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "nearest", label: "Nearest" },
  { key: "cheapest", label: "Cheapest" },
  { key: "top-rated", label: "Top rated" },
];

export default function StationsMapView({
  stations,
  selectedId,
  onSelect,
  destination,
  destinationLabel,
  sort,
  onSort,
  bottomInset = 96,
  viewMode,
  onViewModeChange,
}: Props) {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const sheetRef = useRef<BottomSheet>(null);

  // Pulse animation driving the selected-station marker halo.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // Centre the map on the destination, or on the median of the station
  // markers if no destination yet (rare — Stations should always have a
  // delivery address by this point in the flow).
  const initialRegion = useMemo(() => {
    if (destination) {
      return {
        latitude: destination.lat,
        longitude: destination.lng,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      };
    }
    return {
      latitude: 6.5244,
      longitude: 3.3792,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    };
  }, [destination]);

  const snapPoints = useMemo(() => ["20%", "55%", "85%"], []);

  // Use the server's real lat/lng when present; drop pins for stations
  // missing geo (rare — every seeded station has location). Synthetic
  // scattering was a dev-only stop-gap that misled customers about
  // where stations actually live.
  const pinned = useMemo(
    () =>
      stations
        .filter((s) => typeof s.lat === "number" && typeof s.lng === "number")
        .map((s) => ({ ...s, _lat: s.lat as number, _lng: s.lng as number })),
    [stations]
  );

  /**
   * Auto-fit the map to enclose every pin (destination + stations).
   * Without this, the static `initialRegion` (centred on the
   * destination at ~0.06° span) often clips far stations off-screen.
   * `fitToCoordinates` re-frames after layout so all pins are visible
   * with comfortable padding for the address pill + sheet.
   */
  const mapRef = useRef<MapView>(null);
  useEffect(() => {
    if (pinned.length === 0) return;
    const t = setTimeout(() => {
      const coords = [
        ...(destination
          ? [{ latitude: destination.lat, longitude: destination.lng }]
          : []),
        ...pinned.map((s) => ({ latitude: s._lat, longitude: s._lng })),
      ];
      if (coords.length === 0) return;
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 120, bottom: 360, left: 60, right: 60 },
        animated: true,
      });
    }, 350);
    return () => clearTimeout(t);
  }, [pinned, destination]);

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
      >
        {destination ? (
          <Marker
            coordinate={{
              latitude: destination.lat,
              longitude: destination.lng,
            }}
            tracksViewChanges={false}
          >
            <View style={styles.destPin}>
              <Ionicons name="location" size={22} color={theme.error} />
            </View>
          </Marker>
        ) : null}

        {pinned.map((s) => {
          const isSelected = s.id === selectedId;
          // tracksViewChanges must be `true` while the pulse halo is
          // animating, otherwise iOS caches the marker after first
          // render and the halo never animates. We let only the
          // selected marker re-render — others stay static for perf.
          return (
            <Marker
              key={s.id}
              coordinate={{ latitude: s._lat, longitude: s._lng }}
              onPress={() => onSelect(s.id)}
              tracksViewChanges={isSelected}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.stationPinWrap}>
                {isSelected ? (
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.pulseHalo,
                      {
                        opacity: pulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.45, 0],
                        }),
                        transform: [
                          {
                            scale: pulse.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 2.2],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                ) : null}
                <View
                  style={[
                    styles.priceBadge,
                    isSelected && styles.priceBadgeSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.priceText,
                      isSelected && styles.priceTextSelected,
                    ]}
                  >
                    {formatCurrency(s.perUnit)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.stationDot,
                    isSelected && styles.stationDotSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.stationDotText,
                      isSelected && styles.stationDotTextSelected,
                    ]}
                  >
                    {(s.shortName ?? s.name).slice(0, 2).toUpperCase()}
                  </Text>
                </View>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Top header row — back chip + "Delivering to" pill. Replaces the
          standard ScreenHeader entirely in Map mode (per design: the
          standard title + view toggle are not on the map view). The
          List/Map toggle moves into the sheet header below. */}
      <View style={[styles.topHeader, { top: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [
            styles.backChip,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons name="chevron-back" size={18} color={theme.fg} />
        </Pressable>
        <View style={styles.addressPill}>
          <Ionicons name="location" size={14} color={theme.error} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.addressEyebrow}>Delivering to</Text>
            <Text style={styles.addressLabel} numberOfLines={1}>
              {destinationLabel ?? "Set address"}
            </Text>
          </View>
        </View>
      </View>

      {/* Bottom sheet — compact list of stations matching the map pins. */}
      <BottomSheet
        ref={sheetRef}
        index={1}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        backgroundStyle={{ backgroundColor: theme.bg }}
        handleIndicatorStyle={{ backgroundColor: theme.borderStrong }}
      >
        <BottomSheetScrollView
          contentContainerStyle={[
            styles.sheetContent,
            { paddingBottom: bottomInset },
          ]}
        >
          <View style={styles.sheetHeaderRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.sheetTitle}>
                {stations.length === 0
                  ? "No stations within 25 km"
                  : `${stations.length} stations near you`}
              </Text>
              {stations.length > 0 ? (
                <Text style={styles.sheetSub}>
                  Sorted by{" "}
                  {SORT_OPTIONS.find((o) => o.key === sort)?.label.toLowerCase()}
                </Text>
              ) : null}
            </View>
            <StationsViewToggle mode={viewMode} onChange={onViewModeChange} />
          </View>

          {stations.length > 0 ? (
            <View style={styles.chipRow}>
              {SORT_OPTIONS.map((opt) => (
                <Chip
                  key={opt.key}
                  selected={opt.key === sort}
                  onPress={() => onSort(opt.key)}
                  accessibilityLabel={`Sort by ${opt.label}`}
                >
                  {opt.label}
                </Chip>
              ))}
            </View>
          ) : null}

          {stations.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconTile}>
                <Ionicons
                  name="location"
                  size={26}
                  color={theme.fgMuted}
                />
              </View>
              <Text style={styles.emptyTitle}>Nothing within 25 km</Text>
              <Text style={styles.emptyBody}>
                We checked 5, 10 and 25 km — no stations are listed in this
                area right now.
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {stations.map((s) => (
                <CompactStationRow
                  key={s.id}
                  station={s}
                  selected={s.id === selectedId}
                  onPress={() => onSelect(s.id)}
                  theme={theme}
                />
              ))}
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

/* ─────────────────────── Compact row ─────────────────────── */

function CompactStationRow({
  station,
  selected,
  onPress,
  theme,
}: {
  station: StationCardData;
  selected: boolean;
  onPress: () => void;
  theme: Theme;
}) {
  const styles = compactStyles(theme);
  const initials = (station.shortName ?? station.name)
    .slice(0, 4)
    .toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => [
        styles.row,
        selected && styles.rowSelected,
        pressed && { opacity: 0.92 },
      ]}
    >
      <View style={styles.brandTile}>
        <Text style={styles.brandText}>{initials}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {station.name}
        </Text>
        <View style={styles.meta}>
          {station.distanceKm != null ? (
            <Text style={styles.metaText}>
              {station.distanceKm.toFixed(1)} km
            </Text>
          ) : null}
          {station.rating != null ? (
            <>
              <Text style={styles.metaDot}>·</Text>
              <Ionicons
                name="star"
                size={10}
                color={
                  theme.mode === "dark"
                    ? theme.palette.gold300
                    : theme.palette.gold700
                }
              />
              <Text style={styles.metaText}>
                {station.rating.toFixed(1)}
              </Text>
            </>
          ) : null}
        </View>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={styles.price}>{formatCurrency(station.perUnit)}</Text>
        <Text style={styles.priceUnit}>per {station.unit.toLowerCase()}</Text>
      </View>
    </Pressable>
  );
}

const compactStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: theme.surface,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: theme.divider,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    rowSelected: {
      borderColor: theme.primary,
    },
    brandTile: {
      width: 36,
      height: 36,
      borderRadius: 9,
      backgroundColor: theme.primaryTint,
      alignItems: "center",
      justifyContent: "center",
    },
    brandText: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.mode === "dark" ? "#fff" : theme.palette.green700,
    },
    body: { flex: 1, minWidth: 0, gap: 2 },
    name: { fontSize: 13, fontWeight: "800", color: theme.fg },
    meta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    metaText: { fontSize: 11.5, color: theme.fgMuted },
    metaDot: { fontSize: 11.5, color: theme.fgMuted },
    price: {
      fontSize: 14,
      fontWeight: "800",
      color: theme.fg,
      ...theme.type.money,
    },
    priceUnit: { fontSize: 10, color: theme.fgMuted, marginTop: 1 },
  });

/* ─────────────────────── Map styles ─────────────────────── */

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1 },

    topHeader: {
      position: "absolute",
      left: 16,
      right: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      zIndex: 5,
    },
    backChip: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
      ...theme.elevation.card,
    },
    addressPill: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: theme.surface,
      borderRadius: 12,
      ...theme.elevation.card,
    },
    addressEyebrow: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.fgMuted,
    },
    addressLabel: {
      fontSize: 12.5,
      fontWeight: "800",
      color: theme.fg,
      marginTop: 1,
    },
    pulseHalo: {
      position: "absolute",
      top: -2,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.primary,
    },
    sheetHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 12,
    },

    destPin: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
      ...theme.elevation.card,
    },

    stationPinWrap: {
      alignItems: "center",
    },
    priceBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
      backgroundColor: "#fff",
      borderWidth: 1,
      borderColor: theme.primary,
      marginBottom: 2,
    },
    priceBadgeSelected: {
      backgroundColor: theme.primary,
      borderColor: "#fff",
    },
    priceText: {
      fontSize: 9,
      fontWeight: "800",
      color: theme.primary,
      ...theme.type.money,
    },
    priceTextSelected: {
      color: "#fff",
    },
    stationDot: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: "#fff",
      borderWidth: 2,
      borderColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    stationDotSelected: {
      backgroundColor: theme.primary,
      borderColor: "#fff",
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    stationDotText: {
      fontSize: 10,
      fontWeight: "800",
      color: theme.primary,
    },
    stationDotTextSelected: {
      color: "#fff",
    },

    sheetContent: {
      paddingHorizontal: 16,
      paddingTop: 4,
    },
    sheetTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: theme.fg,
    },
    sheetSub: {
      fontSize: 11.5,
      color: theme.fgMuted,
      marginTop: 2,
    },
    chipRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 12,
    },
    list: {
      gap: 8,
    },
    emptyWrap: {
      alignItems: "center",
      paddingVertical: 20,
      paddingHorizontal: 24,
    },
    emptyIconTile: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: theme.bgMuted,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    emptyTitle: {
      fontSize: 13.5,
      fontWeight: "800",
      color: theme.fg,
      marginBottom: 4,
    },
    emptyBody: {
      fontSize: 12,
      color: theme.fgMuted,
      lineHeight: 18,
      textAlign: "center",
    },
  });
