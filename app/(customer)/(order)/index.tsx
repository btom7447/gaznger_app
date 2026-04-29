import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Theme, useTheme } from "@/constants/theme";
import {
  ServiceType,
  useOrderStore,
} from "@/store/useOrderStore";
import {
  FloatingCTA,
  ProgressDots,
  ScreenContainer,
  ScreenHeader,
  Stepper,
} from "@/components/ui/primitives";
import FuelSelectGrid, {
  ALL_FUELS,
} from "@/components/ui/customer/order/FuelSelectGrid";
import QuickChips from "@/components/ui/customer/order/QuickChips";
import LpgServicePicker from "@/components/ui/customer/order/LpgServicePicker";
import CylinderSizeGrid from "@/components/ui/customer/order/CylinderSizeGrid";
import { useFlowProgress } from "@/components/ui/customer/order/useFlowProgress";

const QTY_MIN_LIQUID = 5;
const QTY_MAX_LIQUID = 200;
const QTY_DEFAULT_LIQUID = 15;
const QUICK_VALUES_LIQUID = [10, 15, 25, 50];

// LPG bounds match the cylinder size grid (3..100 kg).
// Default is 12 kg (NG household standard).
const QTY_MIN_LPG = 3;
const QTY_MAX_LPG = 100;
const QTY_DEFAULT_LPG = 12;
// Quick chips removed for LPG — the cylinder size grid acts as presets.
const QUICK_VALUES_LPG: number[] = [];

const FUEL_TILE_BY_ID: Record<string, { label: string }> = {
  petrol: { label: "Petrol" },
  diesel: { label: "Diesel" },
  kero: { label: "Kerosene" },
  lpg: { label: "LPG" },
};

/**
 * Unified Order screen — handles all 4 fuels in one route.
 *
 * - Liquid (Petrol/Diesel/Kero): fuel + qty + Continue → Delivery
 * - LPG: header flips to "Cooking gas", swaps mid-section to qty + service + size
 *   - Refill → Continue → Delivery
 *   - Swap   → Continue · cylinder details → Cylinder
 *
 * Pricing rule (handoff/06-acceptance-criteria.md): NO price, NO estimate,
 * NO money echo on the CTA. Capture fuel + qty + (LPG) service/size only.
 */
