import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import BottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Theme, useTheme, formatCurrency } from "@/constants/theme";
import { Chip } from "@/components/ui/primitives";
import StationsViewToggle, { StationsViewMode } from "./StationsViewToggle";
import { formatUnit, type StationCardData } from "./StationCard";
import StationBadges from "./StationBadges";
import StationPhotoStrip from "./StationPhotoStrip";
import { useOrderStore } from "@/store/useOrderStore";
import { GaznerChoosePill } from "./GaznerChoose";

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
  /** Ionicon glyph for the delivery thumbnail (home-outline,
   *  briefcase-outline, …). Defaults to "location" when the saved
   *  address has no icon set. */
  destinationIcon?: string;
  sort: SortKey;
  onSort: (next: SortKey) => void;
  /** Bottom inset to clear the FloatingCTA. */
  bottomInset?: number;
  /** Current view mode + setter so the toggle in the sheet header can flip back to List. */
  viewMode: StationsViewMode;
  onViewModeChange: (next: StationsViewMode) => void;
  /** Triggered by the floating "Let Gaznger choose" pill. Optional —
   *  when omitted the pill is hidden, so the map view keeps working
   *  before the auto-pick endpoint ships. */
  onAutoPick?: () => void;
  /** Whether the auto-pick request is in flight. */
  autoPickLoading?: boolean;
  /** Search radius (km) currently being used by the parent's fetch.
   *  Drives the pulse halo + the sheet header's "X stations within Y km"
   *  copy so the count + ring stay in sync. */
  radiusKm: number;
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
  destinationIcon,
  sort,
  onSort,
  bottomInset = 96,
  viewMode,
  onViewModeChange,
  onAutoPick,
  autoPickLoading,
  radiusKm,
}: Props) {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const sheetRef = useRef<BottomSheet>(null);
  // Track which snap the sheet is currently at — used to flip the
  // body between the collapsed horizontal-cards layout (peek snap)
  // and the full vertical list (mid + full snaps). Defaults to the
  // mid snap so the initial paint matches the BottomSheet index=1.
  const [snapIndex, setSnapIndex] = useState(1);

  // Peek sheet — opens when the user taps a station pin so they can
  // see the station details before committing. Distinct from
  // `selectedId` (the radio-selected station the FloatingCTA reads
  // from); peek is "look at this one" while selectedId is "I'll buy
  // from this one". Tapping Select on the peek sheet promotes the
  // peek station to selectedId + closes the sheet.
  const peekSheetRef = useRef<BottomSheetModal>(null);
  const [peekStationId, setPeekStationId] = useState<string | null>(null);
  const peekStation = useMemo(
    () =>
      peekStationId
        ? stations.find((s) => s.id === peekStationId) ?? null
        : null,
    [peekStationId, stations]
  );

  // Order draft — needed for the sticky CTA bar's "qty × perUnit" math.
  // We read qty (preferred) with a fall-back to legacy quantity, and the
  // unit so the line-item label reads "25 Ltr × ₦815" for petrol or
  // "12.5 Kg × ₦1,200" for LPG.
  const draftQty = useOrderStore((s) => s.order.qty ?? s.order.quantity ?? 0);

  const handlePinTap = (id: string) => {
    setPeekStationId(id);
    peekSheetRef.current?.present();
  };

  const handlePeekSelect = () => {
    if (peekStationId) onSelect(peekStationId);
    peekSheetRef.current?.dismiss();
  };

  const renderPeekBackdrop = useMemo(
    () =>
      function PeekBackdrop(props: BottomSheetBackdropProps) {
        return (
          <BottomSheetBackdrop
            {...props}
            appearsOnIndex={0}
            disappearsOnIndex={-1}
            opacity={0.4}
          />
        );
      },
    []
  );

  // Pulse animation. `<Circle>` from react-native-maps doesn't accept
  // Animated values, so we drive a useState({radius, opacity}) via a
  // single listener and let the Circle re-render on each tick.
  //
  // Visual: a halo that radiates OUT from the destination. Each cycle
  // the pulse circle starts at radius=0 + opacity=0.35 and expands to
  // the active km radius while fading to 0, then restarts. This is
  // what reads as "alive radar ping" — a single static fill couldn't
  // do it. Pair this with the static outer ring rendered separately.
  const pulse = useRef(new Animated.Value(0)).current;
  const [pulseProgress, setPulseProgress] = useState(0);
  useEffect(() => {
    const id = pulse.addListener(({ value }) => setPulseProgress(value));
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 2400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      })
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.removeListener(id);
    };
  }, [pulse]);

  // One-shot selection pulse. Replays whenever `selectedId` changes
  // so the user gets a clear "this is the one you picked" confirmation.
  // Driven through state on each tick (same listener pattern as the
  // destination pulse) because react-native-maps' Circle doesn't
  // accept Animated values. The animation is map-native (Circle is
  // drawn at the GPU level, not rasterised through the marker bitmap),
  // so it stays sharp at every zoom level — unlike the previous
  // marker-bitmap approach which blurred under tracksViewChanges.
  const selectionPulse = useRef(new Animated.Value(0)).current;
  const [selectionProgress, setSelectionProgress] = useState(1);
  useEffect(() => {
    const id = selectionPulse.addListener(({ value }) =>
      setSelectionProgress(value)
    );
    return () => selectionPulse.removeListener(id);
  }, [selectionPulse]);
  useEffect(() => {
    if (!selectedId) return;
    selectionPulse.setValue(0);
    Animated.timing(selectionPulse, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [selectedId, selectionPulse]);

  // Search radius is owned by the parent (sort=nearest → 5 km, else 10 km).
  // The user can still pan/zoom the map past the halo to scout stations
  // outside the radius — the data fetch is the only thing the radius
  // gates, so out-of-range stations simply aren't in `stations`.
  //
  // Pulse circle never *quite* hits the full radius; capping at 0.95
  // keeps it visually inside the bounds so a 2.4s loop tail doesn't
  // bleed into the auto-fit padding.
  const pulseRadiusM = radiusKm * 1000 * Math.min(pulseProgress, 0.95);
  const pulseOpacity = 0.35 * (1 - pulseProgress);

  // Selection pulse derives a radius + opacity from the one-shot
  // animator above. Starts tight (45 m, full opacity) and rings out to
  // ~220 m as it fades. The numbers are intentionally larger than the
  // dot so the ring reads beyond the marker bitmap — but small enough
  // to stay tied to the station, not the whole neighbourhood.
  const selectionPulseRadiusM = 45 + 175 * selectionProgress;
  const selectionPulseOpacity = 0.55 * (1 - selectionProgress);

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

  // Coords for the selection-pulse Circle. Memoised so the Circle
  // doesn't re-render every animation tick (selectionProgress drives
  // radius/opacity directly; the centre only changes on actual
  // selection change).
  const selectedStation = useMemo(
    () => (selectedId ? pinned.find((p) => p.id === selectedId) ?? null : null),
    [selectedId, pinned]
  );

  /**
   * Auto-fit the map. Two passes:
   *  1. On first mount with stations + destination — frame to enclose
   *     them all so the user sees the lay of the land.
   *  2. Whenever the user changes the radius — frame to the active
   *     circle's bounding box (4 cardinal points around the
   *     destination at activeRadiusKm distance) so the circle
   *     visibly scales as they tap 5 / 10 / 25.
   */
  const mapRef = useRef<MapView>(null);

  // Helper: bounding box for a radius circle around the destination,
  // expressed as 4 cardinal coordinates. 1 deg latitude ≈ 111 km; we
  // use that constant + a longitude correction (cos lat) for the
  // east/west pair so the box stays roughly square in projected px.
  const radiusBoundsCoords = useMemo(() => {
    if (!destination) return [];
    const km = radiusKm;
    const dLat = km / 111;
    const dLng = km / (111 * Math.cos((destination.lat * Math.PI) / 180));
    return [
      { latitude: destination.lat + dLat, longitude: destination.lng },
      { latitude: destination.lat - dLat, longitude: destination.lng },
      { latitude: destination.lat, longitude: destination.lng + dLng },
      { latitude: destination.lat, longitude: destination.lng - dLng },
    ];
  }, [destination, radiusKm]);

  // Centre the camera on the destination + active radius. The
  // delivery pin sits dead-centre of the visible canvas so the user
  // immediately reads "this is me, here are the stations around me".
  // Same effect handles both first-mount AND every chip toggle —
  // single source of truth.
  useEffect(() => {
    if (radiusBoundsCoords.length === 0) return;
    const t = setTimeout(() => {
      mapRef.current?.fitToCoordinates(radiusBoundsCoords, {
        edgePadding: { top: 140, bottom: 360, left: 60, right: 60 },
        animated: true,
      });
    }, 200);
    return () => clearTimeout(t);
  }, [radiusKm, radiusBoundsCoords]);

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
      >
        {/* Pulse halo — radiates OUT from the destination on a 2.4s
            loop, expanding from radius 0 to ~95% of the active radius
            while fading to transparent. No persistent ring border —
            just the soft halo so the map doesn't read as "fenced" by
            a hard primary outline. */}
        {destination && pulseProgress > 0.02 ? (
          <Circle
            center={{
              latitude: destination.lat,
              longitude: destination.lng,
            }}
            radius={pulseRadiusM}
            strokeColor="transparent"
            strokeWidth={0}
            fillColor={`${theme.primary}${Math.round(pulseOpacity * 255)
              .toString(16)
              .padStart(2, "0")}`}
            zIndex={997}
          />
        ) : null}

        {/* Selection ring — one-shot pulse that rings out from the
            selected station each time selectedId changes. Map-native
            Circle so it stays sharp at all zoom levels (no marker
            bitmap rasterisation). selectionProgress < 1 means the
            animation is still running; we hide it once it settles
            so we're not painting an invisible Circle every frame. */}
        {selectedStation && selectionProgress < 1 ? (
          <Circle
            center={{
              latitude: selectedStation._lat,
              longitude: selectedStation._lng,
            }}
            radius={selectionPulseRadiusM}
            strokeColor={theme.primary}
            strokeWidth={2}
            fillColor={`${theme.primary}${Math.round(
              selectionPulseOpacity * 255
            )
              .toString(16)
              .padStart(2, "0")}`}
            zIndex={998}
          />
        ) : null}

        {destination ? (
          <Marker
            coordinate={{
              latitude: destination.lat,
              longitude: destination.lng,
            }}
            // Re-render once when the icon resolves async after the
            // address load — without this iOS caches the placeholder
            // glyph and never swaps in the address-specific one.
            tracksViewChanges
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={1000}
          >
            {/* Address-icon thumbnail. Ionicon glyph mirrors the saved
                address's pick (home-outline / briefcase-outline / etc.)
                so the user instantly recognises which destination
                they're delivering to. Falls back to a generic pin when
                the address has no icon (legacy data / GPS-only). */}
            <View style={styles.destPin}>
              <Ionicons
                name={(destinationIcon ?? "location") as never}
                size={20}
                color={theme.fgOnPrimary}
              />
            </View>
          </Marker>
        ) : null}

        {pinned.map((s) => {
          const isSelected = s.id === selectedId;
          return (
            <Marker
              // Key includes isSelected so the native marker remounts
              // when selection flips. Without this, react-native-maps
              // caches the rendered view and the styling never updates
              // — selected vs unselected pins look identical on Android.
              key={`${s.id}-${isSelected ? "sel" : "idle"}`}
              coordinate={{ latitude: s._lat, longitude: s._lng }}
              // Tap a station pin → peek sheet, NOT immediate selection.
              // The peek sheet's Select button promotes peek → selectedId.
              // This keeps tap-to-explore separate from commit-to-buy.
              onPress={() => handlePinTap(s.id)}
              // Marker remounts on selection (key includes isSelected)
              // so we never need to track view changes — the bitmap is
              // correct on first paint and stays sharp. Animation
              // happens map-native via a Circle, not on the bitmap.
              tracksViewChanges={false}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              {/* Static pin — brand monogram dot. Selection delta
                  comes from the map-native Circle pulse rendered
                  separately on the MapView, so the marker bitmap
                  stays sharp (no `tracksViewChanges` blur). */}
              <View style={styles.stationPinWrap}>
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

      {/* Top header row — sits at the safe-area top inset. The map
          itself renders edge-to-edge (the parent ScreenContainer's
          edges={['bottom']} no longer pads top), so we add the
          inset back here to keep the back chip + address pill clear
          of the status bar. Single source of truth for top spacing. */}
      <View style={[styles.topHeader, { top: insets.top }]}>
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

      {/* "Let Gaznger choose" floating pill — centred below the
          header pill row. Hidden when no onAutoPick handler is wired
          so the map keeps working without the C.1 endpoint. */}
      {onAutoPick ? (
        <View
          style={[styles.autoPickWrap, { top: insets.top + 6 + 48 + 8 }]}
          pointerEvents="box-none"
        >
          <GaznerChoosePill
            onPress={onAutoPick}
            loading={autoPickLoading}
          />
        </View>
      ) : null}

      {/* Bottom sheet — compact list of stations matching the map pins. */}
      <BottomSheet
        ref={sheetRef}
        index={1}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        onChange={setSnapIndex}
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
                  ? `No stations within ${radiusKm} km`
                  : `${stations.length} station${
                      stations.length === 1 ? "" : "s"
                    } within ${radiusKm} km`}
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
          ) : snapIndex === 0 ? (
            // Collapsed snap (peek) — horizontal scroll of the four
            // cheapest stations in the current sort. Tapping a card
            // promotes the station to selectedId AND expands the
            // sheet to mid so the full list becomes scannable.
            <CheapestCarousel
              stations={stations}
              selectedId={selectedId}
              onSelect={(id) => {
                onSelect(id);
                sheetRef.current?.snapToIndex(1);
              }}
              theme={theme}
            />
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

      {/* Station detail sheet — opens on pin tap. rev3 design: photo
          strip + title/rating header + 3 stat tiles + partner trust
          line + amenity chips + last-dispense + sticky CTA bar with
          order math. Distinct from the persistent list sheet so
          tapping a pin doesn't commit the user to a selection. */}
      <BottomSheetModal
        ref={peekSheetRef}
        snapPoints={["72%", "92%"]}
        backdropComponent={renderPeekBackdrop}
        backgroundStyle={{ backgroundColor: theme.bg }}
        handleIndicatorStyle={{ backgroundColor: theme.borderStrong }}
        onDismiss={() => setPeekStationId(null)}
      >
        {peekStation ? (
          <StationDetailSheetBody
            station={peekStation}
            selectedId={selectedId}
            qty={draftQty}
            onSelect={handlePeekSelect}
            onClose={() => peekSheetRef.current?.dismiss()}
            theme={theme}
          />
        ) : (
          <BottomSheetView style={{ flex: 1 }}>
            <View />
          </BottomSheetView>
        )}
      </BottomSheetModal>
    </View>
  );
}

/* ─────────────────────── Station detail sheet body ─────────────────────── */

/**
 * Station detail sheet body — rev3 design.
 *
 * Layout (top → bottom):
 *   1. Header strip — partner-since pill (gold) on left + close X on
 *      right. Sits ABOVE the photo strip so neither is hidden when the
 *      sheet opens at its peek snap.
 *   2. Scrollable body:
 *      - Horizontal photo strip (Cloudinary URLs OR fallback SVG).
 *      - Title row: name + verified shield (icon-only, primary green).
 *        Rating cluster: star · "4.5 (12)" — count is required when
 *        the rating is present.
 *      - 4 stat tiles (Distance / ETA / Per-unit / On-time). On-time
 *        renders blank ("—") for first-time stations rather than being
 *        omitted, so the row geometry doesn't shift.
 *      - Partner-since banner (gold) when partner, muted listed-station
 *        banner otherwise. Copy never claims dispenser calibration or
 *        staff training — Gaznger doesn't operate the forecourt.
 *      - "What's there" amenity chips: service time, payment options
 *        (no cash on delivery), last Gaznger dispense.
 *   3. Pinned footer (NOT inside scroll): qty × perUnit + Select CTA.
 *      `position: absolute` over a flex-1 root keeps the footer fixed
 *      regardless of scroll position so the CTA is always reachable.
 */
function StationDetailSheetBody({
  station,
  selectedId,
  qty,
  onSelect,
  onClose,
  theme,
}: {
  station: StationCardData;
  selectedId: string | null;
  qty: number;
  onSelect: () => void;
  onClose: () => void;
  theme: Theme;
}) {
  const styles = detailStyles(theme);
  const isSelected = station.id === selectedId;

  // Amenities surface only the rev3-blessed set: service time, payment
  // options, last Gaznger dispense. We deliberately drop the previous
  // "fuel grades" chips because the perUnit price already conveys that
  // and the row was overflowing on small phones.
  const amenities: { icon: string; label: string }[] = [];
  if (station.serviceTime) {
    amenities.push({ icon: "time-outline", label: station.serviceTime });
  } else if (station.operatingHours) {
    // Fall back to operating hours when service-time isn't set yet —
    // it's the next-best signal for "when can you actually fill up".
    amenities.push({
      icon:
        station.operatingHours.toLowerCase().includes("24/7") ||
        station.operatingHours.includes("00:00")
          ? "time"
          : "time-outline",
      label: station.operatingHours,
    });
  }
  // Payment options — explicitly filtered to drop any "cash on delivery"
  // entry. Gaznger does not support COD; surfacing it here would lie.
  (station.paymentOptions ?? [])
    .filter((p) => !/cash\s*on\s*delivery|\bcod\b/i.test(p))
    .slice(0, 3)
    .forEach((p) => amenities.push({ icon: "card-outline", label: p }));
  if (station.lastDispenseAgo) {
    amenities.push({
      icon: "checkmark-circle-outline",
      label: `Last dispense ${station.lastDispenseAgo}`,
    });
  }

  const lineTotal = station.perUnit * (qty || 0);
  const unitLabel = formatUnit(station.unit);

  // Partner colour — gold for both pill text + trust banner so the
  // gold accent reads consistently across the sheet.
  const goldColor =
    theme.mode === "dark" ? theme.palette.gold300 : theme.palette.gold700;

  return (
    <View style={{ flex: 1 }}>
      {/* Header strip — partner pill (left) + close X (right). Plain
          View (NOT BottomSheetView) so it composes correctly in the
          flex column above the BottomSheetScrollView. Using
          BottomSheetView here caused gorhom to flatten the layout and
          let the scroll content render UNDER this row — the header
          was visually present but the photo carousel sat on top of it. */}
      <View style={styles.headerStrip}>
        {station.isPartner ? (
          <View style={styles.partnerPill}>
            <Ionicons
              name="ribbon"
              size={12}
              color={goldColor}
            />
            <Text style={styles.partnerPillText}>
              {station.partnerSince
                ? `Partner since ${station.partnerSince}`
                : "Gaznger Partner"}
            </Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close station details"
          hitSlop={8}
          style={({ pressed }) => [
            styles.closeBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons name="close" size={16} color={theme.fg} />
        </Pressable>
      </View>

      <BottomSheetScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Photo strip — prefers Station.images[], falls back to the
            single hero `imageUrl`, and only renders the stylised SVG
            placeholder when neither is set. Seeded stations ship just
            `image` so the fallback chain matters. */}
        <StationPhotoStrip
          images={
            station.images && station.images.length > 0
              ? station.images
              : station.imageUrl
              ? [station.imageUrl]
              : undefined
          }
          height={128}
        />

        {/* Title + rating cluster. Verified shield is icon-only (no
            circular background) so it reads as a status flag, not a
            second photo dot. Rating: star · "4.5 (12)" — count is
            always shown when the rating exists; "(0)" if no reviews. */}
        <View style={styles.titleRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.titleNameRow}>
              <Text style={styles.title} numberOfLines={1}>
                {station.name}
              </Text>
              {station.verified ? (
                <Ionicons
                  name="shield-checkmark"
                  size={16}
                  color={theme.primary}
                  accessibilityLabel="NMDPRA-verified station"
                />
              ) : null}
              {station.isPartner ? (
                <Ionicons
                  name="ribbon"
                  size={16}
                  color={goldColor}
                  accessibilityLabel="Gaznger Partner station"
                />
              ) : null}
            </View>
            <Text style={styles.address} numberOfLines={2}>
              {station.address}
            </Text>
          </View>
          {station.rating != null ? (
            <View style={styles.ratingCluster}>
              <Ionicons
                name="star"
                size={14}
                color={
                  theme.mode === "dark"
                    ? theme.palette.gold300
                    : theme.palette.gold700
                }
              />
              <Text style={styles.ratingValue}>
                {station.rating.toFixed(1)}
              </Text>
              <Text style={styles.ratingCount}>
                ({(station.totalRatings ?? 0).toLocaleString()})
              </Text>
            </View>
          ) : null}
        </View>

        {/* 4 stat tiles — Distance, ETA, Per-unit, On-time. On-time
            renders "—" when the server hasn't computed a rate yet
            (first-time stations) instead of being omitted, so the
            row stays a 4-up grid regardless. */}
        <View style={styles.statsRow}>
          <StatTile
            icon="navigate"
            label="DISTANCE"
            value={
              station.distanceKm != null
                ? `${station.distanceKm.toFixed(1)} km`
                : "—"
            }
            theme={theme}
          />
          <StatTile
            icon="time"
            label="ETA"
            value={
              station.etaMinutes != null ? `${station.etaMinutes} min` : "—"
            }
            theme={theme}
          />
          <StatTile
            icon="pricetag"
            label={`PER ${unitLabel.toUpperCase()}`}
            value={formatCurrency(station.perUnit)}
            theme={theme}
          />
          <StatTile
            icon="checkmark-done"
            label="ON-TIME"
            value={
              station.onTimeRate != null
                ? `${Math.round(station.onTimeRate)}%`
                : "—"
            }
            valueColor={
              station.onTimeRate != null
                ? station.onTimeRate >= 95
                  ? theme.palette.success500
                  : station.onTimeRate >= 90
                  ? theme.fg
                  : theme.palette.warning700
                : theme.fgMuted
            }
            theme={theme}
          />
        </View>

        {/* Partner-since banner (gold) when partner; muted listed-
            station banner otherwise. Copy avoids any claim about
            dispenser calibration or staff training — those aren't
            ours to vouch for. */}
        {station.isPartner ? (
          <View style={styles.partnerTrust}>
            <Ionicons
              name="ribbon"
              size={18}
              color={goldColor}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.partnerTrustTitle}>
                {station.partnerSince
                  ? `Partner since ${station.partnerSince}`
                  : "Gaznger Partner station"}
              </Text>
              <Text style={styles.partnerTrustSub}>
                Price honoured at delivery · priority order routing
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.listedTrust}>
            <Ionicons
              name="information-circle-outline"
              size={16}
              color={theme.fgMuted}
            />
            <Text style={styles.listedTrustText}>
              Listed station · price guaranteed at order time
            </Text>
          </View>
        )}

        {/* "What's there" amenity chips. */}
        {amenities.length > 0 ? (
          <View style={styles.amenitiesBlock}>
            <Text style={styles.amenitiesEyebrow}>What's there</Text>
            <View style={styles.amenitiesRow}>
              {amenities.map((a) => (
                <View key={a.label} style={styles.amenityChip}>
                  <Ionicons
                    name={a.icon as never}
                    size={12}
                    color={theme.fgMuted}
                  />
                  <Text style={styles.amenityText}>{a.label}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Spacer so the pinned CTA bar never overlaps the last block. */}
        <View style={{ height: 96 }} />
      </BottomSheetScrollView>

      {/* Pinned footer CTA — qty × perUnit on the left, Select on the
          right. Lives outside the scroll view so it's always reachable
          regardless of how far the user has scrolled. */}
      <View style={styles.ctaBar}>
        <View style={{ flex: 1, minWidth: 0 }}>
          {qty > 0 ? (
            <Text style={styles.ctaLineEyebrow} numberOfLines={1}>
              {qty} {unitLabel} × {formatCurrency(station.perUnit)}
            </Text>
          ) : null}
          <Text style={styles.ctaLineTotal} numberOfLines={1}>
            {qty > 0 ? formatCurrency(lineTotal) : formatCurrency(station.perUnit)}
            <Text style={styles.ctaLineFees}>
              {qty > 0 ? "  + delivery fee" : ` per ${unitLabel}`}
            </Text>
          </Text>
        </View>
        <Pressable
          onPress={onSelect}
          accessibilityRole="button"
          accessibilityLabel={`Select ${station.name}`}
          style={({ pressed }) => [
            styles.ctaBtn,
            pressed && { opacity: 0.92 },
          ]}
        >
          <Text style={styles.ctaBtnText}>
            {isSelected ? "Selected" : "Select"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function StatTile({
  icon,
  label,
  value,
  valueColor,
  theme,
}: {
  icon: string;
  label: string;
  value: string;
  /** Override the value text colour (e.g. green for ≥95% on-time). */
  valueColor?: string;
  theme: Theme;
}) {
  const styles = detailStyles(theme);
  return (
    <View style={styles.statTile}>
      <Ionicons name={icon as never} size={14} color={theme.fgMuted} />
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const detailStyles = (theme: Theme) =>
  StyleSheet.create({
    headerStrip: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      minHeight: 44,
    },
    closeBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: theme.bgMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    partnerPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      height: 24,
      borderRadius: 12,
      backgroundColor:
        theme.mode === "dark" ? "#2A220A" : theme.palette.gold50,
      borderWidth: 1,
      borderColor:
        theme.mode === "dark" ? "#4A3A14" : theme.palette.gold100,
    },
    partnerPillText: {
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.2,
      color:
        theme.mode === "dark" ? theme.palette.gold300 : theme.palette.gold700,
    },
    bodyContent: {
      paddingHorizontal: 16,
      // Extra top padding so the photo strip clears the grabber + the
      // partner pill / close X header strip when the sheet opens at
      // its peek snap. Without this the carousel was covering the
      // header row on tall content.
      paddingTop: 6,
      paddingBottom: 24,
      gap: 14,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      marginTop: 2,
    },
    titleNameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flexShrink: 1,
    },
    title: {
      fontSize: 20,
      fontWeight: "800",
      letterSpacing: -0.3,
      color: theme.fg,
      flexShrink: 1,
    },
    address: {
      fontSize: 12.5,
      color: theme.fgMuted,
      marginTop: 4,
      lineHeight: 18,
    },
    ratingCluster: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingTop: 2,
    },
    ratingValue: {
      fontSize: 14,
      fontWeight: "800",
      color: theme.fg,
    },
    ratingCount: {
      fontSize: 11,
      color: theme.fgMuted,
      marginLeft: 2,
    },
    statsRow: {
      flexDirection: "row",
      gap: 6,
    },
    statTile: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 8,
      backgroundColor: theme.bgMuted,
      borderRadius: 12,
      alignItems: "center",
      gap: 2,
    },
    statValue: {
      fontSize: 14,
      fontWeight: "800",
      color: theme.fg,
      marginTop: 2,
      ...theme.type.money,
    },
    statLabel: {
      fontSize: 10,
      color: theme.fgMuted,
      fontWeight: "700",
      letterSpacing: 0.2,
    },
    partnerTrust: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 12,
      borderRadius: 12,
      backgroundColor:
        theme.mode === "dark" ? "#2A220A" : theme.palette.gold50,
      borderWidth: 1,
      borderColor:
        theme.mode === "dark" ? "#4A3A14" : theme.palette.gold100,
    },
    partnerTrustTitle: {
      fontSize: 12.5,
      fontWeight: "800",
      color:
        theme.mode === "dark" ? theme.palette.gold300 : theme.palette.gold700,
    },
    partnerTrustSub: {
      fontSize: 11,
      color: theme.fgMuted,
      marginTop: 1,
    },
    listedTrust: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 12,
      borderRadius: 12,
      backgroundColor: theme.bgMuted,
    },
    listedTrustText: {
      flex: 1,
      fontSize: 12,
      color: theme.fgMuted,
    },
    amenitiesBlock: {
      gap: 8,
    },
    amenitiesEyebrow: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.fgMuted,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    amenitiesRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    amenityChip: {
      height: 30,
      paddingHorizontal: 12,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: theme.divider,
      backgroundColor: theme.surface,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    amenityText: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.fg,
    },
    ctaBar: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 18,
      backgroundColor: theme.bg,
      borderTopWidth: 1,
      borderTopColor: theme.divider,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    ctaLineEyebrow: {
      fontSize: 11,
      color: theme.fgMuted,
      fontWeight: "700",
    },
    ctaLineTotal: {
      fontSize: 17,
      fontWeight: "800",
      color: theme.fg,
      marginTop: 1,
      ...theme.type.money,
    },
    ctaLineFees: {
      fontSize: 11,
      color: theme.fgMuted,
      fontWeight: "600",
    },
    ctaBtn: {
      height: 50,
      paddingHorizontal: 22,
      borderRadius: 14,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
      ...theme.elevation.card,
    },
    ctaBtnText: {
      fontSize: 14,
      fontWeight: "800",
      color: theme.fgOnPrimary,
    },
  });

/* ─────────────────────── Cheapest carousel ─────────────────────── */

/**
 * Horizontal cheapest-4 carousel — used at the peek snap of the map
 * view's bottom sheet. Cards are deliberately compact (min-width 220)
 * so 1.5–2 fit on screen at once, encouraging the user to scroll
 * sideways instead of dragging the sheet up. Sorted by perUnit so
 * the cheapest option is always the first thing they see.
 */
function CheapestCarousel({
  stations,
  selectedId,
  onSelect,
  theme,
}: {
  stations: StationCardData[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  theme: Theme;
}) {
  const styles = carouselStyles(theme);
  const top4 = useMemo(
    () => [...stations].sort((a, b) => a.perUnit - b.perUnit).slice(0, 4),
    [stations]
  );
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      nestedScrollEnabled
    >
      {top4.map((s) => {
        const isSelected = s.id === selectedId;
        const initials = (s.shortName ?? s.name)
          .replace(/[^A-Za-z0-9]/g, "")
          .slice(0, 2)
          .toUpperCase();
        return (
          <Pressable
            key={s.id}
            onPress={() => onSelect(s.id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            accessibilityLabel={`${s.name}, ${formatCurrency(s.perUnit)} per ${formatUnit(s.unit)}`}
            style={({ pressed }) => [
              styles.card,
              isSelected && styles.cardSelected,
              pressed && { opacity: 0.94 },
            ]}
          >
            <View style={styles.headerRow}>
              <View style={styles.brandTile}>
                {s.imageUrl ? (
                  <Image
                    source={{ uri: s.imageUrl }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.brandText}>{initials}</Text>
                )}
              </View>
              <StationBadges
                verified={s.verified}
                isPartner={s.isPartner}
                compact
              />
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {s.name}
            </Text>
            <View style={styles.metaRow}>
              {s.distanceKm != null ? (
                <Text style={styles.metaText}>
                  {s.distanceKm.toFixed(1)} km
                </Text>
              ) : null}
              {s.etaMinutes != null ? (
                <>
                  <Text style={styles.metaDot}>·</Text>
                  <Text style={styles.metaText}>~{s.etaMinutes} min</Text>
                </>
              ) : null}
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.price}>{formatCurrency(s.perUnit)}</Text>
              <Text style={styles.priceUnit}>per {formatUnit(s.unit)}</Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const carouselStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      gap: 10,
      paddingRight: 16,
    },
    card: {
      width: 220,
      padding: 12,
      borderRadius: 14,
      backgroundColor: theme.surface,
      borderWidth: 1.5,
      borderColor: theme.divider,
      gap: 6,
    },
    cardSelected: {
      borderColor: theme.primary,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    brandTile: {
      width: 36,
      height: 36,
      borderRadius: 9,
      backgroundColor: theme.primaryTint,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    brandText: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.mode === "dark" ? "#fff" : theme.palette.green700,
    },
    name: {
      fontSize: 13,
      fontWeight: "800",
      color: theme.fg,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    metaText: {
      fontSize: 11,
      color: theme.fgMuted,
    },
    metaDot: {
      fontSize: 11,
      color: theme.fgMuted,
    },
    priceRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 4,
      marginTop: 2,
    },
    price: {
      fontSize: 15,
      fontWeight: "800",
      color: theme.fg,
      ...theme.type.money,
    },
    priceUnit: {
      fontSize: 10,
      color: theme.fgMuted,
    },
  });

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
        {station.imageUrl ? (
          <Image
            source={{ uri: station.imageUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        ) : (
          <Text style={styles.brandText}>{initials}</Text>
        )}
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {station.name}
          </Text>
          <StationBadges
            verified={station.verified}
            isPartner={station.isPartner}
            compact
          />
        </View>
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
        <Text style={styles.priceUnit}>per {formatUnit(station.unit)}</Text>
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
      overflow: "hidden",
    },
    brandText: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.mode === "dark" ? "#fff" : theme.palette.green700,
    },
    body: { flex: 1, minWidth: 0, gap: 2 },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    name: { fontSize: 13, fontWeight: "800", color: theme.fg, flexShrink: 1 },
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
      // Small breathing room so the row doesn't kiss the SafeAreaView
      // edge — but still visibly the first usable row of content.
      paddingTop: 6,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      zIndex: 5,
    },
    /** Back chip + address pill share a 48px height so the row reads
     *  as a single horizontal bar. Matched borderRadius keeps the
     *  pill ends consistent with the chip's silhouette. */
    backChip: {
      width: 48,
      height: 48,
      borderRadius: 12,
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
      // Use a fixed height instead of paddingVertical so the visual
      // height matches backChip exactly regardless of font metrics.
      height: 48,
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
    sheetHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 12,
    },

    /** Address-icon thumbnail at the destination. Solid primary tile
     *  so the icon glyph (home, briefcase, …) reads as a "your place"
     *  marker. White ring around the tile for contrast against the
     *  pulsing primary-tinted radius ring beneath. */
    destPin: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 3,
      borderColor: theme.surface,
      ...theme.elevation.card,
    },

    /** Floating "Let Gaznger choose" pill wrap — full-width row that
     *  centres the pill horizontally so it sits below the address bar
     *  but above the radius chips. pointerEvents="box-none" lets the
     *  map handle taps that miss the pill. */
    autoPickWrap: {
      position: "absolute",
      left: 0,
      right: 0,
      alignItems: "center",
      zIndex: 4,
    },
    stationPinWrap: {
      alignItems: "center",
    },
    /** Unselected station pin: white fill + 2px primary-green border,
     *  green monogram text. Reads as "available, tap me". */
    stationDot: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: "#fff",
      borderWidth: 2,
      borderColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
      ...theme.elevation.card,
    },
    /** Selected pin: green fill + 3px white halo + slight upscale.
     *  The white border doubles as a visible halo against the map's
     *  green pulse so the selection reads at a glance. */
    stationDotSelected: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: theme.primary,
      borderColor: "#fff",
      borderWidth: 3,
    },
    stationDotText: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.primary,
    },
    stationDotTextSelected: {
      fontSize: 12,
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
