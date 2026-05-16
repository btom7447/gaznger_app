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
import { useLocalSearchParams, useRouter } from "expo-router";
import { toast } from "sonner-native";
import {
  AlertChip,
  Skel,
  SkelStack,
  VendorCard,
  VendorScreenShell,
} from "@/components/ui/vendor";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";

/**
 * Reconcile screen — two outcomes per v6:
 *   a) variance within tolerance → "Close out" button → /reconcile
 *   b) variance over tolerance   → "Open dispute" or "Accept variance"
 *
 * The vendor enters the volume they offloaded. Server compares to the
 * loaded volume (set by the plant at dispatch, or defaulted to the
 * requested quantity) and returns variancePct.
 */

interface BulkOrder {
  _id: string;
  step?: string;
  quantity: number;
  unit: string;
  loadedQty?: number;
  offloadedQty?: number;
  variancePct?: number;
  varianceTolerancePct: number;
  reconcileOutcome?: "ok" | "dispute" | "accept_variance";
  plant?: { name?: string };
}

function computeVariance(loaded: number, offloaded: number): number {
  if (!loaded || loaded <= 0) return 0;
  return Number((((loaded - offloaded) / loaded) * 100).toFixed(2));
}

export default function ReconcileScreen() {
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;

  const [order, setOrder] = useState<BulkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);

  const [loadedInput, setLoadedInput] = useState("");
  const [offloadedInput, setOffloadedInput] = useState("");

  const styles = useMemo(() => makeStyles(theme), [theme]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<BulkOrder>(
          `/api/vendor/bulk-purchases/${id}`,
          { timeoutMs: 10_000 },
        );
        if (cancelled) return;
        setOrder(res);
        // Pre-fill loaded with the server-known value OR the requested
        // qty; offloaded stays blank for the vendor to enter.
        if (res.loadedQty != null) {
          setLoadedInput(String(res.loadedQty));
        } else {
          setLoadedInput(String(res.quantity ?? ""));
        }
        if (res.offloadedQty != null) {
          setOffloadedInput(String(res.offloadedQty));
        }
      } catch {
        if (cancelled) return;
        toast.error("Couldn't load purchase");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const loadedNum = useMemo(() => {
    const n = parseFloat(loadedInput);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [loadedInput]);
  const offloadedNum = useMemo(() => {
    const n = parseFloat(offloadedInput);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [offloadedInput]);

  const variancePct = useMemo(
    () => computeVariance(loadedNum, offloadedNum),
    [loadedNum, offloadedNum],
  );
  const tolerance = order?.varianceTolerancePct ?? 0.5;
  const withinTolerance = Math.abs(variancePct) <= tolerance;
  const canSubmitOffload = loadedNum > 0 && offloadedNum > 0;
  const hasSubmittedOffload = !!order?.offloadedQty;

  const submitOffload = useCallback(async () => {
    if (!order || !canSubmitOffload) return;
    setSubmitting("offload");
    try {
      await api.patch(`/api/vendor/bulk-purchases/${order._id}/offload`, {
        loadedQty: loadedNum,
        offloadedQty: offloadedNum,
      });
      toast.success("Volumes recorded");
      // Refetch so the screen re-renders with the new server-truth
      // variance + outcome controls.
      const res = await api.get<BulkOrder>(
        `/api/vendor/bulk-purchases/${order._id}`,
        { timeoutMs: 10_000 },
      );
      setOrder(res);
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't submit");
    } finally {
      setSubmitting(null);
    }
  }, [order, canSubmitOffload, loadedNum, offloadedNum]);

  const closeOut = useCallback(async () => {
    if (!order) return;
    setSubmitting("close");
    try {
      await api.patch(`/api/vendor/bulk-purchases/${order._id}/reconcile`, {});
      toast.success("Purchase closed");
      router.back();
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't close out");
    } finally {
      setSubmitting(null);
    }
  }, [order, router]);

  const acceptVariance = useCallback(async () => {
    if (!order) return;
    setSubmitting("accept");
    try {
      await api.patch(
        `/api/vendor/bulk-purchases/${order._id}/accept-variance`,
        {},
      );
      toast.success("Variance accepted");
      router.back();
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't accept");
    } finally {
      setSubmitting(null);
    }
  }, [order, router]);

  const openDispute = useCallback(async () => {
    if (!order) return;
    setSubmitting("dispute");
    try {
      await api.patch(`/api/vendor/bulk-purchases/${order._id}/dispute`, {});
      toast.success("Dispute opened");
      router.replace(`/(vendor)/(supplies)/${order._id}/dispute` as never);
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't open dispute");
    } finally {
      setSubmitting(null);
    }
  }, [order, router]);

  return (
    <VendorScreenShell title="Reconcile" hideStationSwitcher>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={6}
          style={({ pressed }) => [
            styles.backRow,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons name="chevron-back" size={18} color={theme.fgMuted} />
          <Text style={styles.backText}>Back to purchase</Text>
        </Pressable>

        {loading || !order ? (
          <SkelStack gap={10}>
            <Skel height={120} radius={16} />
            <Skel height={80} radius={16} />
          </SkelStack>
        ) : (
          <>
            <VendorCard>
              <Text style={styles.cardLabel}>Volumes</Text>
              <Text style={styles.subTitle}>{order.plant?.name ?? "Plant"}</Text>
              <Text style={styles.hint}>
                Compare the plant's loaded volume to what your tank measured
                after offload.
              </Text>

              <View style={styles.inputRow}>
                <View style={styles.inputCell}>
                  <Text style={styles.inputLabel}>Loaded ({order.unit})</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor={theme.fgMuted}
                    keyboardType="numeric"
                    value={loadedInput}
                    onChangeText={setLoadedInput}
                    accessibilityLabel="Loaded volume"
                  />
                </View>
                <View style={styles.inputCell}>
                  <Text style={styles.inputLabel}>Offloaded ({order.unit})</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor={theme.fgMuted}
                    keyboardType="numeric"
                    value={offloadedInput}
                    onChangeText={setOffloadedInput}
                    accessibilityLabel="Offloaded volume"
                  />
                </View>
              </View>

              <View style={styles.varianceRow}>
                <Text style={styles.varianceLabel}>Variance</Text>
                <Text
                  style={[
                    styles.varianceValue,
                    {
                      color: withinTolerance ? theme.success : theme.warning,
                    },
                  ]}
                >
                  {variancePct.toFixed(2)}%
                </Text>
              </View>
              <Text style={styles.toleranceNote}>
                Tolerance: ±{tolerance}%
              </Text>
            </VendorCard>

            {!hasSubmittedOffload ? (
              <Pressable
                onPress={submitOffload}
                disabled={!canSubmitOffload || submitting !== null}
                accessibilityRole="button"
                accessibilityLabel="Submit volumes"
                style={({ pressed }) => [
                  styles.primaryBtn,
                  (!canSubmitOffload || submitting !== null) && {
                    opacity: 0.5,
                  },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.primaryBtnText}>
                  {submitting === "offload" ? "Recording…" : "Record volumes"}
                </Text>
              </Pressable>
            ) : withinTolerance ? (
              <>
                <AlertChip
                  tone="success"
                  title={`Within ±${tolerance}% tolerance`}
                  sub="Closing this out releases escrow to the plant."
                />
                <Pressable
                  onPress={closeOut}
                  disabled={submitting !== null}
                  accessibilityRole="button"
                  accessibilityLabel="Close out"
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    submitting !== null && { opacity: 0.5 },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.primaryBtnText}>
                    {submitting === "close" ? "Closing…" : "Close out"}
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <AlertChip
                  tone="warning"
                  title={`Variance exceeds ±${tolerance}%`}
                  sub="Open a dispute with the plant, or accept the variance and close."
                />
                <Pressable
                  onPress={openDispute}
                  disabled={submitting !== null}
                  accessibilityRole="button"
                  accessibilityLabel="Open dispute"
                  style={({ pressed }) => [
                    styles.warnBtn,
                    submitting !== null && { opacity: 0.5 },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.warnBtnText}>
                    {submitting === "dispute" ? "Opening…" : "Open dispute"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={acceptVariance}
                  disabled={submitting !== null}
                  accessibilityRole="button"
                  accessibilityLabel="Accept variance and close"
                  style={({ pressed }) => [
                    styles.ghostBtn,
                    submitting !== null && { opacity: 0.5 },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.ghostBtnText}>
                    {submitting === "accept"
                      ? "Accepting…"
                      : "Accept variance & close"}
                  </Text>
                </Pressable>
              </>
            )}
          </>
        )}
      </ScrollView>
    </VendorScreenShell>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    scroll: {
      padding: 20,
      gap: 14,
      paddingBottom: 100,
    },
    backRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginBottom: -4,
    },
    backText: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      fontWeight: "600",
    },
    cardLabel: {
      ...theme.type.caption,
      color: theme.fgMuted,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    subTitle: {
      ...theme.type.h2,
      color: theme.fg,
      marginTop: 4,
    },
    hint: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      marginTop: 4,
      marginBottom: 12,
      lineHeight: 19,
    },
    inputRow: {
      flexDirection: "row",
      gap: 10,
    },
    inputCell: { flex: 1, gap: 6 },
    inputLabel: {
      ...theme.type.caption,
      color: theme.fgMuted,
      fontWeight: "700",
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },
    input: {
      ...theme.type.h2,
      color: theme.fg,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: theme.radius.lg,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: theme.surface,
    },
    varianceRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 14,
    },
    varianceLabel: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
    },
    varianceValue: {
      fontSize: 22,
      fontWeight: "800",
    },
    toleranceNote: {
      ...theme.type.caption,
      color: theme.fgMuted,
      marginTop: 2,
    },
    primaryBtn: {
      backgroundColor: theme.primary,
      paddingVertical: 14,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryBtnText: {
      ...theme.type.body,
      color: theme.fgOnPrimary,
      fontWeight: "800",
    },
    warnBtn: {
      backgroundColor: theme.warning,
      paddingVertical: 14,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    warnBtnText: {
      ...theme.type.body,
      color: "#fff",
      fontWeight: "800",
    },
    ghostBtn: {
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: 14,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    ghostBtnText: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
    },
  });
