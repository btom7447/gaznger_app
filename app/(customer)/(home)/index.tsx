import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Theme, useTheme } from "@/constants/theme";
import { useSessionStore } from "@/store/useSessionStore";
import { useNotificationStore } from "@/store/useNotificationStore";
import { useDefaultAddress } from "@/hooks/useDefaultAddress";
import { useOrderStore } from "@/store/useOrderStore";
import { api } from "@/lib/api";
import { EmptyState, OfflineStrip, Skeleton } from "@/components/ui/primitives";
import HomeHeader from "@/components/ui/customer/home/HomeHeader";
import AddressChip from "@/components/ui/customer/home/AddressChip";
import PromoBanner from "@/components/ui/customer/home/PromoBanner";
// Active-order shape kept for typing the local `active` state used by
// the orders-loading skeleton heuristic. The banner component itself
// is intentionally not imported — per UX direction the home banner
// slot is promo-only.
import { ActiveOrderInfo } from "@/components/ui/customer/home/ActiveOrderBanner";
import FuelGrid, {
  DEFAULT_FUEL_TILES,
  FuelTile,
} from "@/components/ui/customer/home/FuelGrid";
import RecentOrders, {
  RecentOrderItem,
} from "@/components/ui/customer/home/RecentOrders";
import SectionLabel from "@/components/ui/customer/home/SectionLabel";
import FuelPriceRates, {
  FuelRate,
} from "@/components/ui/customer/home/FuelPriceRates";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

interface ServerOrder {
  _id: string;
  status: string;
  totalPrice: number;
  createdAt: string;
  fuel?: { name: string; unit: string };
  quantity?: number;
  station?: {
    _id?: string;
    name?: string;
    address?: string;
    location?: { lat: number; lng: number };
  };
  eta?: number;

  // New-flow fields (present on orders placed via the post-revamp customer
  // flow). Reorder bypass routes to Payment iff ALL of these resolve.
  product?: "liquid" | "lpg";
  fuelTypeId?: string;
  unit?: "L" | "kg";
  qty?: number;
  serviceType?: "refill" | "swap";
  cylinderType?: string;
  deliveryAddressId?: string;
  deliveryAddress?: { _id: string; label?: string; latitude?: number; longitude?: number };
  /** Per-unit price locked at the Stations screen, in kobo. */
  lockedPriceKobo?: number;
  /** Total in kobo (qty × lockedPriceKobo). */
  lockedTotalKobo?: number;
  /** Note for rider. */
  note?: string;
  /** Payment method used. */
  paymentMethodId?: string;
}

// Static placeholder rates until /api/fuel-prices lands.
// FuelPriceRates shows market-information rates (what stations near you are
// charging today) — informational only. The customer's actual price still
// locks on the Stations screen per the pricing rule.
const STATIC_FUEL_RATES: FuelRate[] = [
  { id: "petrol", label: "Petrol", amount: 800, unit: "L" },
  { id: "diesel", label: "Diesel", amount: 1150, unit: "L" },
  { id: "lpg", label: "LPG", amount: 1250, unit: "kg" },
  { id: "kero", label: "Kero", amount: 1300, unit: "L" },
];

/**
 * Active statuses recognised by Home for swapping the PromoBanner
 * with the ActiveOrderBanner. Mirrors the canonical
 * `utils/orderStatusLabels.ts ACTIVE_STATUSES` list, but materialised
 * as a Set for cheap lookups inside the orders.find callback. We
 * also keep the legacy `in_transit` / `in-transit` / `pending` /
 * `awaiting_confirmation` variants because older orders in the DB
 * still report those values.
 */
const ACTIVE_STATUSES = new Set([
  // Legacy enum values
  "pending",
  "confirmed",
  "assigned",
  "in_transit",
  "in-transit",
  "awaiting_confirmation",
  // v2/v3 granular flow
  "assigning",
  "picked_up",
  "at_plant",
  "refilling",
  "returning",
  "arrived",
  "dispensing",
]);

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
  });
}

function statusLabel(status: string): string {
  switch (status) {
    case "pending":
    case "confirmed":
      return "Confirmed";
    case "assigned":
      return "Rider on the way";
    case "in_transit":
    case "in-transit":
      return "On the way";
    case "awaiting_confirmation":
      return "At your gate";
    default:
      return "In progress";
  }
}

function mapToRecent(order: ServerOrder): RecentOrderItem {
  const qty = order.quantity ?? 0;
  const unit = order.fuel?.unit ?? "L";
  const fuelName = order.fuel?.name ?? "Order";
  const stationName = order.station?.name;
  const stationArea = order.station?.address?.split(",")[0]?.trim();
  const subtitle = [
    stationName && stationArea
      ? `${stationName}, ${stationArea}`
      : stationName ?? "",
    relativeTime(order.createdAt),
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    id: order._id,
    title: `${qty} ${unit} ${fuelName}`,
    subtitle,
    amount: order.totalPrice,
    reorderable: order.status === "delivered",
  };
}