export default function OrderScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const params = useLocalSearchParams<{ fuel?: string }>();
  const draft = useOrderStore((s) => s.order);
  const startOrder = useOrderStore((s) => s.startOrder);
  const setQty = useOrderStore((s) => s.setQty);
  const setServiceType = useOrderStore((s) => s.setServiceType);
  const setCylinderType = useOrderStore((s) => s.setCylinderType);

  const selectedFuel = draft.fuelTypeId ?? null;
  const isLpg = selectedFuel === "lpg";

  // Bounds depend on product.
  const QTY_MIN = isLpg ? QTY_MIN_LPG : QTY_MIN_LIQUID;
  const QTY_MAX = isLpg ? QTY_MAX_LPG : QTY_MAX_LIQUID;
  const QTY_DEFAULT = isLpg ? QTY_DEFAULT_LPG : QTY_DEFAULT_LIQUID;
  const QUICK_VALUES = isLpg ? QUICK_VALUES_LPG : QUICK_VALUES_LIQUID;
  const unit: "L" | "kg" = isLpg ? "kg" : "L";

  // Local quantity (mirrored to store).
  const [qty, setLocalQty] = useState<number>(
    draft.qty && draft.qty > 0 ? draft.qty : QTY_DEFAULT
  );
  useEffect(() => {
    setQty(qty);
  }, [qty, setQty]);

  // ── LPG-only state ──
  const [service, setLocalService] = useState<ServiceType>(
    (draft.serviceType as ServiceType | undefined) ?? "refill"
  );
  // For LPG, the cylinder size IS the qty (synced both ways).
  // We keep the store's `cylinderType` field updated as "{kg}kg" for any
  // legacy code that reads the string label.
  useEffect(() => {
    if (!isLpg) return;
    setServiceType(service);
    setCylinderType(`${qty}kg`);
  }, [isLpg, service, qty, setServiceType, setCylinderType]);

  // ── hydrate from query string (Home tap) — runs ONCE per param value. ──
  // Without this guard, re-selecting on this screen would be overwritten by
  // the URL param the next render.
  const hydratedRef = useRef<string | null>(null);
  useEffect(() => {
    const incoming = params.fuel ?? null;
    if (!incoming) return;
    if (hydratedRef.current === incoming) return;
    hydratedRef.current = incoming;

    const product = incoming === "lpg" ? "lpg" : "liquid";
    const u = product === "lpg" ? "kg" : "L";
    startOrder({ product, fuelTypeId: incoming, unit: u });

    // Reset qty to the matching default when product family changes.
    setLocalQty(product === "lpg" ? QTY_DEFAULT_LPG : QTY_DEFAULT_LIQUID);
  }, [params.fuel, startOrder]);

  const handleFuelSelect = useCallback(
    (id: string) => {
      const product = id === "lpg" ? "lpg" : "liquid";
      const u = product === "lpg" ? "kg" : "L";
      startOrder({ product, fuelTypeId: id, unit: u });
      // Reset qty to the matching default when product family changes.
      const isToLpg = product === "lpg";
      const wasLpg = selectedFuel === "lpg";
      if (isToLpg !== wasLpg) {
        setLocalQty(isToLpg ? QTY_DEFAULT_LPG : QTY_DEFAULT_LIQUID);
      }
      // Mark the new id as hydrated so the param effect doesn't overwrite.
      hydratedRef.current = id;
    },
    [startOrder, selectedFuel]
  );

  const { step, total } = useFlowProgress("order");

  const handleContinue = useCallback(() => {
    if (!selectedFuel) return;
    if (isLpg && service === "swap") {
      router.push("/(customer)/(order)/cylinder" as never);
    } else {
      router.push("/(customer)/(order)/delivery" as never);
    }
  }, [selectedFuel, isLpg, service, router]);

  const continueLabel =
    isLpg && service === "swap" ? "Continue · cylinder details" : "Continue";

  const ctaDisabled =
    !selectedFuel || qty < QTY_MIN || qty > QTY_MAX || (isLpg && !service);

  const fuelTile = selectedFuel ? FUEL_TILE_BY_ID[selectedFuel] : null;

  return (
    <ScreenContainer
      edges={["top", "bottom"]}
      contentStyle={styles.scroll}
      header={<ScreenHeader title="What & how much" />}
      footer={
        <FloatingCTA
          label={continueLabel}
          disabled={ctaDisabled}
          onPress={handleContinue}
          floating={false}
          accessibilityHint={
            !selectedFuel ? "Pick a fuel to continue" : undefined
          }
        />
      }
    >
      <Animated.View
        layout={LinearTransition.springify().damping(22).stiffness(220)}
        style={styles.body}
      >
        {/* Selected fuel banner above ProgressDots */}
        {fuelTile ? (
          <Animated.Text
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(120)}
            layout={LinearTransition}
            style={styles.fuelBanner}
          >
            {fuelTile.label.toUpperCase()}
          </Animated.Text>
        ) : null}

        <Animated.View layout={LinearTransition}>
          <ProgressDots step={step} total={total} variant="bars" />
        </Animated.View>

        <Animated.View
          layout={LinearTransition.springify().damping(22).stiffness(220)}
          style={styles.section}
        >
          <Text style={styles.sectionLabel}>FUEL</Text>
          <FuelSelectGrid
            items={ALL_FUELS}
            selectedId={selectedFuel}
            onSelect={handleFuelSelect}
          />
        </Animated.View>

        {/* LPG: Service comes BEFORE How much. */}
        {isLpg ? (
          <Animated.View
            entering={FadeIn.duration(220)}
            exiting={FadeOut.duration(140)}
            layout={LinearTransition.springify().damping(22).stiffness(220)}
            style={styles.section}
          >
            <Text style={styles.sectionLabel}>SERVICE</Text>
            <LpgServicePicker value={service} onChange={setLocalService} />
          </Animated.View>
        ) : null}

        {selectedFuel ? (
          <Animated.View
            entering={FadeIn.duration(220)}
            exiting={FadeOut.duration(140)}
            layout={LinearTransition.springify().damping(22).stiffness(220)}
            style={styles.section}
          >
            <Text style={styles.sectionLabel}>HOW MUCH</Text>
            <Stepper
              value={qty}
              onChange={setLocalQty}
              min={QTY_MIN}
              max={QTY_MAX}
              unit={unit}
              helper={`Min ${QTY_MIN} ${unit} · Max ${QTY_MAX} ${unit}`}
            />
            {/*
             * Liquid: show quick-pick chips (10/15/25/50 L).
             * LPG: chips are redundant since CylinderSize doubles as the
             * preset picker — skip them here.
             */}
            {!isLpg ? (
              <Animated.View
                entering={FadeIn.duration(180)}
                exiting={FadeOut.duration(120)}
                layout={LinearTransition}
              >
                <QuickChips
                  values={QUICK_VALUES}
                  unit={unit}
                  selected={qty}
                  onChange={setLocalQty}
                />
              </Animated.View>
            ) : null}
          </Animated.View>
        ) : null}

        {/* LPG: cylinder size + NMDPRA strip below How much. */}
        {isLpg ? (
          <>
            <Animated.View
              entering={FadeIn.duration(220)}
              exiting={FadeOut.duration(140)}
              layout={LinearTransition.springify().damping(22).stiffness(220)}
              style={styles.section}
            >
              <Text style={styles.sectionLabel}>CYLINDER SIZE</Text>
              <CylinderSizeGrid value={qty} onChange={setLocalQty} />
              <Text style={styles.helperText}>
                12kg lasts a family of 4 about 5–6 weeks.
              </Text>
            </Animated.View>

            <Animated.View
              entering={FadeIn.duration(220)}
              exiting={FadeOut.duration(140)}
              layout={LinearTransition}
              style={styles.trustStrip}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={16}
                color={theme.accent}
              />
              <Text style={styles.trustStripText}>
                Refilled at NMDPRA-licensed plants only
              </Text>
            </Animated.View>
          </>
        ) : null}
      </Animated.View>
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
      gap: theme.space.s5,
      paddingTop: 0,
    },
    fuelBanner: {
      ...theme.type.micro,
      fontSize: 11,
      letterSpacing: 1.2,
      color: theme.fgMuted,
      paddingHorizontal: 0,
    },
    section: { gap: theme.space.s3 },
    sectionLabel: {
      ...theme.type.micro,
      fontSize: 13,
      letterSpacing: 0.6,
      color: theme.fgMuted,
    },
    helperText: {
      ...theme.type.caption,
      color: theme.fgMuted,
    },
    trustStrip: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s2,
      backgroundColor: theme.accentTint,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.space.s3,
      paddingVertical: theme.space.s2 + 2,
    },
    trustStripText: {
      ...theme.type.bodySm,
      color: theme.mode === "dark" ? theme.palette.gold300 : theme.palette.gold700,
      fontWeight: "600",
      flex: 1,
    },
  });
