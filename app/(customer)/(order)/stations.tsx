import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Theme, useTheme, formatCurrency } from "@/constants/theme";
import { useOrderStore } from "@/store/useOrderStore";
import { api } from "@/lib/api";
import { Station } from "@/types";
import {
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
import { useFlowProgress } from "@/components/ui/customer/order/useFlowProgress";
import { useUserLocation } from "@/hooks/useUserLocation";

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
    etaMinutes:
      typeof (s as { etaMinutes?: number }).etaMinutes === "number"
        ? (s as { etaMinutes?: number }).etaMinutes
        : typeof s.distance === "number"
        ? Math.max(5, Math.round(s.distance * 3))
        : undefined,
    rating: s.rating,
    perUnit: priceForFuel(s, fuelTypeId),
    unit,
    verified: s.verified || s.isPartner,
    imageUrl: s.image,
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
  const [stations, setStations] = useState<StationCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const qty = draft.qty ?? draft.quantity ?? 0;
  const unit = draft.unit ?? "L";
  const fuelId = draft.fuelTypeId ?? "petrol";

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
      const tryRadius = async (r: number) => {
        const res = await api.get<{ data: Station[] }>(
          `/api/stations?lat=${queryCoords.lat}&lng=${queryCoords.lng}&radius=${r}`,
          { timeoutMs: 12000 }
        );
        return res.data ?? [];
      };
      // Auto-radius expansion: 5km → 10km → 25km. Stops at the first hit.
      let raw = await tryRadius(5);
      if (raw.length === 0) raw = await tryRadius(10);
      if (raw.length === 0) raw = await tryRadius(25);

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
  }, [draft.deliveryCoords, userLocation, fuelId, unit, selectedId]);

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

  return (
    <ScreenContainer
      edges={["top", "bottom"]}
      contentStyle={styles.scroll}
      header={<ScreenHeader title="Choose your station" />}
      footer={
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
      }
    >
      <View style={styles.body}>
        <ProgressDots step={progressStep} total={progressTotal} variant="bars" />

        {/* Sort chips */}
        <View style={styles.sortRow}>
          {(["nearest", "cheapest", "top-rated"] as SortKey[]).map((k) => {
            const isSel = k === sort;
            return (
              <Pressable
                key={k}
                onPress={() => setSort(k)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSel }}
                accessibilityLabel={`Sort by ${SORT_LABELS[k]}`}
                style={({ pressed }) => [
                  styles.chip,
                  isSel && styles.chipSelected,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: isSel ? theme.bg : theme.fg },
                  ]}
                >
                  {SORT_LABELS[k]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>STATIONS · SORTED LIVE</Text>

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
            title="No stations within range"
            body="We don't deliver from any station near you yet."
            action={{
              label: "Try a different fuel",
              onPress: () => router.back(),
            }}
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
    chip: {
      flex: 1,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: theme.radius.pill,
    },
    chipSelected: {
      backgroundColor: theme.fg,
      borderColor: theme.fg,
    },
    chipText: {
      ...theme.type.caption,
      fontWeight: "700",
    },
    sectionLabel: {
      ...theme.type.micro,
      fontSize: 13,
      letterSpacing: 0.6,
      color: theme.fgMuted,
    },
    col: { gap: theme.space.s2 },
  });
