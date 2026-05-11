import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  type MapPressEvent,
  type MarkerDragStartEndEvent,
} from "react-native-maps";
import { Theme, useTheme } from "@/constants/theme";
// Direct imports (NOT via the barrel) so this file doesn't form a
// circular dep through `components/ui/primitives/index.ts` — the
// barrel re-exports AddressSheet itself.
import BottomSheet, { type BottomSheetRef } from "./BottomSheet";
import Button from "./Button";
import StatePickerSheet, { type StatePickerSheetRef } from "./StatePickerSheet";
import {
  matchState,
  NIGERIA_STATES,
  type NigeriaState,
} from "@/constants/nigeriaStates";

// Places + Geocoding key — separate from the native Maps SDK key
// (audit E.7). Falls back to the legacy var so existing dev setups keep
// working until the GCP split is rolled out.
const GOOGLE_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ??
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

/** Lagos default — used as the initial map centre when nothing is picked yet. */
const DEFAULT_CENTER = { latitude: 6.5244, longitude: 3.3792 };

export interface AddressResult {
  /** Free-text address line as the user expects it on a delivery slip. */
  address: string;
  /** Canonical state code (e.g. "lagos"). */
  state: string;
  /** Display label for the state (e.g. "Lagos"). */
  stateLabel: string;
  /** LGA / city name from reverse-geocode. May be empty if we couldn't derive. */
  lga: string;
  latitude: number;
  longitude: number;
}

/** Per-surface copy + behaviour. Defaults target a delivery address. */
export interface AddressSheetCopy {
  /** Sheet title. Default: "Delivery address". */
  title?: string;
  /** Sub-headline under the title. */
  sub?: string;
  /** Search box placeholder. */
  searchPlaceholder?: string;
  /** Confirm button label. Default: "Confirm address". */
  confirmLabel?: string;
}

export interface AddressSheetRef {
  open: (initial?: Partial<AddressResult>) => void;
  close: () => void;
}

interface Props {
  onConfirm: (result: AddressResult) => void;
  /** Per-surface copy override. Defaults target a delivery address. */
  copy?: AddressSheetCopy;
}

interface AutocompleteSuggestion {
  placeId: string;
  primary: string;
  secondary: string;
}

interface PlaceDetails {
  formattedAddress: string;
  latitude: number;
  longitude: number;
  state?: string;
  lga?: string;
}

/**
 * Vendor address picker — search + map drop pin + state dropdown.
 *
 * Three input paths to the same `{address, state, lga, lat, lng}`
 * shape, in order of decreasing speed:
 *   1. Type a query → Google Places Autocomplete suggestions →
 *      tap one → Place Details fills lat/lng + auto-populates
 *      state + LGA via reverse-geocode of the lat/lng.
 *   2. Drag the map pin to refine. We re-reverse-geocode on
 *      release to keep the formatted address + LGA fresh.
 *   3. Manual edit — the user can override the address line and
 *      state dropdown after step 1 or 2.
 *
 * Confirm is disabled until lat/lng + a state are set. We never
 * trust a free-text address alone for a fuel station because the
 * dispatcher needs a real coordinate to compute rider distance.
 */
