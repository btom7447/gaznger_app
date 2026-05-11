import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Theme, useTheme, formatCurrency } from "@/constants/theme";
import { useOrderStore } from "@/store/useOrderStore";
import { api } from "@/lib/api";
import { Station } from "@/types";
import {
  Chip,
  EmptyState,
  ErrorStrip,
  FloatingCTA,
  ProgressDots,
  ScreenContainer,
  ScreenHeader,
  Skeleton,
} from "@/components/ui/primitives";
import StationCard, {
  StationCardData,
} from "@/components/ui/customer/order/StationCard";
import StationsViewToggle, {
  StationsViewMode,
} from "@/components/ui/customer/order/StationsViewToggle";
import StationsMapView from "@/components/ui/customer/order/StationsMapView";
import { useFlowProgress } from "@/components/ui/customer/order/useFlowProgress";
import { useUserLocation } from "@/hooks/useUserLocation";
import {
  GaznerChooseCard,
  GaznerChoosePickedBody,
  fetchAutoPick,
  type AutoPickResult,
} from "@/components/ui/customer/order/GaznerChoose";
import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import Toast from "react-native-toast-message";

type SortKey = "nearest" | "cheapest" | "top-rated";

const SORT_LABELS: Record<SortKey, string> = {
  nearest: "Nearest",
  cheapest: "Cheapest",
  "top-rated": "Top rated",
};

const FUEL_NAME_MATCHERS: Record<string, RegExp> = {
  petrol: /\bpetrol\b|\bpms\b/i,
  diesel: /\bdiesel\b|\bago\b/i,
  kero: /\bkero|\bdpk\b/i,
  // LPG is "Gas" in the seed data; accept both the slug and the family name.
  // Per pricing model, vendors set the per-kg price on the station's `fuels[]`
  // entry (same shape as petrol/diesel), so the same priceForFuel pathway works.
  lpg: /\b(lpg|gas|cooking gas)\b/i,
};

/**
 * Pick the price for the user's selected fuel from a station's `fuels[]`.
 * Returns 0 if no match (caller should hide).
 */
function priceForFuel(station: Station, fuelTypeId: string): number {
  const matcher = FUEL_NAME_MATCHERS[fuelTypeId];
  if (!matcher) return 0;
  const match = station.fuels?.find((f) => matcher.test(f.fuel.name));
  return match?.pricePerUnit ?? 0;
}

/**
 * Format an ISO date as "Mon YYYY" — used for "Partner since {date}".
 * Returns undefined when the input is missing/unparseable so the
 * detail sheet can fall back to a partner-since-less label.
 */
function formatMonthYear(iso?: string | null): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString("en-NG", { month: "short", year: "numeric" });
}

/**
 * Convert an ISO timestamp into a relative "X ago" copy. Coarse buckets
 * (min / hr / day) are enough for the "Last Gaznger dispense" surface;
 * we don't need second-precision.
 */
