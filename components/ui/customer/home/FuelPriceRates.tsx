import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Theme, useTheme, formatCurrency } from "@/constants/theme";
import { Skeleton } from "@/components/ui/primitives";

/**
 * "TODAY" rates strip on Home.
 *
 * Informational market rates — shows what stations near the user are charging
 * for each fuel. NOT the customer's actual price; the locked unit price is
 * still set at the Stations screen per the pricing rule.
 *
 * Layout: TODAY pill + slow-scrolling horizontal marquee of [price/unit /
 * fuel-name] entries.
 *
 * Marquee impl:
 *  - The fuel list is rendered twice back-to-back, then translated leftward
 *    in a continuous loop (~25s per full cycle). A single `Animated.loop`
 *    with `useNativeDriver: true` keeps it at 60fps.
 *  - Animation halts when reduceMotion is enabled (RN handles this at the OS
 *    level for native-driver timing).
 */

export interface FuelRate {
  /** Stable fuel id, matches FuelGrid items. */
  id: string;
  /** Short label, e.g. "Petrol". */
  label: string;
  /** Price in Naira. Single fixed value (per current design). */
  amount: number;
  /** Unit, e.g. "L" or "kg". */
  unit: string;
}

interface FuelPriceRatesProps {
  rates?: FuelRate[];
  loading?: boolean;
  /** Optional area / city the prices are scoped to. */
  area?: string | null;
  /** Tap an entry → open Stations to lock a price. */
  onPick?: (fuelId: string) => void;
  /** Override marquee duration (ms for one full cycle). Default 25_000. */
  cycleMs?: number;
}

export default function FuelPriceRates({
  rates,
  loading = false,
  area,
  onPick,
  cycleMs = 25_000,
}: FuelPriceRatesProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const data = rates ?? [];
  const isLoading = loading;

  const trackTranslate = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);

  // Restart the loop whenever the measured width or duration changes.
  useEffect(() => {
    if (!trackWidth || isLoading || data.length === 0) return;
    trackTranslate.setValue(0);
    const loop = Animated.loop(
      Animated.timing(trackTranslate, {
        toValue: -trackWidth,
        duration: cycleMs,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [trackWidth, cycleMs, isLoading, data.length, trackTranslate]);

  const onTrackLayout = (e: LayoutChangeEvent) => {
    // Capture the width of ONE track copy (we render two back-to-back).
    const w = e.nativeEvent.layout.width;
    if (w && w !== trackWidth) setTrackWidth(w);
  };

  if (!isLoading && data.length === 0) return null;

  return (
    <View>
      <View style={styles.card}>
        <View style={styles.todayPill}>
          <Text style={styles.todayText}>TODAY</Text>
        </View>

        <View style={styles.marqueeViewport}>
          {isLoading ? (
            <View style={styles.row}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={styles.entry}>
                  <Skeleton width={64} height={16} />
                  <Skeleton width={48} height={12} />
                </View>
              ))}
            </View>
          ) : (
            <Animated.View
              style={[
                styles.track,
                { transform: [{ translateX: trackTranslate }] },
              ]}
            >
              {/* First copy — measured for loop distance. */}
              <View style={styles.row} onLayout={onTrackLayout}>
                {data.map((r) => (
                  <RateEntry
                    key={`a-${r.id}`}
                    rate={r}
                    onPress={onPick}
                    styles={styles}
                  />
                ))}
              </View>
              {/* Second copy — keeps the strip visually full while the first scrolls off. */}
              <View style={styles.row}>
                {data.map((r) => (
                  <RateEntry
                    key={`b-${r.id}`}
                    rate={r}
                    onPress={onPick}
                    styles={styles}
                  />
                ))}
              </View>
            </Animated.View>
          )}
        </View>
      </View>

      <Text style={styles.footnote}>
        {/* Future: append ` · ${area}` once we wire location to the rate API. */}
        Fuel rates near you.
      </Text>
    </View>
  );
}

function RateEntry({
  rate,
  onPress,
  styles,
}: {
  rate: FuelRate;
  onPress?: (id: string) => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      onPress={() => onPress?.(rate.id)}
      accessibilityRole="button"
      accessibilityLabel={`${rate.label} ${formatCurrency(rate.amount)} per ${rate.unit}. Tap to choose a station.`}
      style={({ pressed }) => [styles.entry, pressed && { opacity: 0.85 }]}
    >
      <Text style={styles.price} numberOfLines={1}>
        <Text style={styles.priceMain}>{formatCurrency(rate.amount)}</Text>
        <Text style={styles.priceUnit}>/{rate.unit}</Text>
      </Text>
      <Text style={styles.label} numberOfLines={1}>
        {rate.label}
      </Text>
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s3,
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: theme.radius.lg,
      paddingHorizontal: theme.space.s3 + 2,
      paddingVertical: theme.space.s3,
      overflow: "hidden",
    },
    todayPill: {
      backgroundColor: theme.primaryTint,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.space.s2 + 2, // 10
      paddingVertical: 4,
    },
    todayText: {
      ...theme.type.micro,
      color: theme.primary,
      fontWeight: "800",
    },
    marqueeViewport: {
      flex: 1,
      overflow: "hidden",
    },
    track: {
      flexDirection: "row",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s4 + 8, // 24 — wider gap so single values don't crowd
      paddingRight: theme.space.s4 + 8,
    },
    entry: {
      gap: 2,
    },
    price: {
      ...theme.type.body,
      ...theme.type.money,
      color: theme.fg,
    },
    priceMain: {
      fontWeight: "800",
      color: theme.fg,
    },
    priceUnit: {
      color: theme.fgMuted,
      fontWeight: "600",
    },
    label: {
      ...theme.type.caption,
      color: theme.fgMuted,
    },
    footnote: {
      ...theme.type.caption,
      color: theme.fgSubtle,
      marginTop: theme.space.s2,
      marginLeft: theme.space.s2,
    },
  });