const AddressSheet = forwardRef<AddressSheetRef, Props>(
  function AddressSheet({ onConfirm, copy }, ref) {
    const titleText = copy?.title ?? "Delivery address";
    const subText =
      copy?.sub ?? "Search the address, then drag the pin if it isn't quite right.";
    const searchPlaceholder = copy?.searchPlaceholder ?? "Search address or landmark";
    const confirmLabel = copy?.confirmLabel ?? "Confirm address";
    const theme = useTheme();
    const styles = useMemo(() => makeStyles(theme), [theme]);
    const sheetRef = useRef<BottomSheetRef>(null);
    const stateSheetRef = useRef<StatePickerSheetRef>(null);
    const mapRef = useRef<MapView>(null);

    const [query, setQuery] = useState("");
    const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
    const [searching, setSearching] = useState(false);
    const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
    const [address, setAddress] = useState("");
    const [state, setState] = useState<NigeriaState | null>(null);
    const [lga, setLga] = useState("");

    useImperativeHandle(ref, () => ({
      open: (initial) => {
        if (initial) {
          if (initial.latitude && initial.longitude) {
            setCoords({ latitude: initial.latitude, longitude: initial.longitude });
          }
          if (initial.address) setAddress(initial.address);
          if (initial.state) {
            const found = NIGERIA_STATES.find((s) => s.code === initial.state);
            if (found) setState(found);
          }
          if (initial.lga) setLga(initial.lga);
        }
        sheetRef.current?.expand();
      },
      close: () => sheetRef.current?.close(),
    }));

    /* ─────────── Autocomplete (debounced) ─────────── */

    useEffect(() => {
      if (!query || query.trim().length < 3) {
        setSuggestions([]);
        return;
      }
      if (!GOOGLE_KEY) {
        // Without a key we can't autocomplete — the user will have to
        // drop the pin manually. Keep silent rather than alarming.
        return;
      }
      let cancelled = false;
      const t = setTimeout(async () => {
        setSearching(true);
        try {
          const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
            query
          )}&key=${GOOGLE_KEY}&components=country:ng`;
          const res = await fetch(url);
          const json = (await res.json()) as {
            predictions?: Array<{
              place_id: string;
              structured_formatting?: { main_text: string; secondary_text: string };
              description: string;
            }>;
          };
          if (cancelled) return;
          const list: AutocompleteSuggestion[] = (json.predictions ?? []).map((p) => ({
            placeId: p.place_id,
            primary: p.structured_formatting?.main_text ?? p.description,
            secondary: p.structured_formatting?.secondary_text ?? "",
          }));
          setSuggestions(list);
        } catch {
          // Network blip — leave previous suggestions visible rather
          // than wiping them and confusing the user.
        } finally {
          if (!cancelled) setSearching(false);
        }
      }, 280);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }, [query]);

    /* ─────────── Place details + reverse-geocode helpers ─────────── */

    const fetchPlaceDetails = async (
      placeId: string
    ): Promise<PlaceDetails | null> => {
      if (!GOOGLE_KEY) return null;
      try {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_address,geometry,address_components&key=${GOOGLE_KEY}`;
        const res = await fetch(url);
        const json = (await res.json()) as {
          result?: {
            formatted_address?: string;
            geometry?: { location?: { lat: number; lng: number } };
            address_components?: Array<{ long_name: string; types: string[] }>;
          };
        };
        const r = json.result;
        if (!r?.geometry?.location) return null;
        const stateComp = r.address_components?.find((c) =>
          c.types.includes("administrative_area_level_1")
        );
        const lgaComp = r.address_components?.find((c) =>
          c.types.includes("administrative_area_level_2")
        ) ?? r.address_components?.find((c) => c.types.includes("locality"));
        return {
          formattedAddress: r.formatted_address ?? "",
          latitude: r.geometry.location.lat,
          longitude: r.geometry.location.lng,
          state: stateComp?.long_name,
          lga: lgaComp?.long_name,
        };
      } catch {
        return null;
      }
    };

    /**
     * Reverse-geocode lat/lng → state + LGA via expo-location's
     * platform geocoder. Used after a pin drag so we don't have to
     * burn another Google billable call. If platform geocoder
     * doesn't return state, we leave the existing selection alone.
     */
    const reverseGeocodeFromExpo = async (
      lat: number,
      lng: number
    ): Promise<{ state?: string; lga?: string; address?: string } | null> => {
      try {
        const results = await Location.reverseGeocodeAsync({
          latitude: lat,
          longitude: lng,
        });
        const r = results[0];
        if (!r) return null;
        return {
          state: r.region ?? undefined,
          lga: r.subregion ?? r.city ?? undefined,
          address: [r.name, r.street, r.city].filter(Boolean).join(", "),
        };
      } catch {
        return null;
      }
    };

    /* ─────────── Handlers ─────────── */

    const handleSuggestion = async (s: AutocompleteSuggestion) => {
      setSearching(true);
      const details = await fetchPlaceDetails(s.placeId);
      setSearching(false);
      if (!details) return;
      setCoords({ latitude: details.latitude, longitude: details.longitude });
      setAddress(details.formattedAddress);
      if (details.state) {
        const matched = matchState(details.state);
        if (matched) setState(matched);
      }
      if (details.lga) setLga(details.lga);
      // Collapse suggestions + recenter map.
      setQuery("");
      setSuggestions([]);
      mapRef.current?.animateToRegion(
        {
          latitude: details.latitude,
          longitude: details.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        300
      );
    };

    const handleMapPress = (e: MapPressEvent) => {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      setCoords({ latitude, longitude });
      void refreshFromCoords(latitude, longitude);
    };

    const handleMarkerDragEnd = (e: MarkerDragStartEndEvent) => {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      setCoords({ latitude, longitude });
      void refreshFromCoords(latitude, longitude);
    };

    const refreshFromCoords = async (latitude: number, longitude: number) => {
      const out = await reverseGeocodeFromExpo(latitude, longitude);
      if (!out) return;
      if (out.address && !address) setAddress(out.address);
      if (out.state) {
        const matched = matchState(out.state);
        if (matched) setState(matched);
      }
      if (out.lga && !lga) setLga(out.lga);
    };

    const canConfirm =
      coords != null && state != null && address.trim().length >= 4;

    const handleConfirm = () => {
      if (!canConfirm || !coords || !state) return;
      onConfirm({
        address: address.trim(),
        state: state.code,
        stateLabel: state.label,
        lga: lga.trim(),
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      sheetRef.current?.close();
    };

    /* ─────────── Render ─────────── */

    const showSuggestions = suggestions.length > 0 && query.length >= 3;
    const center = coords ?? DEFAULT_CENTER;

    return (
      <>
        <BottomSheet
          ref={sheetRef}
          snapPoints={["92%"]}
          initialSnap={0}
          contentStyle={styles.content}
        >
          <Text style={styles.title}>{titleText}</Text>
          <Text style={styles.sub}>{subText}</Text>

          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color={theme.fgMuted} />
            <TextInput
              placeholder={searchPlaceholder}
              placeholderTextColor={theme.fgMuted}
              value={query}
              onChangeText={setQuery}
              style={styles.searchInput}
              autoCorrect={false}
            />
            {searching ? (
              <ActivityIndicator size="small" color={theme.fgMuted} />
            ) : null}
          </View>

          {showSuggestions ? (
            <View style={styles.suggestions}>
              {suggestions.map((s) => (
                <Pressable
                  key={s.placeId}
                  onPress={() => handleSuggestion(s)}
                  accessibilityRole="button"
                  accessibilityLabel={`${s.primary}, ${s.secondary}`}
                  style={({ pressed }) => [
                    styles.suggestionRow,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Ionicons name="location-outline" size={16} color={theme.fgMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestionPrimary} numberOfLines={1}>
                      {s.primary}
                    </Text>
                    {s.secondary ? (
                      <Text style={styles.suggestionSecondary} numberOfLines={1}>
                        {s.secondary}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={styles.mapWrap}>
            <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFill}
              provider={PROVIDER_GOOGLE}
              initialRegion={{
                ...center,
                latitudeDelta: coords ? 0.01 : 0.4,
                longitudeDelta: coords ? 0.01 : 0.4,
              }}
              onPress={handleMapPress}
            >
              {coords ? (
                <Marker
                  coordinate={coords}
                  draggable
                  onDragEnd={handleMarkerDragEnd}
                />
              ) : null}
            </MapView>
            {!coords ? (
              <View style={styles.mapHint} pointerEvents="none">
                <Ionicons name="hand-left-outline" size={14} color={theme.fgMuted} />
                <Text style={styles.mapHintText}>
                  Tap the map or pick a search result to drop the pin.
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>STREET ADDRESS</Text>
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="Building number, street, area"
              placeholderTextColor={theme.fgMuted}
              style={styles.fieldInput}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>STATE</Text>
            <Pressable
              onPress={() => stateSheetRef.current?.open()}
              accessibilityRole="button"
              accessibilityLabel={state ? state.label : "Choose state"}
              style={({ pressed }) => [
                styles.dropdown,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={[styles.dropdownText, !state && { color: theme.fgMuted }]}>
                {state?.label ?? "Choose state"}
              </Text>
              <Ionicons name="chevron-down" size={16} color={theme.fgMuted} />
            </Pressable>
          </View>

          {lga ? (
            <Text style={styles.lgaHint}>LGA detected: {lga}</Text>
          ) : null}

          <Button
            variant="primary"
            size="lg"
            full
            onPress={handleConfirm}
            disabled={!canConfirm}
            accessibilityLabel={confirmLabel}
          >
            {confirmLabel}
          </Button>
        </BottomSheet>

        <StatePickerSheet
          ref={stateSheetRef}
          selected={state}
          onSelect={(s) => setState(s)}
        />
      </>
    );
  }
);

export default AddressSheet;

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: theme.space.s4,
      paddingBottom: theme.space.s4,
      gap: theme.space.s3,
    },
    title: {
      ...theme.type.h2,
      color: theme.fg,
    },
    sub: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    searchRow: {
      height: 48,
      borderRadius: theme.radius.md,
      backgroundColor: theme.bgMuted,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.space.s3,
      gap: theme.space.s2,
    },
    searchInput: {
      flex: 1,
      ...theme.type.body,
      color: theme.fg,
      paddingVertical: 0,
    },
    suggestions: {
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: "hidden",
      backgroundColor: theme.surface,
    },
    suggestionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s3,
      paddingHorizontal: theme.space.s3,
      paddingVertical: theme.space.s3,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.divider,
    },
    suggestionPrimary: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
    },
    suggestionSecondary: {
      ...theme.type.caption,
      color: theme.fgMuted,
    },
    mapWrap: {
      height: 200,
      borderRadius: theme.radius.lg,
      overflow: "hidden",
      backgroundColor: theme.bgMuted,
    },
    mapHint: {
      position: "absolute",
      bottom: 12,
      left: 12,
      right: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: theme.space.s3,
      paddingVertical: theme.space.s2,
      backgroundColor: theme.surface,
      borderRadius: theme.radius.pill,
      ...theme.elevation.card,
    },
    mapHintText: {
      ...theme.type.caption,
      color: theme.fgMuted,
      flex: 1,
    },
    fieldGroup: {
      gap: 6,
    },
    label: {
      ...theme.type.micro,
      color: theme.fgMuted,
    },
    fieldInput: {
      height: 48,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingHorizontal: theme.space.s3,
      ...theme.type.body,
      color: theme.fg,
      paddingVertical: 0,
    },
    dropdown: {
      height: 48,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.space.s3,
    },
    dropdownText: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "600",
    },
    lgaHint: {
      ...theme.type.caption,
      color: theme.fgMuted,
      marginTop: -theme.space.s1,
    },
  });
