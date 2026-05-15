import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { toast } from "sonner-native";
import {
  AlertChip,
  FilterPills,
  type FilterPillOption,
  Skel,
  SkelStack,
  VendorCard,
  VendorEmptyState,
  VendorPill,
  VendorScreenShell,
} from "@/components/ui/vendor";
import { useVendorStationStore } from "@/store/useVendorStationStore";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";

/**
 * 3-step new-purchase wizard.
 *   step 1: Plant pick — list approved depots, filter by fuel + sort.
 *   step 2: Spec     — fuel/qty/window/notes (qty input + chips).
 *   step 3: Review   — totals + escrow disclaimer + Submit.
 *
 * Step state lives in this single screen; on submit we POST
 * /api/vendor/bulk-purchases and route back to Supplies (the new PO
 * shows up via the in-flight list + socket bulk:update).
 */

type WizardStep = 1 | 2 | 3;

interface FuelTypeRow {
  _id: string;
  name: string;
  unit: string;
}

interface PlantProduct {
  fuel: FuelTypeRow | string;
  pricePerUnit: number;
  available: boolean;
}

interface PlantRow {
  _id: string;
  name: string;
  shortName?: string;
  address: string;
  state: string;
  reliabilityScore?: number;
  image?: string;
  products: PlantProduct[];
}

type SortKey = "reliability" | "price" | "distance";

const SORT_OPTIONS: FilterPillOption<SortKey>[] = [
  { value: "reliability", label: "Reliable" },
  { value: "price", label: "Price" },
  { value: "distance", label: "Nearest" },
];

const WINDOW_OPTIONS: FilterPillOption<string>[] = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
];

const QTY_QUICK_PICKS = [1_000, 5_000, 10_000, 20_000];

function fmtNaira(value: number): string {
  return `₦${Math.round(value).toLocaleString("en-NG")}`;
}