function formatRelativeAgo(iso?: string): string | undefined {
  if (!iso) return undefined;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return undefined;
  const diffMin = Math.max(1, Math.round((Date.now() - t) / 60000));
  if (diffMin < 60) return `${diffMin} min ago`;
  const hr = Math.round(diffMin / 60);
  if (hr < 24) return `${hr} hr ago`;
  const days = Math.round(hr / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function adapt(s: Station, fuelTypeId: string, unit: string): StationCardData {
  return {
    id: s._id,
    name: s.name,
    shortName: s.name.split(/[, ]/)[0],
    address: s.address,
    distanceKm: s.distance,
    // Server returns canonical etaMinutes when the caller passes lat/lng.
    // Fall back to the distance-based heuristic for older API builds
    // that haven't shipped the field yet.
    // Server returns canonical etaMinutes when the caller passes lat/lng
    // (drive-time heuristic + 10-min expectation buffer). Fallback for
    // older API builds applies the same buffer locally so the copy
    // doesn't shift the moment the server rolls out.
    etaMinutes:
      typeof s.etaMinutes === "number"
        ? s.etaMinutes
        : typeof s.distance === "number"
        ? Math.max(5, Math.round(s.distance * 3)) + 10
        : undefined,
    rating: s.rating,
    totalRatings: s.totalRatings,
    perUnit: priceForFuel(s, fuelTypeId),
    unit,
    // Keep the two flags separate. The list row surfaces both as
    // distinct badges so customers can read "NMDPRA-verified" vs
    // "Gaznger Partner" at a glance instead of conflating them.
    verified: s.verified,
    isPartner: s.isPartner,
    partnerSince: formatMonthYear(s.partnerSince),
    lat: s.location?.lat,
    lng: s.location?.lng,
    imageUrl: s.image,
    images: s.images,
    operatingHours:
      s.operatingHours?.open && s.operatingHours?.close
        ? `${s.operatingHours.open} – ${s.operatingHours.close}`
        : undefined,
    availableFuels: s.fuels?.map((f) => f.fuelName).filter(Boolean) as string[],
    serviceTime: s.serviceTime,
    paymentOptions: s.paymentOptions,
    lastDispenseAgo: formatRelativeAgo(s.lastDispenseAt),
    onTimeRate: s.onTimeRate,
  };
}

export default function StationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const draft = useOrderStore((s) => s.order);
  const lockStation = useOrderStore((s) => s.lockStation);
  const { step: progressStep, total: progressTotal } = useFlowProgress("stations");
  const { location: userLocation } = useUserLocation();

  const [sort, setSort] = useState<SortKey>("nearest");
  const [viewMode, setViewMode] = useState<StationsViewMode>("list");
  const [stations, setStations] = useState<StationCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const qty = draft.qty ?? draft.quantity ?? 0;
  const unit = draft.unit ?? "L";
  const fuelId = draft.fuelTypeId ?? "petrol";

  // "Let Gaznger Choose" — auto-pick state + result sheet ref. The
  // picked sheet is a BottomSheetModal so it floats over the list and
  // doesn't push the existing layout around. Single ref reused
  // across list + map view so a stale snapshot can't briefly render
  // in the second sheet when viewMode flips (audit G.2).
  const pickedSheetRef = useRef<BottomSheetModal>(null);
  const [pickLoading, setPickLoading] = useState(false);
  const [pickResult, setPickResult] = useState<AutoPickResult | null>(null);

  const handleAutoPick = useCallback(async () => {
    const coords = draft.deliveryCoords ?? userLocation ?? null;
    if (!coords) {
      Toast.show({
        type: "error",
        text1: "Set a delivery address first",
      });
      return;
    }
    setPickLoading(true);
    try {
      const result = await fetchAutoPick({
        lat: coords.lat,
        lng: coords.lng,
        radiusKm: 10,
      });
      setPickResult(result);
      pickedSheetRef.current?.present();
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as Error).message)
          : "Couldn't pick a station";
      Toast.show({ type: "error", text1: msg });
    } finally {
      setPickLoading(false);
    }
  }, [draft.deliveryCoords, userLocation]);

  // "Use this station" — auto-select + lock + navigate in one tap.
  // We don't wait for setSelectedId → re-render → handleContinue,
  // because the user expects the picked station to commit immediately.
  // Pull the pricing details off the auto-pick result so we can lock
  // without a list lookup (the picked station may be the cheapest one
  // outside the active radius too).
  const handleUsePicked = useCallback(() => {
    if (!pickResult) return;
    const s = pickResult.station;
    // Resolve the perUnit price for the user's selected fuel from
    // the picked station's fuels array. Falls back to the cheapest
    // available price if the fuel match fails so we don't lock 0.
    const unitPrice = (() => {
      const matched = priceForFuel(s as Station, fuelId);
      if (matched > 0) return matched;
      const prices = (s.fuels ?? [])
        .map((f) => f.pricePerUnit)
        .filter((p) => typeof p === "number" && p > 0);
      return prices.length ? Math.min(...prices) : 0;
    })();
    if (unitPrice <= 0) {
      Toast.show({
        type: "error",
        text1: "Couldn't read this station's price",
      });
      return;
    }
    setSelectedId(s._id);
    lockStation({
      id: s._id,
      name: s.name,
      shortName: s.name.split(/[, ]/)[0],
      address: s.address,
      perUnitKobo: unitPrice * 100,
      distMeters:
        typeof s.distance === "number" ? Math.round(s.distance * 1000) : undefined,
      etaMinutes: s.etaMinutes,
      partnerVerified: s.verified,
    });
    pickedSheetRef.current?.dismiss();
    router.push("/(customer)/(order)/payment" as never);
  }, [pickResult, fuelId, lockStation, router]);

  // Radius is derived from the active sort: "nearest" tightens to 5 km
  // (you don't want a "nearest" sort showing stations 18 km away), every
  // other sort defaults to 10 km. The user can override with the "Try
  // wider radius" CTA on the empty state (audit G.1) — bumping to 15 km
  // gives sparse-area users a path forward without leaving the screen.
  const [widenedKm, setWidenedKm] = useState<number | null>(null);
  // Reset the widen override whenever the sort changes — sort change
  // is the user's signal to re-narrow, not "wider radius forever."
  useEffect(() => {
    setWidenedKm(null);
  }, [sort]);
  const radiusKm = widenedKm ?? (sort === "nearest" ? 5 : 10);

  const fetchStations = useCallback(async () => {
    // Resolve query coords: delivery address first, then user GPS as fallback.
    // Without this fallback, addresses missing lat/lng made the screen show
    // an empty fallback even when seed stations existed.
    const queryCoords = draft.deliveryCoords ?? userLocation ?? null;
    if (!queryCoords) {
      // Still nothing — wait for either coords source to resolve.
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: Station[] }>(
        `/api/stations?lat=${queryCoords.lat}&lng=${queryCoords.lng}&radius=${radiusKm}`,
        { timeoutMs: 12000 }
      );
      const raw = res.data ?? [];

      // Filter by user's criteria:
      //   1. Carries the requested fuel (perUnit > 0)
      //   2. Open right now — server-flagged via Station.isOpen. We treat
      //      `undefined` as open (legacy seed data without the flag).
      // Future criteria (slot availability for scheduled time, partner
      // verification preference, max distance) plug in here.
      const adapted = raw
        .filter((s) => s.isOpen !== false)
        .map((s) => adapt(s, fuelId, unit))
        .filter((s) => s.perUnit > 0);
      setStations(adapted);

      // Auto-select first by default sort if user hasn't picked yet.
      if (!selectedId && adapted.length > 0) {
        setSelectedId(adapted[0].id);
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as Error).message)
          : "Couldn't load stations";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [draft.deliveryCoords, userLocation, fuelId, unit, selectedId, radiusKm]);

  useEffect(() => {
    fetchStations();
  }, [fetchStations]);

  // Sort the list locally on change.
  const sorted = useMemo(() => {
    const copy = [...stations];
    switch (sort) {
      case "cheapest":
        copy.sort((a, b) => a.perUnit - b.perUnit);
        break;
      case "top-rated":
        copy.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
        break;
      case "nearest":
      default:
        copy.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
        break;
    }
    return copy;
  }, [stations, sort]);

  const selected = useMemo(
    () => sorted.find((s) => s.id === selectedId) ?? null,
    [sorted, selectedId]
  );

  const total = selected ? selected.perUnit * qty : 0;

  const handleContinue = useCallback(() => {
    if (!selected) return;
    lockStation({
      id: selected.id,
      name: selected.name,
      shortName: selected.shortName,
      address: selected.address,
      perUnitKobo: selected.perUnit * 100,
      distMeters:
        selected.distanceKm != null
          ? Math.round(selected.distanceKm * 1000)
          : undefined,
      etaMinutes: selected.etaMinutes,
      partnerVerified: selected.verified,
    });
    router.push("/(customer)/(order)/payment" as never);
  }, [selected, lockStation, router]);

  const ctaFooter = (
    <FloatingCTA
      label={
        selected
          ? `Continue · ${selected.shortName ?? selected.name}`
          : "Pick a station to continue"
      }
      subtitle={
        selected
          ? `${qty} ${unit} × ${formatCurrency(selected.perUnit)} = ${formatCurrency(total)}`
          : undefined
      }
      disabled={!selected}
      onPress={handleContinue}
      floating={false}
    />
  );

  // Picked-result sheet — rendered once, referenced by both
  // viewMode branches (audit G.2). Sits inside whichever
  // ScreenContainer is active; gorhom's `BottomSheetModalProvider`
  // (mounted at root) handles the actual portal so it floats above
  // map + list views identically.
  const pickedSheet = (
    <BottomSheetModal
      ref={pickedSheetRef}
      snapPoints={["78%", "92%"]}
      backgroundStyle={{ backgroundColor: theme.bg }}
      handleIndicatorStyle={{ backgroundColor: theme.borderStrong }}
      onDismiss={() => setPickResult(null)}
    >
      <BottomSheetView>
        {pickResult ? (
          <GaznerChoosePickedBody
            result={pickResult}
            onUse={handleUsePicked}
            onPickAnother={() => pickedSheetRef.current?.dismiss()}
          />
        ) : null}
      </BottomSheetView>
    </BottomSheetModal>
  );

  // Map view replaces the scrollable body entirely — it owns the full
  // canvas with its own bottom sheet for the station list, and renders
  // its own top-row chrome (back chip + "Delivering to" pill). The
  // List/Map toggle moves into the bottom sheet header instead of the
  // screen header, per the v3 design's map layout.
  if (viewMode === "map") {
    return (
      <ScreenContainer
        // Bottom-only safe-area: the map renders edge-to-edge up to
        // the status bar. Top safe-area would put a coloured gap
        // between the status bar and the map. The map view handles
        // its own status-bar collision via the topHeader's small
        // paddingTop so the back chip + address pill sit clear of
        // the OS chrome without an explicit safe-area pad.
        edges={["bottom"]}
        // noScroll keeps the body as a flat <View flex:1> so the map
        // + bottom sheet get the full screen height they need.
        noScroll
        footer={ctaFooter}
      >
        <StationsMapView
          stations={sorted}
          selectedId={selectedId}
          onSelect={setSelectedId}
          destination={draft.deliveryCoords ?? userLocation ?? null}
          destinationLabel={draft.deliveryLabel}
          destinationIcon={draft.deliveryIcon}
          sort={sort}
          onSort={setSort}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onAutoPick={handleAutoPick}
          autoPickLoading={pickLoading}
          radiusKm={radiusKm}
        />

        {pickedSheet}
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      edges={["top", "bottom"]}
      contentStyle={styles.scroll}
      header={
        <ScreenHeader
          title="Choose your station"
          rightNode={
            <StationsViewToggle mode={viewMode} onChange={setViewMode} />
          }
        />
      }
      footer={ctaFooter}
    >
      <View style={styles.body}>
        <ProgressDots step={progressStep} total={progressTotal} variant="bars" />

        {/* Let Gaznger choose — partner-weighted auto-pick banner.
            Sits above the sort chips so it's the first thing a
            decision-fatigued user sees. Skipped while loading or in
            an error state since there's nothing meaningful to pick. */}
        {!loading && !error && sorted.length > 0 ? (
          <GaznerChooseCard onPress={handleAutoPick} loading={pickLoading} />
        ) : null}

        {/* Sort chips — v3 Chip primitive, neutral kind. The
            "Cheapest" preset is the single most-asked-for sort; we
            keep "Nearest" first (most useful default for people who
            want fast fuel) per UX direction. */}
        <View style={styles.sortRow}>
          {(["nearest", "cheapest", "top-rated"] as SortKey[]).map((k) => (
            <Chip
              key={k}
              selected={k === sort}
              onPress={() => setSort(k)}
              accessibilityLabel={`Sort by ${SORT_LABELS[k]}`}
            >
              {SORT_LABELS[k]}
            </Chip>
          ))}
        </View>

        {error ? (
          <ErrorStrip
            variant="error"
            message="Couldn't load stations. Tap to retry."
            action={{ label: "Retry", onPress: fetchStations }}
          />
        ) : null}

        {loading ? (
          <View style={styles.col}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton
                key={i}
                width="100%"
                height={78}
                borderRadius={theme.radius.lg}
              />
            ))}
          </View>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon="flame-outline"
            title={`No stations within ${radiusKm} km`}
            body={
              widenedKm
                ? "We don't deliver from any station near you yet. Try a different fuel?"
                : "Try a wider search radius — there may be stations a bit further out."
            }
            action={
              widenedKm
                ? {
                    label: "Try a different fuel",
                    onPress: () => router.back(),
                  }
                : {
                    label: "Try wider radius (15 km)",
                    onPress: () => setWidenedKm(15),
                  }
            }
            tileBg={theme.bgMuted}
            tileFg={theme.fgMuted}
          />
        ) : (
          <View style={styles.col}>
            {sorted.map((s) => (
              <StationCard
                key={s.id}
                station={s}
                selected={s.id === selectedId}
                onPress={() => setSelectedId(s.id)}
              />
            ))}
          </View>
        )}
      </View>

      {pickedSheet}
    </ScreenContainer>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    scroll: {
      paddingBottom: theme.space.s5,
    },
    body: {
      paddingHorizontal: theme.space.s4,
      gap: theme.space.s4,
      paddingTop: theme.space.s2,
    },
    sortRow: {
      flexDirection: "row",
      gap: theme.space.s2,
    },
    col: { gap: theme.space.s2 },
  });
