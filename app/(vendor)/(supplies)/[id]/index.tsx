import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { toast } from "sonner-native";
import {
  AlertChip,
  BulkTrackerTimeline,
  type TimelineEntry,
  Skel,
  SkelStack,
  VendorCard,
  VendorEmptyState,
  VendorPill,
  type PillTone,
  VendorScreenShell,
} from "@/components/ui/vendor";
import { useTheme } from "@/constants/theme";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";

interface BulkOrderDetail {
  _id: string;
  status: "pending" | "confirmed" | "in-transit" | "delivered" | "cancelled";
  step?: string;
  timeline?: TimelineEntry[];
  stepOrder: string[];
  varianceTolerancePct: number;
  quantity: number;
  unit: string;
  pricePerUnit?: number;
  logisticsFee?: number;
  serviceFee?: number;
  totalCost: number;
  paymentStatus: "unpaid" | "paid";
  truckPlate?: string;
  driverName?: string;
  driverPhone?: string;
  deliveryWindow?: string;
  notes?: string;
  loadedQty?: number;
  offloadedQty?: number;
  variancePct?: number;
  reconcileOutcome?: "ok" | "dispute" | "accept_variance";
  closedAt?: string;
  createdAt: string;
  plant?: {
    _id: string;
    name?: string;
    shortName?: string;
    address?: string;
    licenceNumber?: string;
  };
  fuelType?: { name?: string; unit?: string };
  station?: { name?: string; address?: string };
  dispute?: unknown;
}

const STATUS_TONE: Record<BulkOrderDetail["status"], PillTone> = {
  pending: "warning",
  confirmed: "info",
  "in-transit": "primary",
  delivered: "success",
  cancelled: "neutral",
};

const STATUS_LABEL: Record<BulkOrderDetail["status"], string> = {
  pending: "Requested",
  confirmed: "Confirmed",
  "in-transit": "In transit",
  delivered: "Closed",
  cancelled: "Cancelled",
};

function fmtNaira(n: number | undefined | null): string {
  return `₦${Math.round(Number(n ?? 0)).toLocaleString("en-NG")}`;
}