/**
 * Home — static layout renders immediately. Each dynamic section owns its own
 * loading state and skeleton; failures are silent (best-effort UI).
 */
export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const user = useSessionStore((s) => s.user);
  const updateUser = useSessionStore((s) => s.updateUser);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const { label: addressLabel, subLabel: addressSub, loading: addressLoading } =
    useDefaultAddress();

  const firstName = useMemo(() => {
    const dn = user?.displayName?.trim();
    if (!dn) return null;
    return dn.split(/\s+/)[0];
  }, [user?.displayName]);

  // Order-store actions used by the Reorder bypass.
  const startOrder = useOrderStore((s) => s.startOrder);
  const setQty = useOrderStore((s) => s.setQty);
  const setServiceType = useOrderStore((s) => s.setServiceType);
  const setCylinderType = useOrderStore((s) => s.setCylinderType);
  const setSelectedAddress = useOrderStore((s) => s.setSelectedAddress);
  const setNote = useOrderStore((s) => s.setNote);
  const lockStation = useOrderStore((s) => s.lockStation);
  const setPaymentMethod = useOrderStore((s) => s.setPaymentMethod);

  // Dynamic sections — independent loading state per fetch.
  const [recent, setRecent] = useState<RecentOrderItem[] | null>(null);
  // Raw past-order records, keyed by id for fast lookup on Reorder.
  const [pastById, setPastById] = useState<Record<string, ServerOrder>>({});
  const [active, setActive] = useState<ActiveOrderInfo | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [pointsLoading, setPointsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fetchSeqRef = useRef(0);

  const fetchPoints = useCallback(async () => {
    setPointsLoading(true);
    try {
      const data = await api.get<{ points: number }>("/api/points", {
        timeoutMs: 8000,
      });
      if (typeof data?.points === "number") {
        updateUser({ points: data.points });
      }
    } catch {
      // best-effort
    } finally {
      setPointsLoading(false);
    }
  }, [updateUser]);

  const fetchOrders = useCallback(async () => {
    const mySeq = ++fetchSeqRef.current;
    setOrdersLoading(true);
    try {
      const data = await api.get<{ data: ServerOrder[] }>(
        "/api/orders?page=1&limit=5",
        { timeoutMs: 12000 }
      );
      if (mySeq !== fetchSeqRef.current) return;
      const orders = data?.data ?? [];
      const activeOrder = orders.find((o) =>
        ACTIVE_STATUSES.has(String(o.status))
      );
      const past = orders.filter(
        (o) => !ACTIVE_STATUSES.has(String(o.status))
      );
      setActive(
        activeOrder
          ? {
              orderId: activeOrder._id,
              statusLabel: statusLabel(String(activeOrder.status)),
              etaMinutes:
                typeof activeOrder.eta === "number" ? activeOrder.eta : null,
            }
          : null
      );
      setRecent(past.slice(0, 2).map(mapToRecent));
      // Index past orders by id for the Reorder bypass.
      setPastById(
        past.reduce<Record<string, ServerOrder>>((acc, o) => {
          acc[o._id] = o;
          return acc;
        }, {})
      );
    } catch {
      // leave whatever cached state we have
    } finally {
      if (mySeq === fetchSeqRef.current) setOrdersLoading(false);
    }
  }, []);

  // Initial mount — kick both fetches in parallel (no Promise.all blocking).
  useEffect(() => {
    fetchPoints();
    fetchOrders();
  }, [fetchPoints, fetchOrders]);

  // On focus (not the initial mount), refresh quietly.
  const isFirstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      fetchOrders();
    }, [fetchOrders])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Kick both, but don't block the spinner on the slowest one beyond timeout.
      await Promise.allSettled([fetchPoints(), fetchOrders()]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchPoints, fetchOrders]);

  const handleFuelSelect = useCallback(
    (item: FuelTile) => {
      // Unified Order screen handles all fuels (incl. LPG) via the `fuel` param.
      router.push({
        pathname: "/(customer)/(order)" as never,
        params: { fuel: item.id } as never,
      });
    },
    [router]
  );

  const handleAddressPress = useCallback(() => {
    router.push("/(screens)/address-book" as never);
  }, [router]);

  const handleNotifsPress = useCallback(() => {
    router.push("/(screens)/notifications-customer" as never);
  }, [router]);

  const handlePointsPress = useCallback(() => {
    router.push("/(screens)/profile" as never);
  }, [router]);

  const handleRecentRowPress = useCallback(
    (item: RecentOrderItem) => {
      router.push({
        pathname: "/(customer)/(order)/[id]" as never,
        params: { id: item.id } as never,
      });
    },
    [router]
  );

  const handleReorder = useCallback(
    (item: RecentOrderItem) => {
      const order = pastById[item.id];

      // New-flow guard: only orders placed AFTER the revamp carry the full
      // shape we need to bypass straight to Payment. Old orders (no
      // `product`/`lockedTotalKobo`/`station._id`) fall back to Stations so
      // the user can re-pick a station and have today's price re-locked.
      const newFlowReady =
        order &&
        order.product &&
        order.fuelTypeId &&
        order.unit &&
        typeof order.qty === "number" &&
        order.deliveryAddressId &&
        order.station?._id &&
        typeof order.lockedPriceKobo === "number" &&
        typeof order.lockedTotalKobo === "number";

      if (!newFlowReady || !order) {
        router.push("/(customer)/(order)/stations" as never);
        return;
      }

      // Hydrate the draft from the prior order, then jump to Payment.
      startOrder({
        product: order.product!,
        fuelTypeId: order.fuelTypeId!,
        unit: order.unit!,
      });
      setQty(order.qty!);
      if (order.serviceType) setServiceType(order.serviceType);
      if (order.cylinderType) setCylinderType(order.cylinderType);

      const addr = order.deliveryAddress;
      const coords =
        addr?.latitude != null && addr?.longitude != null
          ? { lat: addr.latitude, lng: addr.longitude }
          : undefined;
      setSelectedAddress({
        id: order.deliveryAddressId!,
        label: addr?.label,
        coords,
      });

      if (order.note) setNote(order.note);

      lockStation({
        id: order.station!._id!,
        name: order.station!.name ?? "",
        address: order.station!.address,
        lat: order.station!.location?.lat,
        lng: order.station!.location?.lng,
        perUnitKobo: order.lockedPriceKobo!,
      });

      if (order.paymentMethodId) setPaymentMethod(order.paymentMethodId);

      router.push("/(customer)/(order)/payment" as never);
    },
    [
      pastById,
      startOrder,
      setQty,
      setServiceType,
      setCylinderType,
      setSelectedAddress,
      setNote,
      lockStation,
      setPaymentMethod,
      router,
    ]
  );

  return (
    <SafeAreaView edges={["top"]} style={[styles.root, { backgroundColor: theme.bg }]}>
      <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        {/* Static — no skeleton. Points number does its own micro-skeleton. */}
        <HomeHeader
          greeting={firstName}
          pointsBalance={
            pointsLoading ? null : (user?.points ?? 0)
          }
          unreadNotifs={unreadCount}
          onPointsPress={handlePointsPress}
          onNotifsPress={handleNotifsPress}
        />

        <OfflineStrip />

        {/* AddressChip is static — but the resolved label has its own loading state. */}
        <AddressChip
          address={addressLoading ? null : addressLabel}
          subLabel={addressLoading ? null : addressSub}
          onPress={handleAddressPress}
        />

        {/* Promo banner — strictly promo-only.
            Per UX direction this slot NEVER swaps to a tracking
            banner, an active-order banner, or anything else. Even
            with an order in flight, the carousel keeps cycling
            promo slides; tracking lives on the dedicated Track
            screen, not here. We still reserve the same 200px height
            during initial load so the layout doesn't jump. */}
        {ordersLoading && active === null && recent === null ? (
          <Skeleton
            width="100%"
            height={200}
            borderRadius={theme.radius.xl}
          />
        ) : (
          <PromoBanner />
        )}

        {/* Static section + static fuel grid. */}
        <SectionLabel>WHAT DO YOU NEED?</SectionLabel>
        <FuelGrid items={DEFAULT_FUEL_TILES} onSelect={handleFuelSelect} />

        {/*
         * Static placeholder rates until /api/fuel-prices lands.
         * NOTE: pricing-rule deviation — single values instead of ranges.
         * Logged in handoff/_plan/EXECUTION_PLAN.md (deviation #1).
         */}
        <FuelPriceRates rates={STATIC_FUEL_RATES} area="Lagos" />

        {/* Recent — dynamic skeleton sized to row height (64). */}
        <SectionLabel
          asHeading
          trailing={{
            label: "See all",
            onPress: () =>
              router.push("/(customer)/(order)/history" as never),
          }}
        >
          Recent
        </SectionLabel>

        {ordersLoading && recent === null ? (
          <View style={{ gap: theme.space.s2 }}>
            <Skeleton
              width="100%"
              height={64}
              borderRadius={theme.radius.lg}
            />
            <Skeleton
              width="100%"
              height={64}
              borderRadius={theme.radius.lg}
            />
          </View>
        ) : recent && recent.length > 0 ? (
          <RecentOrders
            items={recent}
            onRowPress={handleRecentRowPress}
            onReorder={handleReorder}
          />
        ) : (
          <EmptyState
            icon="cube-outline"
            title="Order delivered. What's next?"
            body="Pick a fuel above. We'll handle the queue, the station and the rider."
            tileBg={theme.primaryTint}
            tileFg={theme.primary}
            compact
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1 },
    scroll: {
      paddingHorizontal: theme.space.s4,
      paddingTop: theme.space.s2,
      paddingBottom: theme.space.s5 + 80, // leave room for floating tab bar
      gap: theme.space.s4,
    },
  });
