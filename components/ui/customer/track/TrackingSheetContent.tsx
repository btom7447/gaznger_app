import React, { useEffect, useMemo, useRef } from "react";
// gorhom's bottom-sheet uses react-native-gesture-handler internally;
// touchables sourced from there cooperate with the sheet's pan
// recogniser, so a tap on the footer routes through onPress instead
// of getting swallowed as a drag intent (the prior behaviour was
// "tap on Details → sheet snaps up" because RN's plain Pressable
// loses to gorhom's pan handler on Android).
import { TouchableOpacity as GHTouchableOpacity } from "react-native-gesture-handler";
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme, formatCurrency } from "@/constants/theme";
import { CustomerStatus } from "@/utils/orderStatusLabels";

/**
 * Tracking sheet — v3 design.
 *
 * Five phases, each with its own headline + body. The headline lives
 * in a single row at the top: eyebrow + bigger title on the left, ETA
 * pill on the right. Pre-assignment hides the ETA (we don't know yet);
 * almost-there tints the ETA primary green for emphasis.
 *
 * Phases (mapped from server status by the parent screen):
 *   pre-assignment → "Status" / "Matching rider…"        (skeleton body)
 *   assigned       → "Rider assigned" / "Heading to X"    (real RiderCard)
 *   at-pickup      → "At pickup" / "Refilling your fuel"  (RiderCard + progress)
 *   in-transit     → "On the move" / "Bringing fuel to you" (RiderCard)
 *   almost-there   → "Arrived" / "Rider at your gate"     (RiderCard, ETA primary)
 */
export type TrackPhase =
  | "pre-assignment"
  | "assigned"
  | "at-pickup"
  | "in-transit"
  | "almost-there";

export interface RiderInfo {
  firstName: string;
  lastName: string;
  plate?: string;
  rating?: number;
  phone?: string;
  initials?: string;
  /**
   * Optional profile photo URL. When present we render an Image in the
   * RiderCard avatar slot; otherwise we fall back to monogram initials.
   * The server stores a default avatar URL on every user, so this is
   * almost always populated — but we still treat it as best-effort and
   * gracefully degrade to initials on load failure.
   */
  profileImage?: string;
}

interface TrackingSheetContentProps {
  /**
   * Active = there's an order in flight (the normal case).
   * Empty  = no active order; render an empty-state body with a
   *          "Place an order" CTA inside the sheet rather than
   *          replacing the whole screen with an EmptyState.
   * Defaults to "active" so existing callers don't need to opt in.
   */
  mode?: "active" | "empty";
  /** Customer-facing status used for fallback labels + a11y. */
  status: CustomerStatus;
  /** v3 design phase. Drives copy + body layout. */
  trackPhase: TrackPhase;
  orderId: string;
  etaMinutes?: number | null;
  qty: number;
  unit: string;
  fuelLabel: string;
  /** Station short name (e.g. "NNPC Berger") for headline + footer. */
  stationName?: string;
  totalNaira: number;
  rider?: RiderInfo | null;
  onCall?: () => void;
  onChat?: () => void;
  /**
   * Optional unit price in naira (per-litre or per-kg) — used to render
   * the line-item subtotal inside the Details accordion. Falls back to
   * `totalNaira / qty` if not supplied so the accordion always shows
   * sensible numbers.
   */
  unitPriceNaira?: number;
  /**
   * Payment method label shown in the Details accordion ("Wallet",
   * "Card", "Cash on delivery", etc.). Omitted in the accordion when
   * not provided.
   */
  paymentLabel?: string;
  /**
   * Delivery address line shown in the Details accordion. Omitted when
   * not provided.
   */
  addressLabel?: string;
  /** Tap handler for the empty-state "Place an order" CTA. */
  onPlaceOrderPress?: () => void;
  /**
   * When true (and trackPhase==="at-pickup"), renders the refill
   * progress loader. Driven by the parent screen — true only for the
   * brief window between the rider tapping "Heading back" and the
   * server flipping status to `returning`. Idle at-pickup time
   * (rider en route to or arrived at station) shows the calm body
   * with no loader, so the bar doesn't crawl forever and feels honest.
   */
  showRefillLoader?: boolean;
}

