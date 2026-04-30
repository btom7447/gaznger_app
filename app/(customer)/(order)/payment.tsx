import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
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

/**
 * Flat platform service fee shown on the order summary. The server
 * doesn't compute this as a separate line yet — the order's
 * `totalPrice` already includes it implicitly (it's part of how the
 * station prices a delivery). Surfaced on the summary so the user
 * sees an explicit breakdown matching the v3 design.
 *
 * To keep the displayed total honest with what's actually charged,
 * we *re-allocate* SERVICE_FEE out of the fuel subtotal rather than
 * adding it on top. When the server starts computing service fee as
 * a real distinct line, drop the re-allocation and let it ride
 * through the response.
 */
const SERVICE_FEE = 400;

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

  // `?select=wallet` is set by the wallet top-up screen when it returns
  // here after a successful top-up — auto-selects the wallet method
  // exactly once so the user resumes the flow without picking again.
  const { select } = useLocalSearchParams<{ select?: string }>();

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
  // `subtotal` here is the *fuel-only* line shown to the user. We
  // re-allocate SERVICE_FEE out of the locked total so the math on
  // the summary card reconciles cleanly: subtotal + serviceFee +
  // deliveryFee = lockedTotalNaira (server's charged amount). When
  // the server starts returning a real serviceFee we'll drop the
  // re-allocation in favour of `(server.serviceFee ?? 0)`.
  const fuelSubtotal = Math.max(
    0,
    lockedTotalNaira - deliveryFee - SERVICE_FEE
  );

  const [pointsToSpend, setPointsToSpend] = useState(0);
  const pointsDiscount = pointsToSpend * POINTS_TO_NAIRA;
  const finalTotal = Math.max(0, lockedTotalNaira - pointsDiscount);

  const lastCard = user?.lastPaystackAuth;
  const hasSavedCard = Boolean(lastCard?.last4);

  // Auto-redeem preference: when the customer turned on "Auto-redeem at
  // checkout" in Settings/Points, pre-fill `pointsToSpend` to the
  // maximum that fits this order on first mount. Guarded by a ref so
  // manual edits aren't clobbered. We can't put this beside the state
  // declaration above because we need lockedTotalNaira + pointsBalance
  // already in scope — see effect below.

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

  // Auto-redeem on first mount when the user has it enabled. Caps at
  // both the points balance AND order total so the discount can't
  // exceed what the user owns or push the order below ₦0.
  const hasAutoRedeemedRef = useRef(false);
  useEffect(() => {
    if (hasAutoRedeemedRef.current) return;
    if (!user?.preferences?.autoRedeemPoints) return;
    if (pointsBalance <= 0 || lockedTotalNaira <= 0) return;
    const cap = Math.min(pointsBalance, lockedTotalNaira);
    if (cap > 0) {
      setPointsToSpend(cap);
      hasAutoRedeemedRef.current = true;
    }
  }, [user?.preferences?.autoRedeemPoints, pointsBalance, lockedTotalNaira]);

  // Auto-select wallet exactly once on return from a successful top-up
  // (`?select=wallet`). Guarded by a ref so re-renders or back-and-
  // forward re-mounts don't keep clobbering a manual reselection.
  const hasAutoSelectedRef = useRef(false);
  useEffect(() => {
    if (hasAutoSelectedRef.current) return;
    if (select === "wallet" && methods.find((m) => m.id === "wallet")) {
      setSelectedId("wallet");
      setPaymentMethod("wallet");
      hasAutoSelectedRef.current = true;
    }
  }, [select, methods, setPaymentMethod]);

  const selected = methods.find((m) => m.id === selectedId) ?? null;
  const insufficient = selected?.kind === "wallet" && selected.insufficient;
  const shortfall =
    insufficient && selected?.balance !== undefined
      ? Math.max(0, finalTotal - (selected.balance ?? 0))
      : 0;

  /**
   * Route to the top-up screen with the shortfall pre-filled and
   * `returnTo=payment` so a successful top-up brings the user back
   * here with the wallet method auto-selected.
   */
  const goTopUpForShortfall = useCallback(() => {
    router.push({
      pathname: "/(customer)/wallet/topup",
      params: { prefill: String(shortfall || ""), returnTo: "payment" },
    } as never);
  }, [router, shortfall]);

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
        setSubmitting(false);
        return;
      }
      let init: InitializeResponse;
      try {
        init = await api.post<InitializeResponse>(
          "/api/payments/initialize",
          { orderId },
          { headers: { "Idempotency-Key": newIdempotencyKey() } as any }
        );
      } catch (err: any) {
        // Surface a clear, actionable message instead of the raw 500
        // bubbling up as "Failed to initialize payment". The most
        // common cause locally is a missing/test Paystack secret.
        Alert.alert(
          "Card payments not available",
          "We couldn't start a card payment right now. Try the wallet or bank transfer for now.",
          [{ text: "OK" }]
        );
        setSubmitting(false);
        return;
      }
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

  /**
   * Bank-transfer flow — temporary stub.
   *
   * The "real" bank-transfer path goes via Paystack's bank_transfer
   * channel (initialize → user pays into a one-time account →
   * webhook + verify). That requires a live or test Paystack secret;
   * we don't have one wired in this environment yet. Until then we
   * surface an Alert that explains the situation and route to the
   * receipt screen with a stubbed "paid" state so the rest of the
   * flow (rider dispatch, tracking, delivery) can be exercised.
   *
   * When the Paystack test key lands, restore the original code path
   * — kept under git history so the diff is small.
   */
  const payWithTransfer = useCallback(
    async (orderId: string) => {
      Alert.alert(
        "Bank transfer · stubbed",
        "We'll send you the account details after Paystack is wired. Continuing as if paid so you can test the rest of the flow.",
        [
          {
            text: "Continue",
            onPress: async () => {
              await redeemPointsIfAny(orderId);
              goReceipt();
              setSubmitting(false);
            },
          },
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => setSubmitting(false),
          },
        ]
      );
    },
    [redeemPointsIfAny, goReceipt]
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
      amount: fuelSubtotal,
    },
    { label: "Service fee", amount: SERVICE_FEE },
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
          label={
            insufficient
              ? `Top up & pay ${formatCurrency(finalTotal)}`
              : `Pay ${formatCurrency(finalTotal)}`
          }
          subtitle={
            insufficient
              ? "Continue with wallet after top-up"
              : selected?.sublabel
          }
          disabled={(!selected && !insufficient) || submitting}
          loading={submitting}
          onPress={insufficient ? goTopUpForShortfall : handlePay}
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
          onTopUp={goTopUpForShortfall}
        />

        {insufficient && shortfall > 0 ? (
          <View style={styles.shortfallCard}>
            <Ionicons
              name="add-circle"
              size={18}
              color={
                theme.mode === "dark"
                  ? theme.palette.gold300
                  : theme.palette.warning700
              }
            />
            <View style={styles.shortfallBody}>
              <Text style={styles.shortfallTitle}>
                Top up to cover {formatCurrency(shortfall)} shortfall
              </Text>
              <Text style={styles.shortfallSub}>
                Add the gap and we'll keep this method selected — your
                order continues right where you left it.
              </Text>
              <Pressable
                onPress={goTopUpForShortfall}
                accessibilityRole="button"
                accessibilityLabel={`Top up ${formatCurrency(shortfall)}`}
                style={({ pressed }) => [
                  styles.shortfallCta,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Ionicons
                  name="add"
                  size={13}
                  color={theme.mode === "dark" ? "#000" : "#fff"}
                />
                <Text style={styles.shortfallCtaText}>
                  Top up {formatCurrency(shortfall)}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

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

        {/* PointsRedeem is its own card — no section label since the
            card carries its own header ("You have X points"). */}
        <PointsRedeem
          total={lockedTotalNaira}
          balance={pointsBalance}
          pointsToSpend={pointsToSpend}
          onChange={setPointsToSpend}
          collapsible
        />

        {/* Cost summary — neutral surface (design uses a white card with
            a divider above the Total row). The eyebrow lives OUTSIDE
            the card per design. Sub-line carries the receipt-to email
            so the user knows where their receipt lands. */}
        <Text style={styles.sectionLabel}>SUMMARY</Text>
        <MoneySurface
          lineItems={lineItems}
          totalLabel="Total"
          totalValue={finalTotal}
          emphasis="neutral"
          sub={
            userEmail
              ? `Receipt to ${userEmail}`
              : "Receipt sent by email"
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

    /* Wallet shortfall inline upsell card */
    shortfallCard: {
      flexDirection: "row",
      gap: 10,
      alignItems: "flex-start",
      padding: 14,
      borderRadius: 12,
      backgroundColor:
        theme.mode === "dark"
          ? "rgba(245,197,24,0.08)"
          : theme.palette.warning50,
      borderWidth: 1,
      borderColor:
        theme.mode === "dark"
          ? "rgba(245,197,24,0.18)"
          : theme.palette.warning100,
      marginTop: -theme.space.s2, // hugs the wallet method card above
    },
    shortfallBody: { flex: 1, minWidth: 0 },
    shortfallTitle: {
      fontSize: 13,
      fontWeight: "800",
      color:
        theme.mode === "dark"
          ? theme.palette.gold300
          : theme.palette.warning700,
    },
    shortfallSub: {
      fontSize: 11.5,
      color: theme.fgMuted,
      marginTop: 4,
      lineHeight: 17,
    },
    shortfallCta: {
      marginTop: 10,
      height: 36,
      paddingHorizontal: 14,
      borderRadius: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor:
        theme.mode === "dark" ? "#fff" : theme.palette.neutral900,
      alignSelf: "flex-start",
    },
    shortfallCtaText: {
      fontSize: 12.5,
      fontWeight: "800",
      color: theme.mode === "dark" ? theme.palette.neutral900 : "#fff",
    },
  });