export default function BulkOrderDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;

  const [order, setOrder] = useState<BulkOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);

  const styles = useMemo(() => makeStyles(theme), [theme]);

  const fetchOrder = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.get<BulkOrderDetail>(
        `/api/vendor/bulk-purchases/${id}`,
        { timeoutMs: 10_000 },
      );
      setOrder(res);
    } catch (err: any) {
      if (err?.status === 404) {
        toast.error("Purchase not found");
        router.back();
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, router]);

  useEffect(() => {
    setLoading(true);
    fetchOrder();
  }, [fetchOrder]);

  useFocusEffect(
    useCallback(() => {
      fetchOrder();
    }, [fetchOrder]),
  );

  // Live updates via socket bulk:update.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const refetch = (data: { id?: string } | undefined) => {
      if (!data?.id || data.id === id) fetchOrder();
    };
    socket.on("bulk:update", refetch);
    return () => {
      socket.off("bulk:update", refetch);
    };
  }, [fetchOrder, id]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOrder();
  }, [fetchOrder]);

  const handleMarkPaid = useCallback(async () => {
    if (!order) return;
    setActioning("paid");
    try {
      await api.patch(`/api/vendor/bulk-purchases/${order._id}/paid`, {});
      toast.success("Escrow marked paid");
      fetchOrder();
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't mark paid");
    } finally {
      setActioning(null);
    }
  }, [order, fetchOrder]);

  const handleConfirmReceipt = useCallback(async () => {
    if (!order) return;
    setActioning("receive");
    try {
      await api.patch(`/api/vendor/bulk-purchases/${order._id}/receive`, {});
      toast.success("Truck marked at station");
      fetchOrder();
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't confirm");
    } finally {
      setActioning(null);
    }
  }, [order, fetchOrder]);

  const handleGoReconcile = useCallback(() => {
    if (!order) return;
    router.push(`/(vendor)/(supplies)/${order._id}/reconcile` as never);
  }, [order, router]);

  const handleGoDispute = useCallback(() => {
    if (!order) return;
    router.push(`/(vendor)/(supplies)/${order._id}/dispute` as never);
  }, [order, router]);

  // Stage-driven CTA. Mirrors the v6 design:
  //   step ≤ requested + unpaid → "Mark paid"
  //   step ∈ {dispatched, in_transit} → "Confirm truck arrived"
  //   step = offloaded + reconcileOutcome unset → "Reconcile"
  //   reconcileOutcome = dispute → "Open dispute thread"
  //   delivered / cancelled → none
  const cta = useMemo(() => {
    if (!order) return null;
    if (order.status === "cancelled" || order.status === "delivered") {
      if (order.reconcileOutcome === "dispute") {
        return {
          label: "Open dispute",
          onPress: handleGoDispute,
          tone: "warning" as const,
        };
      }
      return null;
    }
    if (order.paymentStatus !== "paid" && order.step === "requested") {
      return {
        label: actioning === "paid" ? "Marking…" : "Mark paid",
        onPress: handleMarkPaid,
        tone: "primary" as const,
      };
    }
    if (order.step === "dispatched" || order.step === "in_transit") {
      return {
        label: actioning === "receive" ? "Confirming…" : "Truck arrived",
        onPress: handleConfirmReceipt,
        tone: "primary" as const,
      };
    }
    if (order.step === "at_station") {
      return {
        label: actioning === "receive" ? "Confirming…" : "Confirm receipt",
        onPress: handleConfirmReceipt,
        tone: "primary" as const,
      };
    }
    if (order.step === "offloaded" && !order.reconcileOutcome) {
      return {
        label: "Reconcile",
        onPress: handleGoReconcile,
        tone: "primary" as const,
      };
    }
    return null;
  }, [order, actioning, handleMarkPaid, handleConfirmReceipt, handleGoReconcile, handleGoDispute]);

  return (
    <VendorScreenShell title="Purchase">
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back to supplies"
          hitSlop={6}
          style={({ pressed }) => [
            styles.backRow,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons name="chevron-back" size={18} color={theme.fgMuted} />
          <Text style={styles.backText}>Back to supplies</Text>
        </Pressable>

        {loading && !order ? (
          <SkelStack gap={14}>
            <Skel height={120} radius={16} />
            <Skel height={300} radius={16} />
          </SkelStack>
        ) : !order ? (
          <VendorEmptyState
            icon="cloud-offline-outline"
            headline="Couldn't load purchase"
            body="Pull down to retry."
          />
        ) : (
          <>
            {/* Header card */}
            <VendorCard>
              <View style={styles.headerRow}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.plant} numberOfLines={1}>
                    {order.plant?.name ?? "Plant"}
                  </Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {order.quantity} {order.fuelType?.unit ?? order.unit}{" "}
                    {order.fuelType?.name ?? ""}
                  </Text>
                </View>
                <VendorPill tone={STATUS_TONE[order.status]} size="md" dot>
                  {STATUS_LABEL[order.status]}
                </VendorPill>
              </View>
              <View style={styles.divider} />
              <Text
                style={styles.total}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {fmtNaira(order.totalCost)}
              </Text>
              <View style={styles.feeRow}>
                <FeeCell
                  label="Subtotal"
                  value={fmtNaira((order.pricePerUnit ?? 0) * order.quantity)}
                />
                <View style={styles.cellDivider} />
                <FeeCell label="Logistics" value={fmtNaira(order.logisticsFee)} />
                <View style={styles.cellDivider} />
                <FeeCell label="Gaznger" value={fmtNaira(order.serviceFee)} />
              </View>
              <Text style={styles.payNote}>
                Payment: {order.paymentStatus === "paid" ? "Paid (escrow)" : "Unpaid"}
              </Text>
            </VendorCard>

            {/* Variance summary if offloaded */}
            {order.step === "offloaded" || order.reconcileOutcome ? (
              <VendorCard
                tone={
                  Math.abs(order.variancePct ?? 0) >
                  (order.varianceTolerancePct ?? 0.5)
                    ? "warning"
                    : "success"
                }
              >
                <Text style={styles.cardLabel}>Variance</Text>
                <View style={styles.varianceRow}>
                  <VarianceCell
                    label="Loaded"
                    value={`${order.loadedQty ?? order.quantity} ${order.unit}`}
                  />
                  <VarianceCell
                    label="Offloaded"
                    value={`${order.offloadedQty ?? 0} ${order.unit}`}
                  />
                  <VarianceCell
                    label="Diff"
                    value={`${(order.variancePct ?? 0).toFixed(2)}%`}
                  />
                </View>
                {order.reconcileOutcome === "ok" ? (
                  <Text style={styles.outcomeOk}>
                    Closed within {order.varianceTolerancePct}% tolerance.
                  </Text>
                ) : order.reconcileOutcome === "accept_variance" ? (
                  <Text style={styles.outcomeOk}>
                    Variance accepted by vendor — closed.
                  </Text>
                ) : order.reconcileOutcome === "dispute" ? (
                  <Pressable
                    onPress={handleGoDispute}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.disputeLink,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={styles.disputeLinkText}>
                      Open dispute thread →
                    </Text>
                  </Pressable>
                ) : null}
              </VendorCard>
            ) : null}

            {/* Truck / driver block when populated */}
            {order.truckPlate || order.driverName ? (
              <VendorCard>
                <Text style={styles.cardLabel}>Truck</Text>
                {order.truckPlate ? (
                  <Text style={styles.plant}>{order.truckPlate}</Text>
                ) : null}
                {order.driverName ? (
                  <Text style={styles.sub}>{order.driverName}</Text>
                ) : null}
              </VendorCard>
            ) : null}

            {/* Timeline */}
            <VendorCard tight>
              <Text style={styles.cardLabel}>Pipeline</Text>
              <BulkTrackerTimeline
                stepOrder={order.stepOrder}
                timeline={order.timeline ?? []}
                currentStep={order.step}
              />
            </VendorCard>

            {/* Inline cancellation note */}
            {order.status === "cancelled" ? (
              <AlertChip tone="error" title="Cancelled" />
            ) : null}
          </>
        )}
      </ScrollView>

      {cta ? (
        <View style={styles.footer}>
          <Pressable
            onPress={cta.onPress}
            disabled={!!actioning}
            accessibilityRole="button"
            accessibilityLabel={cta.label}
            style={({ pressed }) => [
              styles.cta,
              cta.tone === "warning" && {
                backgroundColor: theme.warning,
              },
              pressed && { opacity: 0.85 },
              actioning && { opacity: 0.5 },
            ]}
          >
            <Text style={styles.ctaText}>{cta.label}</Text>
          </Pressable>
        </View>
      ) : null}
    </VendorScreenShell>
  );
}

