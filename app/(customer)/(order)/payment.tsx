import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { usePaystack } from "react-native-paystack-webview";
import { Theme, useTheme, formatCurrency } from "@/constants/theme";
import { useOrderStore } from "@/store/useOrderStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useWalletStore } from "@/store/useWalletStore";
import { api } from "@/lib/api";
import { setPaystackPublicKey } from "@/lib/paystackKey";
import { newIdempotencyKey } from "@/lib/idempotency";
import {
  FloatingCTA,
  MoneySurface,
  ProgressDots,
  ScreenContainer,
  ScreenHeader,
} from "@/components/ui/primitives";
import PaymentMethodList, {
  PaymentMethod,
} from "@/components/ui/customer/order/PaymentMethodList";
import PointsRedeem, {
  POINTS_TO_NAIRA,
} from "@/components/ui/customer/order/PointsRedeem";
import { useFlowProgress } from "@/components/ui/customer/order/useFlowProgress";

// Mirror server/src/utils/haversine.ts → calcDeliveryFee.
const DELIVERY_BASE_FEE = 500;
const DELIVERY_PER_KM = 100;

function computeDeliveryFee(distMeters?: number): number {
  if (!distMeters || distMeters <= 0) return DELIVERY_BASE_FEE;
  const km = distMeters / 1000;
  return Math.round(DELIVERY_BASE_FEE + DELIVERY_PER_KM * km);
}

function brandTagFor(brand?: string): string {
  if (!brand) return "CARD";
  const b = brand.toLowerCase();
  if (b.includes("visa")) return "VISA";
  if (b.includes("master")) return "MC";
  if (b.includes("verve")) return "VERVE";
  return brand.slice(0, 4).toUpperCase();
}

interface InitializeResponse {
  authorizationUrl: string;
  reference: string;
  publicKey?: string;
}