export default function TrackingSheetContent({
  mode = "active",
  status,
  trackPhase,
  orderId,
  etaMinutes,
  qty,
  unit,
  fuelLabel,
  stationName,
  totalNaira,
  rider,
  onCall,
  onChat,
  onPlaceOrderPress,
  unitPriceNaira,
  paymentLabel,
  addressLabel,
  showRefillLoader = false,
}: TrackingSheetContentProps) {
  // Details accordion: in-sheet expandable order summary. Replaces the
  // prior "navigate to /orders/:id" behaviour — the user wanted the
  // Details link to expand inline rather than push a screen, so the
  // active map context is preserved while they peek at line items.
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  // Empty-state short-circuit. The map sits behind, so we render a
  // calm empty-state card with a single primary CTA — same surface
  // language the user sees during active orders, just empty.
  if (mode === "empty") {
    return (
      <View style={styles.wrap}>
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconWrap}>
            <Ionicons
              name="bicycle-outline"
              size={28}
              color={theme.fgMuted}
            />
          </View>
          <Text style={styles.emptyTitle}>No active order</Text>
          <Text style={styles.emptyBody}>
            When you have an order in flight, you'll see live tracking
            here — rider, ETA, and the route to your address.
          </Text>
          <Pressable
            onPress={onPlaceOrderPress}
            accessibilityRole="button"
            accessibilityLabel="Place an order"
            style={({ pressed }) => [
              styles.emptyCta,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Ionicons name="flame" size={16} color="#fff" />
            <Text style={styles.emptyCtaText}>Place an order</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Per-phase headline copy. Station name swaps in for the assigned
  // and at-pickup phases so the user knows where the rider is going.
  const headline = useMemo(() => {
    switch (trackPhase) {
      case "pre-assignment":
        return { eyebrow: "Status", title: "Matching rider…" };
      case "assigned":
        return {
          eyebrow: "Rider assigned",
          title: stationName
            ? `Heading to ${stationName}`
            : "Heading to station",
        };
      case "at-pickup":
        return { eyebrow: "At pickup", title: "Refilling your fuel" };
      case "in-transit":
        return { eyebrow: "On the move", title: "Bringing fuel to you" };
      case "almost-there":
        return { eyebrow: "Arrived", title: "Rider at your gate" };
    }
  }, [trackPhase, stationName]);

  const showEta = trackPhase !== "pre-assignment";
  const etaIsPrimary = trackPhase === "almost-there";

  return (
    <View style={styles.wrap}>
      {/* StatusHeadline — eyebrow + title left, ETA right */}
      <View style={styles.headlineRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.eyebrow}>{headline.eyebrow.toUpperCase()}</Text>
          <Text style={styles.title} numberOfLines={2}>
            {headline.title}
          </Text>
        </View>
        {showEta ? (
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.etaLabel}>ETA</Text>
            <Text
              style={[styles.etaValue, etaIsPrimary && { color: theme.primary }]}
              accessibilityLabel={
                etaMinutes != null
                  ? `${etaMinutes} minutes`
                  : status.label
              }
            >
              {trackPhase === "almost-there"
                ? "< 1 min"
                : etaMinutes != null
                ? `${etaMinutes} min`
                : "—"}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Body */}
      {trackPhase === "pre-assignment" ? (
        <PreAssignmentBody theme={theme} />
      ) : trackPhase === "at-pickup" ? (
        <AtPickupBody
          theme={theme}
          rider={rider}
          stationName={stationName}
          showLoader={showRefillLoader}
          onCall={onCall}
          onChat={onChat}
        />
      ) : (
        <RiderCard
          rider={rider}
          theme={theme}
          onCall={onCall}
          onChat={onChat}
        />
      )}

      {/* Order summary footer — same shape on every phase. Tapping
          "Details" expands an inline accordion below the row rather
          than navigating away (preserves map + active rider context).
          We use gesture-handler's TouchableOpacity so the tap doesn't
          get eaten by the bottom sheet's pan recogniser. */}
      <GHTouchableOpacity
        onPress={() => setDetailsOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={detailsOpen ? "Hide order details" : "Show order details"}
        accessibilityState={{ expanded: detailsOpen }}
        activeOpacity={0.92}
        style={styles.footerRow}
      >
        <Ionicons name="flame" size={16} color={theme.fgMuted} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.footerTitle} numberOfLines={1}>
            {qty} {unit} {fuelLabel || "Petrol"}
            {stationName ? ` · ${stationName}` : ""}
          </Text>
          <Text style={styles.footerSub} numberOfLines={1}>
            #{orderId.slice(-6).toUpperCase()} · {formatCurrency(totalNaira)}
          </Text>
        </View>
        <View style={styles.footerLinkRow}>
          <Text style={styles.footerLink}>{detailsOpen ? "Hide" : "Details"}</Text>
          <Ionicons
            name={detailsOpen ? "chevron-up" : "chevron-down"}
            size={14}
            color={theme.mode === "dark" ? "#fff" : theme.palette.green700}
          />
        </View>
      </GHTouchableOpacity>

      {detailsOpen ? (
        <DetailsAccordion
          theme={theme}
          orderId={orderId}
          qty={qty}
          unit={unit}
          fuelLabel={fuelLabel}
          stationName={stationName}
          totalNaira={totalNaira}
          unitPriceNaira={unitPriceNaira}
          paymentLabel={paymentLabel}
          addressLabel={addressLabel}
        />
      ) : null}
    </View>
  );
}

/* ─────────────────────── RiderCard ─────────────────────── */

function RiderCard({
  rider,
  theme,
  onCall,
  onChat,
}: {
  rider?: RiderInfo | null;
  theme: Theme;
  onCall?: () => void;
  onChat?: () => void;
}) {
  const styles = useMemo(() => riderCardStyles(theme), [theme]);
  // Track whether the avatar image failed to load so we can fall back
  // to initials. Resets when the rider switches.
  const [imgError, setImgError] = React.useState(false);
  React.useEffect(() => {
    setImgError(false);
  }, [rider?.profileImage]);

  if (!rider) {
    return (
      <View style={styles.card}>
        <Text style={styles.placeholderText}>Waiting for rider…</Text>
      </View>
    );
  }

  const showImage = !!rider.profileImage && !imgError;

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        {showImage ? (
          <Image
            source={{ uri: rider.profileImage }}
            style={styles.avatarImage}
            onError={() => setImgError(true)}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(rider.initials ?? rider.firstName.charAt(0)).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>
            {rider.firstName} {rider.lastName}
          </Text>
          <View style={styles.metaRow}>
            {rider.plate ? (
              <Text style={styles.metaText}>{rider.plate}</Text>
            ) : null}
            {rider.rating != null ? (
              <>
                <Text style={styles.metaDot}>·</Text>
                <View style={styles.ratingPill}>
                  <Ionicons
                    name="star"
                    size={11}
                    color={
                      theme.mode === "dark"
                        ? theme.palette.gold300
                        : theme.palette.gold700
                    }
                  />
                  <Text style={styles.metaText}>
                    {rider.rating.toFixed(1)}
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <Pressable
          onPress={onCall}
          accessibilityRole="button"
          accessibilityLabel={`Call ${rider.firstName}`}
          disabled={!onCall || !rider.phone}
          style={({ pressed }) => [
            styles.callBtn,
            (!onCall || !rider.phone) && { opacity: 0.5 },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons name="call" size={16} color="#fff" />
          <Text style={styles.callBtnText}>Call rider</Text>
        </Pressable>
        <Pressable
          onPress={onChat}
          accessibilityRole="button"
          accessibilityLabel={`Message ${rider.firstName}`}
          style={({ pressed }) => [
            styles.messageBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons name="chatbubble" size={14} color={theme.fg} />
          <Text style={styles.messageBtnText}>Message</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ─────────────────────── Per-phase bodies ─────────────────────── */

function PreAssignmentBody({ theme }: { theme: Theme }) {
  // Looping shimmer for the placeholder.
  const pulseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const opacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1],
  });

  const styles = useMemo(() => preAssignmentStyles(theme), [theme]);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Animated.View
          style={[styles.placeholderAvatar, { opacity }]}
        />
        <View style={{ flex: 1, gap: 8 }}>
          <Animated.View
            style={[styles.placeholderLine, { width: "60%", opacity }]}
          />
          <Animated.View
            style={[styles.placeholderLine, { width: "40%", height: 10, opacity }]}
          />
        </View>
        <View style={styles.matchingPill}>
          <View style={styles.matchingDot} />
          <Text style={styles.matchingPillText}>MATCHING</Text>
        </View>
      </View>
      <Text style={styles.body}>
        We're locking in the fastest rider near you. Usually under 90 seconds.
      </Text>
    </View>
  );
}

function AtPickupBody({
  theme,
  rider,
  stationName,
  showLoader,
  onCall,
  onChat,
}: {
  theme: Theme;
  rider?: RiderInfo | null;
  stationName?: string;
  /** When true, animates a one-shot 5s progress bar from 0→1. */
  showLoader: boolean;
  onCall?: () => void;
  onChat?: () => void;
}) {
  const styles = useMemo(() => atPickupStyles(theme), [theme]);
  const progressAnim = useRef(new Animated.Value(0)).current;
  // Width interpolation has to live outside the conditional so the
  // hook-call order is stable across re-renders.
  const widthInterp = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  useEffect(() => {
    if (!showLoader) {
      progressAnim.setValue(0);
      return;
    }
    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 5000,
      useNativeDriver: false,
    }).start();
  }, [showLoader, progressAnim]);

  return (
    <View style={{ gap: 10 }}>
      <RiderCard rider={rider} theme={theme} onCall={onCall} onChat={onChat} />
      <View style={styles.refillCard}>
        <View style={styles.refillRow}>
          <Ionicons
            name="flame"
            size={16}
            color={theme.mode === "dark" ? "#fff" : theme.palette.green700}
          />
          <Text style={styles.refillTitle}>
            {showLoader
              ? "Heading back to you"
              : `Rider at ${stationName ?? "the station"}`}
          </Text>
        </View>
        {showLoader ? (
          <>
            <View style={styles.progressTrack}>
              <Animated.View
                style={[styles.progressFill, { width: widthInterp }]}
              />
            </View>
            <Text style={styles.progressMeta}>
              Confirming pickup with the station…
            </Text>
          </>
        ) : (
          <Text style={styles.progressMeta}>
            We'll switch back to live tracking once your rider's on the move.
          </Text>
        )}
      </View>
    </View>
  );
}

/* ─────────────────────── DetailsAccordion ─────────────────────── */

/**
 * Inline order-summary card that expands beneath the footer row when
 * the user taps "Details". Renders a receipt-style block — line item
 * for the fuel, totals row, plus optional payment + address rows when
 * those are supplied. Kept in this file (rather than its own module)
 * because it's only used inside this sheet and reads from the same
 * prop bag.
 */
function DetailsAccordion({
  theme,
  orderId,
  qty,
  unit,
  fuelLabel,
  stationName,
  totalNaira,
  unitPriceNaira,
  paymentLabel,
  addressLabel,
}: {
  theme: Theme;
  orderId: string;
  qty: number;
  unit: string;
  fuelLabel: string;
  stationName?: string;
  totalNaira: number;
  unitPriceNaira?: number;
  paymentLabel?: string;
  addressLabel?: string;
}) {
  const styles = useMemo(() => detailsAccordionStyles(theme), [theme]);
  const derivedUnit =
    unitPriceNaira ?? (qty > 0 ? Math.round(totalNaira / qty) : 0);
  const lineSubtotal = derivedUnit * qty;

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>RECEIPT</Text>

      <View style={styles.lineItemRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.lineItemTitle} numberOfLines={1}>
            {fuelLabel || "Petrol"}
          </Text>
          <Text style={styles.lineItemSub} numberOfLines={1}>
            {qty} {unit}
            {derivedUnit > 0
              ? ` · ${formatCurrency(derivedUnit)}/${unit}`
              : ""}
            {stationName ? ` · ${stationName}` : ""}
          </Text>
        </View>
        <Text style={styles.lineItemTotal}>{formatCurrency(lineSubtotal)}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{formatCurrency(totalNaira)}</Text>
      </View>

      {paymentLabel ? (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Payment</Text>
          <Text style={styles.metaValue} numberOfLines={1}>
            {paymentLabel}
          </Text>
        </View>
      ) : null}

      {addressLabel ? (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Deliver to</Text>
          <Text style={styles.metaValue} numberOfLines={2}>
            {addressLabel}
          </Text>
        </View>
      ) : null}

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Order ID</Text>
        <Text style={styles.metaValue}>
          #{orderId.slice(-6).toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

/* ─────────────────────── Styles ─────────────────────── */

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: {
      gap: 14,
    },

    /* Empty-state body. Mirrors the calm, low-density tone of the
       active sheet — single icon tile + title + supporting copy +
       one primary CTA. We don't pin a footer here because there's
       no order to summarise. */
    emptyCard: {
      alignItems: "center",
      paddingVertical: 16,
      paddingHorizontal: 8,
      gap: 6,
    },
    emptyIconWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.bgMuted,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: theme.fg,
    },
    emptyBody: {
      fontSize: 13,
      color: theme.fgMuted,
      textAlign: "center",
      lineHeight: 19,
      maxWidth: 280,
      marginBottom: 14,
    },
    emptyCta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      height: 48,
      paddingHorizontal: 22,
      borderRadius: 14,
      backgroundColor: theme.primary,
    },
    emptyCtaText: {
      fontSize: 14,
      fontWeight: "800",
      color: "#fff",
    },

    headlineRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
    },
    eyebrow: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.fgMuted,
      letterSpacing: 0.5,
    },
    title: {
      fontSize: 20,
      fontWeight: "800",
      color: theme.fg,
      letterSpacing: -0.3,
      marginTop: 2,
    },
    etaLabel: {
      fontSize: 10.5,
      fontWeight: "800",
      color: theme.fgMuted,
      letterSpacing: 0.5,
    },
    etaValue: {
      fontSize: 22,
      fontWeight: "800",
      color: theme.fg,
      letterSpacing: -0.4,
      ...theme.type.money,
      marginTop: 2,
    },

    /* Order summary footer — pinned at bottom of sheet content */
    footerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: theme.bgMuted,
    },
    footerTitle: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.fg,
    },
    footerSub: {
      fontSize: 11.5,
      color: theme.fgMuted,
      marginTop: 1,
      ...theme.type.money,
    },
    footerLinkRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    footerLink: {
      fontSize: 11.5,
      fontWeight: "700",
      color: theme.mode === "dark" ? "#fff" : theme.palette.green700,
    },

  });

const riderCardStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      padding: 14,
      backgroundColor: theme.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.divider,
    },
    placeholderText: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      textAlign: "center",
    },
    headRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 12,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.primaryTint,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarImage: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.bgMuted,
    },
    avatarText: {
      fontSize: 15,
      fontWeight: "800",
      color: theme.mode === "dark" ? "#fff" : theme.palette.green700,
    },
    name: {
      fontSize: 15,
      fontWeight: "800",
      color: theme.fg,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 2,
    },
    metaText: {
      fontSize: 11.5,
      color: theme.fgMuted,
      fontWeight: "700",
      ...theme.type.money,
    },
    metaDot: {
      fontSize: 11.5,
      color: theme.fgMuted,
    },
    ratingPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
    },
    actionsRow: {
      flexDirection: "row",
      gap: 8,
    },
    callBtn: {
      flex: 1.4,
      height: 44,
      borderRadius: 12,
      backgroundColor: theme.primary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      ...theme.elevation.card,
    },
    callBtnText: {
      fontSize: 13,
      fontWeight: "800",
      color: "#fff",
    },
    messageBtn: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      backgroundColor: theme.bgMuted,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    messageBtnText: {
      fontSize: 12.5,
      fontWeight: "700",
      color: theme.fg,
    },
  });

const preAssignmentStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      padding: 14,
      backgroundColor: theme.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.divider,
      gap: 12,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    placeholderAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.bgMuted,
    },
    placeholderLine: {
      height: 14,
      borderRadius: 4,
      backgroundColor: theme.bgMuted,
    },
    matchingPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor:
        theme.mode === "dark"
          ? "rgba(46,166,100,0.16)"
          : theme.primaryTint,
    },
    matchingDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: theme.success,
    },
    matchingPillText: {
      fontSize: 10.5,
      fontWeight: "800",
      color: theme.mode === "dark" ? "#fff" : theme.palette.green700,
      letterSpacing: 0.4,
    },
    body: {
      fontSize: 12.5,
      color: theme.fgMuted,
      lineHeight: 18,
    },
  });

const atPickupStyles = (theme: Theme) =>
  StyleSheet.create({
    refillCard: {
      padding: 14,
      borderRadius: 12,
      backgroundColor:
        theme.mode === "dark"
          ? "rgba(46,166,100,0.10)"
          : theme.primaryTint,
      borderWidth: 1,
      borderColor:
        theme.mode === "dark" ? theme.border : theme.palette.green100,
    },
    refillRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 8,
    },
    refillTitle: {
      fontSize: 13,
      fontWeight: "800",
      color: theme.mode === "dark" ? "#fff" : theme.palette.green700,
      flex: 1,
    },
    progressTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor:
        theme.mode === "dark" ? theme.palette.neutral800 : "#fff",
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: 3,
      backgroundColor: theme.primary,
    },
    progressMeta: {
      fontSize: 11,
      color: theme.fgMuted,
      marginTop: 6,
    },
  });

const detailsAccordionStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      padding: 14,
      borderRadius: 12,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.divider,
      gap: 8,
    },
    eyebrow: {
      fontSize: 10.5,
      fontWeight: "800",
      color: theme.fgMuted,
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    lineItemRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
    },
    lineItemTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.fg,
    },
    lineItemSub: {
      fontSize: 11.5,
      color: theme.fgMuted,
      marginTop: 2,
      ...theme.type.money,
    },
    lineItemTotal: {
      fontSize: 13,
      fontWeight: "800",
      color: theme.fg,
      ...theme.type.money,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.divider,
      marginVertical: 4,
    },
    totalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    totalLabel: {
      fontSize: 12,
      fontWeight: "800",
      color: theme.fg,
      letterSpacing: 0.2,
    },
    totalValue: {
      fontSize: 16,
      fontWeight: "800",
      color: theme.fg,
      ...theme.type.money,
    },
    metaRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
      marginTop: 2,
    },
    metaLabel: {
      fontSize: 11.5,
      color: theme.fgMuted,
      fontWeight: "700",
    },
    metaValue: {
      fontSize: 11.5,
      color: theme.fg,
      flex: 1,
      textAlign: "right",
      ...theme.type.money,
    },
  });