function FeeCell({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
      <Text style={{ fontSize: 14, fontWeight: "700", color: theme.fg }}>
        {value}
      </Text>
      <Text
        style={{
          fontSize: 11,
          color: theme.fgMuted,
          fontWeight: "600",
          letterSpacing: 0.4,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function VarianceCell({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
      <Text
        style={{
          ...theme.type.body,
          color: theme.fg,
          fontWeight: "800",
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          ...theme.type.caption,
          color: theme.fgMuted,
          fontWeight: "600",
          letterSpacing: 0.4,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    scroll: {
      padding: 20,
      gap: 14,
      paddingBottom: 120,
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
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    plant: {
      ...theme.type.h2,
      color: theme.fg,
    },
    sub: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    divider: {
      height: 1,
      backgroundColor: theme.border,
      marginVertical: 12,
    },
    total: {
      fontSize: 32,
      fontWeight: "800",
      letterSpacing: -0.6,
      color: theme.fg,
    },
    feeRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 10,
    },
    cellDivider: {
      width: 1,
      alignSelf: "stretch",
      backgroundColor: theme.border,
    },
    payNote: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      marginTop: 10,
    },
    cardLabel: {
      ...theme.type.caption,
      color: theme.fgMuted,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginBottom: 6,
    },
    varianceRow: {
      flexDirection: "row",
      marginVertical: 4,
    },
    outcomeOk: {
      ...theme.type.bodySm,
      color: theme.fg,
      marginTop: 6,
      fontWeight: "600",
    },
    disputeLink: {
      marginTop: 8,
      alignSelf: "flex-start",
    },
    disputeLinkText: {
      ...theme.type.bodySm,
      color: theme.warning,
      fontWeight: "800",
    },
    footer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 24,
      backgroundColor: theme.bg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    cta: {
      backgroundColor: theme.primary,
      paddingVertical: 14,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    ctaText: {
      ...theme.type.body,
      color: theme.fgOnPrimary,
      fontWeight: "800",
    },
  });