export default function NewBulkPurchaseScreen() {
  const router = useRouter();
  const theme = useTheme();
  const activeStationId = useVendorStationStore((s) => s.activeStationId);

  const [step, setStep] = useState<WizardStep>(1);

  // Step 1 state
  const [plants, setPlants] = useState<PlantRow[] | null>(null);
  const [plantsLoading, setPlantsLoading] = useState(true);
  const [fuelTypeId, setFuelTypeId] = useState<string | null>(null);
  const [fuelTypeUnit, setFuelTypeUnit] = useState<string>("L");
  const [fuelTypeName, setFuelTypeName] = useState<string>("");
  const [fuelTypes, setFuelTypes] = useState<FuelTypeRow[] | null>(null);
  const [sort, setSort] = useState<SortKey>("reliability");
  const [pickedPlant, setPickedPlant] = useState<PlantRow | null>(null);

  // Step 2 state
  const [qty, setQty] = useState<string>("");
  const [deliveryWindow, setDeliveryWindow] = useState<string>("today");
  const [notes, setNotes] = useState<string>("");

  // Step 3 state
  const [submitting, setSubmitting] = useState(false);

  const styles = useMemo(() => makeStyles(theme), [theme]);

  // Load fuel types once for the filter chips on step 1.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // /api/fuel-types returns the bare array, not a wrapper.
        const res = await api.get<FuelTypeRow[] | { fuelTypes: FuelTypeRow[] }>(
          "/api/fuel-types",
          { timeoutMs: 8000 },
        );
        if (cancelled) return;
        const list = Array.isArray(res) ? res : (res?.fuelTypes ?? []);
        setFuelTypes(list);
        // Default to Petrol if available.
        const petrol = list.find((f) => /petrol/i.test(f.name));
        if (petrol) {
          setFuelTypeId(petrol._id);
          setFuelTypeUnit(petrol.unit);
          setFuelTypeName(petrol.name);
        } else if (list[0]) {
          setFuelTypeId(list[0]._id);
          setFuelTypeUnit(list[0].unit);
          setFuelTypeName(list[0].name);
        }
      } catch {
        // Falls back to empty list; UI surfaces empty state.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Reload plants whenever the fuel filter or sort changes.
  useEffect(() => {
    if (!fuelTypeId) return;
    let cancelled = false;
    setPlantsLoading(true);
    (async () => {
      try {
        const params = new URLSearchParams({
          fuelTypeId,
          sort,
        });
        const res = await api.get<{ plants: PlantRow[] }>(
          `/api/vendor/plants?${params.toString()}`,
          { timeoutMs: 10_000 },
        );
        if (cancelled) return;
        setPlants(res.plants ?? []);
      } catch {
        if (cancelled) return;
        setPlants([]);
      } finally {
        if (!cancelled) setPlantsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fuelTypeId, sort]);

  const pickedProduct = useMemo(() => {
    if (!pickedPlant || !fuelTypeId) return null;
    return (
      pickedPlant.products.find((p) => {
        const fid =
          typeof p.fuel === "string"
            ? p.fuel
            : (p.fuel as FuelTypeRow)._id;
        return fid === fuelTypeId;
      }) ?? null
    );
  }, [pickedPlant, fuelTypeId]);

  // Step 2 → Step 3 totals (server is the source of truth on submit;
  // we mirror the math client-side for review-page transparency).
  const qtyNum = useMemo(() => {
    const n = parseFloat(qty);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [qty]);
  const subtotal = useMemo(
    () => Math.round(qtyNum * (pickedProduct?.pricePerUnit ?? 0)),
    [qtyNum, pickedProduct],
  );
  const serviceFee = useMemo(() => Math.round(subtotal * 0.02), [subtotal]);
  const totalCost = subtotal + serviceFee;

  const canContinueStep1 = !!pickedPlant && !!pickedProduct?.available;
  const canContinueStep2 = qtyNum > 0;

  const handleFuelPick = (f: FuelTypeRow) => {
    setFuelTypeId(f._id);
    setFuelTypeUnit(f.unit);
    setFuelTypeName(f.name);
    setPickedPlant(null);
  };

  const handlePlantPick = (p: PlantRow) => {
    setPickedPlant(p);
  };

  const handleSubmit = useCallback(async () => {
    if (!activeStationId || !pickedPlant || !fuelTypeId || qtyNum <= 0) return;
    setSubmitting(true);
    try {
      const res = await api.post<{ order: { _id: string } }>(
        "/api/vendor/bulk-purchases",
        {
          stationId: activeStationId,
          plantId: pickedPlant._id,
          fuelTypeId,
          quantity: qtyNum,
          deliveryWindow,
          notes: notes.trim() || undefined,
        },
      );
      toast.success("Bulk purchase submitted", {
        description: "Track its progress in Supplies.",
      });
      router.replace(`/(vendor)/(supplies)/${res.order._id}` as never);
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't submit purchase");
    } finally {
      setSubmitting(false);
    }
  }, [activeStationId, pickedPlant, fuelTypeId, qtyNum, deliveryWindow, notes, router]);

  return (
    <VendorScreenShell title="New purchase">
      <View style={styles.stepHeaderRow}>
        <StepDot index={1} active={step === 1} done={step > 1} label="Plant" />
        <View style={styles.stepBar} />
        <StepDot index={2} active={step === 2} done={step > 2} label="Spec" />
        <View style={styles.stepBar} />
        <StepDot index={3} active={step === 3} done={false} label="Review" />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── STEP 1: Plant pick ──────────────────────────────────── */}
        {step === 1 ? (
          <>
            {fuelTypes && fuelTypes.length > 1 ? (
              <View style={styles.fuelRow}>
                {fuelTypes.map((f) => {
                  const active = f._id === fuelTypeId;
                  return (
                    <Pressable
                      key={f._id}
                      onPress={() => handleFuelPick(f)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      hitSlop={4}
                      style={({ pressed }) => [
                        styles.fuelChip,
                        active && styles.fuelChipActive,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.fuelChipText,
                          active && styles.fuelChipTextActive,
                        ]}
                      >
                        {f.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <FilterPills<SortKey>
              value={sort}
              options={SORT_OPTIONS}
              onChange={setSort}
            />

            {plantsLoading && !plants ? (
              <SkelStack gap={10}>
                <Skel height={110} radius={16} />
                <Skel height={110} radius={16} />
                <Skel height={110} radius={16} />
              </SkelStack>
            ) : !plants || plants.length === 0 ? (
              <VendorEmptyState
                icon="business-outline"
                headline="No plants"
                body="No approved depots match this filter yet."
              />
            ) : (
              <View style={styles.list}>
                {plants.map((p) => {
                  const product = p.products.find((x) => {
                    const fid =
                      typeof x.fuel === "string"
                        ? x.fuel
                        : (x.fuel as FuelTypeRow)._id;
                    return fid === fuelTypeId;
                  });
                  const isPicked = pickedPlant?._id === p._id;
                  const price = product?.pricePerUnit ?? null;
                  return (
                    <Pressable
                      key={p._id}
                      onPress={() => handlePlantPick(p)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isPicked }}
                      style={({ pressed }) => [
                        styles.plantCard,
                        isPicked && styles.plantCardActive,
                        pressed && { opacity: 0.95 },
                      ]}
                    >
                      <View style={styles.plantHeader}>
                        <View style={styles.plantIconLg}>
                          <Ionicons
                            name="business"
                            size={18}
                            color={theme.primary}
                          />
                        </View>
                        <View style={styles.plantNameWrap}>
                          <Text style={styles.plantName} numberOfLines={1}>
                            {p.name}
                          </Text>
                          <Text style={styles.plantAddr} numberOfLines={1}>
                            {p.address}
                          </Text>
                        </View>
                        {p.reliabilityScore != null &&
                        p.reliabilityScore >= 80 ? (
                          <VendorPill tone="success" size="sm">
                            Reliable
                          </VendorPill>
                        ) : null}
                      </View>
                      <View style={styles.plantFooter}>
                        <Text style={styles.priceLabel}>
                          {fuelTypeName} rate
                        </Text>
                        <Text style={styles.price}>
                          {price != null
                            ? `${fmtNaira(price)}/${fuelTypeUnit}`
                            : "—"}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        ) : null}

        {/* ── STEP 2: Spec ──────────────────────────────────── */}
        {step === 2 && pickedPlant && pickedProduct ? (
          <>
            <VendorCard tone="primary">
              <Text style={styles.specEyebrow}>Buying from</Text>
              <Text style={styles.specPlant}>{pickedPlant.name}</Text>
              <Text style={styles.specRate}>
                {fuelTypeName} at {fmtNaira(pickedProduct.pricePerUnit)}/
                {fuelTypeUnit}
              </Text>
            </VendorCard>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                Quantity ({fuelTypeUnit})
              </Text>
              <TextInput
                style={styles.qtyInput}
                placeholder={`e.g. 5000 ${fuelTypeUnit}`}
                placeholderTextColor={theme.fgMuted}
                keyboardType="numeric"
                value={qty}
                onChangeText={setQty}
                accessibilityLabel="Quantity"
              />
              <View style={styles.quickRow}>
                {QTY_QUICK_PICKS.map((q) => (
                  <Pressable
                    key={q}
                    onPress={() => setQty(String(q))}
                    hitSlop={4}
                    style={({ pressed }) => [
                      styles.quickChip,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={styles.quickChipText}>
                      {q.toLocaleString("en-NG")}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Delivery window</Text>
              <FilterPills<string>
                value={deliveryWindow}
                options={WINDOW_OPTIONS}
                onChange={setDeliveryWindow}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Notes (optional)</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Dispatch notes, gate access, etc."
                placeholderTextColor={theme.fgMuted}
                multiline
                value={notes}
                onChangeText={setNotes}
                accessibilityLabel="Notes"
              />
            </View>
          </>
        ) : null}

        {/* ── STEP 3: Review ──────────────────────────────────── */}
        {step === 3 && pickedPlant && pickedProduct ? (
          <>
            <VendorCard>
              <Text style={styles.specEyebrow}>Order summary</Text>
              <ReviewRow label="Plant" value={pickedPlant.name} />
              <ReviewRow
                label="Product"
                value={`${fuelTypeName} · ${qtyNum.toLocaleString("en-NG")} ${fuelTypeUnit}`}
              />
              <ReviewRow
                label="Rate"
                value={`${fmtNaira(pickedProduct.pricePerUnit)}/${fuelTypeUnit}`}
              />
              <ReviewRow
                label="Window"
                value={
                  WINDOW_OPTIONS.find((w) => w.value === deliveryWindow)
                    ?.label ?? deliveryWindow
                }
              />

              <View style={styles.divider} />

              <ReviewRow label="Subtotal" value={fmtNaira(subtotal)} />
              <ReviewRow
                label="Gaznger fee"
                value={fmtNaira(serviceFee)}
                helper="2% platform fee (admin-configurable)"
              />
              <View style={styles.divider} />
              <ReviewRow
                label="Total"
                value={fmtNaira(totalCost)}
                bold
              />
            </VendorCard>

            <AlertChip
              tone="info"
              icon="lock-closed"
              title="Payment held in escrow"
              sub="Released to the plant once you reconcile the delivery."
            />
          </>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={() => {
            if (step === 1) router.back();
            else if (step === 2) setStep(1);
            else if (step === 3) setStep(2);
          }}
          accessibilityRole="button"
          accessibilityLabel={step === 1 ? "Cancel" : "Back"}
          hitSlop={6}
          style={({ pressed }) => [
            styles.btnGhost,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.btnGhostText}>
            {step === 1 ? "Cancel" : "Back"}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            if (step === 1 && canContinueStep1) setStep(2);
            else if (step === 2 && canContinueStep2) setStep(3);
            else if (step === 3) handleSubmit();
          }}
          disabled={
            (step === 1 && !canContinueStep1) ||
            (step === 2 && !canContinueStep2) ||
            (step === 3 && submitting)
          }
          accessibilityRole="button"
          accessibilityLabel={
            step === 3 ? "Submit purchase" : "Continue"
          }
          style={({ pressed }) => [
            styles.btnPrimary,
            ((step === 1 && !canContinueStep1) ||
              (step === 2 && !canContinueStep2) ||
              submitting) && { opacity: 0.5 },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.btnPrimaryText}>
            {step === 3
              ? submitting
                ? "Submitting…"
                : "Submit"
              : "Continue"}
          </Text>
        </Pressable>
      </View>
    </VendorScreenShell>
  );
}

function StepDot({
  index,
  active,
  done,
  label,
}: {
  index: number;
  active: boolean;
  done: boolean;
  label: string;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStepDotStyles(theme), [theme]);
  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.dot,
          (active || done) && styles.dotActive,
        ]}
      >
        {done ? (
          <Ionicons name="checkmark" size={12} color={theme.fgOnPrimary} />
        ) : (
          <Text
            style={[
              styles.dotText,
              (active || done) && styles.dotTextActive,
            ]}
          >
            {index}
          </Text>
        )}
      </View>
      <Text
        style={[styles.label, (active || done) && styles.labelActive]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function ReviewRow({
  label,
  value,
  bold,
  helper,
}: {
  label: string;
  value: string;
  bold?: boolean;
  helper?: string;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 4 }}>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            ...theme.type.bodySm,
            color: theme.fgMuted,
            fontWeight: "600",
          }}
        >
          {label}
        </Text>
        {helper ? (
          <Text
            style={{
              ...theme.type.caption,
              color: theme.fgSubtle,
            }}
          >
            {helper}
          </Text>
        ) : null}
      </View>
      <Text
        style={{
          ...theme.type.body,
          color: theme.fg,
          fontWeight: bold ? "800" : "700",
          fontSize: bold ? 16 : 14,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    stepHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 4,
      paddingBottom: 12,
      gap: 8,
    },
    stepBar: {
      flex: 1,
      height: 2,
      backgroundColor: theme.border,
      borderRadius: 1,
    },
    scroll: {
      paddingHorizontal: 20,
      paddingBottom: 100,
      gap: 14,
    },
    fuelRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    fuelChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.bgMuted,
      borderWidth: 1,
      borderColor: theme.border,
    },
    fuelChipActive: {
      backgroundColor: theme.primaryTint,
      borderColor: theme.primary,
    },
    fuelChipText: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      fontWeight: "700",
    },
    fuelChipTextActive: {
      color: theme.primary,
    },
    list: { gap: 10 },
    plantCard: {
      backgroundColor: theme.surface,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 14,
      paddingVertical: 14,
      gap: 12,
    },
    plantCardActive: {
      borderColor: theme.primary,
      borderWidth: 2,
    },
    plantHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    plantIconLg: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.primaryTint,
      alignItems: "center",
      justifyContent: "center",
    },
    plantNameWrap: { flex: 1 },
    plantName: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
    },
    plantAddr: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    plantFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    priceLabel: {
      ...theme.type.caption,
      color: theme.fgMuted,
      fontWeight: "700",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    price: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "800",
    },
    specEyebrow: {
      ...theme.type.caption,
      color: theme.fgMuted,
      fontWeight: "700",
      letterSpacing: 0.5,
      textTransform: "uppercase",
      marginBottom: 4,
    },
    specPlant: {
      ...theme.type.h2,
      color: theme.fg,
    },
    specRate: {
      ...theme.type.bodySm,
      color: theme.fg,
      marginTop: 2,
    },
    section: { gap: 8 },
    sectionLabel: {
      ...theme.type.caption,
      color: theme.fgMuted,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    qtyInput: {
      ...theme.type.h2,
      color: theme.fg,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: theme.radius.lg,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: theme.surface,
    },
    quickRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    quickChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.bgMuted,
    },
    quickChipText: {
      ...theme.type.bodySm,
      color: theme.fg,
      fontWeight: "700",
    },
    notesInput: {
      ...theme.type.body,
      color: theme.fg,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: theme.radius.lg,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: theme.surface,
      minHeight: 80,
      textAlignVertical: "top",
    },
    divider: {
      height: 1,
      backgroundColor: theme.border,
      marginVertical: 10,
    },
    footer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 24,
      backgroundColor: theme.bg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    btnGhost: {
      flex: 0,
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.bgMuted,
    },
    btnGhostText: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
    },
    btnPrimary: {
      flex: 1,
      backgroundColor: theme.primary,
      paddingVertical: 14,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    btnPrimaryText: {
      ...theme.type.body,
      color: theme.fgOnPrimary,
      fontWeight: "800",
    },
  });

const makeStepDotStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    wrap: { alignItems: "center", gap: 4, minWidth: 64 },
    dot: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.bgMuted,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },
    dotActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    dotText: {
      fontSize: 11,
      color: theme.fgMuted,
      fontWeight: "800",
    },
    dotTextActive: {
      color: theme.fgOnPrimary,
    },
    label: {
      fontSize: 11,
      color: theme.fgMuted,
      fontWeight: "700",
      letterSpacing: 0.3,
    },
    labelActive: {
      color: theme.primary,
    },
  });