export default function PaymentScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const draft = useOrderStore((s) => s.order);
  const setPaymentMethod = useOrderStore((s) => s.setPaymentMethod);
  const setOrderId = useOrderStore((s) => s.setOrderId);
  const user = useSessionStore((s) => s.user);
  const userEmail = user?.email;
  const pointsBalance = user?.points ?? 0;
  const walletAvailable = useWalletStore((s) => s.available);
  const refreshWallet = useWalletStore((s) => s.refresh);
  const { step, total } = useFlowProgress("payment");

  const { popup } = usePaystack();

  const station = draft.station;
  const totalKobo = station?.totalKobo ?? 0;
  const lockedTotalNaira = totalKobo / 100;

  const deliveryFee = useMemo(
    () => computeDeliveryFee(station?.distMeters),
    [station?.distMeters]
  );
  const subtotal = Math.max(0, lockedTotalNaira - deliveryFee);

  const [pointsToSpend, setPointsToSpend] = useState(0);
  const pointsDiscount = pointsToSpend * POINTS_TO_NAIRA;
  const finalTotal = Math.max(0, lockedTotalNaira - pointsDiscount);

  const lastCard = user?.lastPaystackAuth;
  const hasSavedCard = Boolean(lastCard?.last4);

  const methods = useMemo<PaymentMethod[]>(() => {
    const list: PaymentMethod[] = [];
    if (hasSavedCard) {
      list.push({
        id: "card-saved",
        kind: "card",
        label: lastCard?.brand
          ? `${lastCard.brand[0].toUpperCase()}${lastCard.brand.slice(1)} card`
          : "Saved card",
        sublabel: `•••• ${lastCard?.last4} · default`,
        brandTag: brandTagFor(lastCard?.brand),
      });
    } else {
      list.push({
        id: "card-new",
        kind: "card",
        label: "Add card",
        sublabel: "Pay once, save for next time",
      });
    }
    list.push({
      id: "wallet",
      kind: "wallet",
      label: "Gaznger wallet",
      sublabel: `Balance ${formatCurrency(walletAvailable)}`,
      balance: walletAvailable,
      insufficient: walletAvailable < finalTotal,
    });
    list.push({
      id: "transfer",
      kind: "transfer",
      label: "Bank transfer",
      sublabel: "Pay to a one-time account",
    });
    return list;
  }, [hasSavedCard, lastCard?.last4, lastCard?.brand, finalTotal, walletAvailable]);

  const [selectedId, setSelectedId] = useState<string>(
    draft.paymentMethodId ?? methods[0]?.id ?? ""
  );
  const [submitting, setSubmitting] = useState(false);

  // Re-anchor selection if the methods list reshapes (saved card → no card after logout, etc.)
  useEffect(() => {
    if (!methods.find((m) => m.id === selectedId)) {
      setSelectedId(methods[0]?.id ?? "");
    }
  }, [methods, selectedId]);

  // Pull a fresh wallet balance whenever this screen mounts.
  useEffect(() => {
    refreshWallet();
  }, [refreshWallet]);

  const selected = methods.find((m) => m.id === selectedId) ?? null;
  const insufficient = selected?.kind === "wallet" && selected.insufficient;

  const handleSelect = useCallback(
    (id: string) => {
      setSelectedId(id);
      setPaymentMethod(id);
    },
    [setPaymentMethod]
  );

  /**
   * Place the order on the server. The server returns the canonical
   * `_id` we then use as `orderId` for the Paystack flow + points
   * redemption.
   */
  const placeOrder = useCallback(async (): Promise<string | null> => {
    try {
      // Server accepts EITHER `fuelId` (Mongo ObjectId, legacy) or
      // `fuelTypeId` (slug like "petrol"/"lpg", new flow). The new flow
      // never populates `draft.fuel`, so we send the slug.
      const body: Record<string, unknown> = {
        fuelTypeId: draft.fuelTypeId,
        stationId: station?.id,
        quantity: draft.qty,
        deliveryAddressId: draft.deliveryAddressId,
        note: draft.note,
        returnSwapAt: draft.returnSwapAt ?? undefined,
      };
      if (draft.product === "lpg") {
        body.cylinderType = draft.cylinderType;
        body.deliveryType =
          draft.serviceType === "swap" ? "cylinder_swap" : "home_refill";
        body.cylinderImages = draft.cylinderPhotos ?? [];
        // Send the swap-only cylinder details (brand/valve/age/test).
        // Server stores these on the order so the rider arrives with
        // the right kit and Admin can audit cylinder eligibility.
        if (draft.cylinderDetails) {
          body.cylinderDetails = draft.cylinderDetails;
        }
      }
      const order = await api.post<{ _id: string; totalPrice: number }>(
        "/api/orders",
        body
      );
      setOrderId(order._id);
      return order._id;
    } catch (err: any) {
      Alert.alert(
        "Couldn't place order",
        err?.message ?? "Please try again in a moment."
      );
      return null;
    }
  }, [draft, station, setOrderId]);

  /**
   * Best-effort points redemption. Failures are non-fatal — server is
   * the source of truth on whether the discount actually applied.
   */
  const redeemPointsIfAny = useCallback(
    async (orderId: string) => {
      if (pointsToSpend <= 0) return;
      try {
        await api.post("/api/points/redeem", {
          orderId,
          pointsToRedeem: pointsToSpend,
        });
      } catch {
        // Swallow.
      }
    },
    [pointsToSpend]
  );

  const goReceipt = useCallback(() => {
    refreshWallet();
    router.replace("/(customer)/(order)/receipt" as never);
  }, [refreshWallet, router]);

  /** New-card flow — initialize → open Paystack popup → verify on success. */
  const payWithNewCard = useCallback(
    async (orderId: string) => {
      if (!userEmail) {
        Alert.alert("Email required", "We need your email to start the payment.");
        return;
      }
      const init = await api.post<InitializeResponse>(
        "/api/payments/initialize",
        { orderId },
        { headers: { "Idempotency-Key": newIdempotencyKey() } as any }
      );
      setPaystackPublicKey(init.publicKey);

      popup.checkout({
        email: userEmail,
        amount: finalTotal, // SDK takes NGN, not kobo
        reference: init.reference,
        metadata: { orderId, kind: "order_charge" },
        onSuccess: async () => {
          try {
            await api.post(
              "/api/payments/verify",
              { reference: init.reference },
              { headers: { "Idempotency-Key": newIdempotencyKey() } as any }
            );
            await redeemPointsIfAny(orderId);
            goReceipt();
          } catch (err: any) {
            Alert.alert(
              "Payment verification failed",
              err?.message ??
                "We couldn't verify the payment. Please contact support if your card was charged."
            );
          } finally {
            setSubmitting(false);
          }
        },
        onCancel: () => {
          setSubmitting(false);
        },
        onError: (err) => {
          Alert.alert("Payment error", err?.message ?? "Something went wrong.");
          setSubmitting(false);
        },
      });
    },
    [userEmail, finalTotal, popup, redeemPointsIfAny, goReceipt]
  );

  /** Saved-card flow — single server call, no webview. */
  const payWithSavedCard = useCallback(
    async (orderId: string) => {
      try {
        await api.post(
          "/api/payments/charge-saved",
          { orderId },
          { headers: { "Idempotency-Key": newIdempotencyKey() } as any }
        );
        await redeemPointsIfAny(orderId);
        goReceipt();
      } catch (err: any) {
        Alert.alert(
          "Saved card declined",
          err?.message ?? "Try a different payment method."
        );
        setSubmitting(false);
      }
    },
    [redeemPointsIfAny, goReceipt]
  );

  /** Wallet flow — server debits the wallet, no Paystack. */
  const payWithWallet = useCallback(
    async (orderId: string) => {
      try {
        await api.post(
          "/api/payments/pay-with-wallet",
          { orderId },
          { headers: { "Idempotency-Key": newIdempotencyKey() } as any }
        );
        await redeemPointsIfAny(orderId);
        goReceipt();
      } catch (err: any) {
        Alert.alert(
          "Wallet payment failed",
          err?.message ?? "Insufficient balance or wallet error."
        );
        setSubmitting(false);
      }
    },
    [redeemPointsIfAny, goReceipt]
  );

  /** Bank-transfer flow — initialize but force `bank_transfer` channel. */
  const payWithTransfer = useCallback(
    async (orderId: string) => {
      if (!userEmail) {
        Alert.alert("Email required", "We need your email for the transfer.");
        return;
      }
      const init = await api.post<InitializeResponse>(
        "/api/payments/initialize",
        { orderId },
        { headers: { "Idempotency-Key": newIdempotencyKey() } as any }
      );
      setPaystackPublicKey(init.publicKey);
      popup.checkout({
        email: userEmail,
        amount: finalTotal,
        reference: init.reference,
        metadata: { orderId, kind: "order_charge", channel: "bank_transfer" },
        onSuccess: async () => {
          try {
            await api.post(
              "/api/payments/verify",
              { reference: init.reference },
              { headers: { "Idempotency-Key": newIdempotencyKey() } as any }
            );
            await redeemPointsIfAny(orderId);
            goReceipt();
          } finally {
            setSubmitting(false);
          }
        },
        onCancel: () => setSubmitting(false),
        onError: () => setSubmitting(false),
      });
    },
    [userEmail, finalTotal, popup, redeemPointsIfAny, goReceipt]
  );

  const handlePay = useCallback(async () => {
    if (!selected || insufficient || submitting) return;
    setSubmitting(true);

    // Step 1: place the order so we have a real orderId for downstream flows.
    const orderId = await placeOrder();
    if (!orderId) {
      setSubmitting(false);
      return;
    }

    // Step 2: dispatch by method.
    if (selected.id === "card-saved") {
      await payWithSavedCard(orderId);
    } else if (selected.id === "card-new") {
      await payWithNewCard(orderId);
    } else if (selected.id === "wallet") {
      await payWithWallet(orderId);
    } else if (selected.id === "transfer") {
      await payWithTransfer(orderId);
    } else {
      setSubmitting(false);
    }
  }, [
    selected,
    insufficient,
    submitting,
    placeOrder,
    payWithSavedCard,
    payWithNewCard,
    payWithWallet,
    payWithTransfer,
  ]);

  if (!station) {
    return (
      <ScreenContainer edges={["top", "bottom"]}>
        <ScreenHeader title="How will you pay?" />
        <View style={styles.body}>
          <Text style={styles.fallback}>
            We need a station first. Routing back…
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  const lineItems: { label: string; amount: number }[] = [
    {
      label: `${draft.qty ?? 0} ${draft.unit ?? "L"} · ${
        station.shortName ?? station.name
      }`,
      amount: subtotal,
    },
    { label: "Delivery fee", amount: deliveryFee },
  ];
  if (pointsDiscount > 0) {
    lineItems.push({
      label: `Points redeemed (${pointsToSpend.toLocaleString("en-NG")})`,
      amount: -pointsDiscount,
    });
  }

  return (
    <ScreenContainer
      edges={["top", "bottom"]}
      contentStyle={styles.scroll}
      header={<ScreenHeader title="How will you pay?" />}
      footer={
        <FloatingCTA
          label={`Pay ${formatCurrency(finalTotal)}`}
          subtitle={selected?.sublabel}
          disabled={!selected || insufficient || submitting}
          loading={submitting}
          onPress={handlePay}
          floating={false}
          accessibilityHint={
            insufficient ? "Top up your wallet to continue" : undefined
          }
        />
      }
    >
      <View style={styles.body}>
        <ProgressDots step={step} total={total} variant="bars" />

        <Text style={styles.sectionLabel}>METHODS</Text>
        <PaymentMethodList
          methods={methods}
          selectedId={selectedId}
          onSelect={handleSelect}
          onTopUp={() => router.push("/(customer)/wallet/topup" as never)}
        />

        <View style={styles.trustStrip}>
          <Ionicons
            name="shield-checkmark-outline"
            size={16}
            color={theme.fgMuted}
          />
          <Text style={styles.trustText}>
            Payments secured by Paystack. We never see your card details.
          </Text>
        </View>

        <PointsRedeem
          total={lockedTotalNaira}
          balance={pointsBalance}
          pointsToSpend={pointsToSpend}
          onChange={setPointsToSpend}
        />

        <MoneySurface
          eyebrow="ORDER"
          lineItems={lineItems}
          totalLabel="You'll pay"
          totalValue={finalTotal}
          sub={
            userEmail
              ? `Pay once · receipt to ${userEmail}`
              : "Pay once · receipt by email"
          }
        />
      </View>
    </ScreenContainer>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    scroll: { paddingBottom: theme.space.s5 },
    body: {
      paddingHorizontal: theme.space.s4,
      gap: theme.space.s4,
      paddingTop: theme.space.s2,
    },
    sectionLabel: {
      ...theme.type.micro,
      fontSize: 13,
      letterSpacing: 0.6,
      color: theme.fgMuted,
    },
    trustStrip: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s2,
      backgroundColor: theme.bgMuted,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.space.s3,
      paddingVertical: theme.space.s2 + 2,
    },
    trustText: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      flex: 1,
    },
    fallback: {
      ...theme.type.body,
      color: theme.fgMuted,
      padding: theme.space.s4,
    },
  });
