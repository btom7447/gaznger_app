import { create } from "zustand";
import { persist } from "zustand/middleware";
import { zustandAsyncStorage } from "./ZustandAsyncStorage";
import { MIN_QUANTITY } from "@/constants/orderOptions";
import { api } from "@/lib/api";
import { FuelType } from "@/types";

export type { FuelType };

/**
 * Legacy delivery types — preserved for backwards compatibility with the
 * old LPG flow until Phase 4 replaces it. New code uses `serviceType`.
 */
export type DeliveryType = "cylinder_swap" | "home_refill";

/** New product family — drives liquid-vs-LPG branching in the order group. */
export type Product = "liquid" | "lpg";

/** New LPG service type — replaces legacy `deliveryType` semantically. */
export type ServiceType = "refill" | "swap";

/** When the customer wants delivery. */
export type WhenChoice = "now" | "schedule";

/** Locked station snapshot captured on the Stations screen. */
export interface LockedStation {
  id: string;
  name: string;
  shortName?: string;
  address?: string;
  lat?: number;
  lng?: number;
  /** Per-unit price as raw kobo so we never lose precision. */
  perUnitKobo: number;
  /** Total = perUnit * qty, snapshotted at lock time. */
  totalKobo: number;
  /** Distance in meters at lock time (informational). */
  distMeters?: number;
  /** ETA in minutes at lock time (informational). */
  etaMinutes?: number;
  /** Vendor partner verification flag at lock time. */
  partnerVerified?: boolean;
  /** When the lock happened — used to surface a refresh sheet on long pauses. */
  lockedAt: number;
}

export interface OrderDraft {
  // ── Legacy fields (kept for back-compat with not-yet-migrated screens) ──
  fuel: FuelType | null;
  quantity: number;
  cylinderType?: string;
  deliveryType?: DeliveryType;
  cylinderImages: string[];
  deliveryAddressId?: string;
  deliveryLabel?: string;
  deliveryCoords?: { lat: number; lng: number };
  stationId?: string;
  stationLabel?: string;

  // ── New spec fields (Phase 3+) ──
  /** liquid (Petrol/Diesel/Kero) or lpg. */
  product?: Product;
  /** Stable fuel id matching the FuelGrid tile (e.g. 'petrol'). */
  fuelTypeId?: string;
  /** Quantity unit — 'L' for liquid, 'kg' for LPG. */
  unit?: "L" | "kg";
  /** Quantity expressed in `unit`. Mirrors legacy `quantity` for liquid. */
  qty?: number;
  /** When the customer wants delivery. */
  when?: WhenChoice;
  /** Scheduled-delivery ISO timestamp; null/undefined when when==='now'. */
  scheduledAt?: string | null;
  /**
   * LPG-Swap only — when the rider should COME BACK for the empty cylinder.
   * Null = same-trip (rider takes the empty in the same delivery visit).
   * Server contract: backend should expose this as `returnSwapAt` on the
   * order document so the rider app can schedule the second visit.
   */
  returnSwapAt?: string | null;
  /** Optional rider note. */
  note?: string;
  /** LPG service mode. */
  serviceType?: ServiceType;
  /** Cylinder photos (Cloudinary URLs). LPG only. */
  cylinderPhotos?: string[];
  /** Locked station snapshot — present from Stations onward. */
  station?: LockedStation;
  /** Selected payment method id (saved card/wallet/etc). */
  paymentMethodId?: string;
  /** Server-issued order id once Payment posts successfully. */
  orderId?: string;

  /**
   * Rider profile, populated once an order:update with rider arrives.
   * Receipt + Track + Arrival/Handoff + Delivered + Rate + Complete all
   * read from here so the user sees a real name everywhere instead of
   * the previous "Emeka" placeholder.
   */
  rider?: {
    firstName: string;
    lastName?: string;
    plate?: string;
    rating?: number;
    phone?: string;
    initials?: string;
  };

  /** Server-issued delivery timestamp from the delivery-confirm event. */
  deliveredAt?: string;
  /** Final amount actually charged. Liquid = totalPrice. LPG = min(estimate, weighed actual). */
  totalCharged?: number;
  /** Points awarded on delivery, surfaced on the Delivered screen. */
  pointsEarned?: number;
  /** User's submitted rating + tip, set on rate.tsx submit. */
  rating?: {
    stars: number;
    tags: string[];
    tip: number;
    note?: string;
  };
  /** LPG-Swap weigh-in capture from the rider app. */
  weighIn?: {
    emptyKg: number;
    fullKg: number;
    netKg: number;
  };

  /**
   * LPG-Swap cylinder details collected on the Cylinder screen
   * (brand / valve / age / test). Sent to the server on order create
   * + saved on the user's profile if they accept the post-delivery
   * "save cylinder" prompt.
   */
  cylinderDetails?: {
    brand?: string;
    valve?: string;
    age?: string;
    test?: string;
  };
}

interface OrderState {
  fuelTypes: FuelType[];
  isFetchingFuelTypes: boolean;
  order: OrderDraft;

  /** Legacy step counter (0=order, 1=payment, 2=tracking). New code reads `order.station != null` etc. */
  progressStep: number;
  hasHydrated: boolean;

  /** ---------------- LEGACY ACTIONS (kept to not break vendor + transitional code) ---- */
  fetchFuelTypes: () => Promise<void>;
  setFuel: (fuel: FuelType) => void;
  setQuantity: (qty: number) => void;
  setCylinderType: (type: string) => void;
  setDeliveryType: (type: DeliveryType) => void;
  addCylinderImage: (uri: string) => void;
  removeCylinderImage: (uri: string) => void;
  setDeliveryAddress: (
    id: string,
    label?: string,
    coords?: { lat: number; lng: number }
  ) => void;
  setStation: (station: { id: string; label: string }) => void;
  setProgressStep: (step: number) => void;
  advanceStep: () => void;
  goBackStep: () => void;
  canContinue: () => boolean;
  canEditOrder: () => boolean;

  /** ---------------- NEW SPEC ACTIONS (Phase 3+) ---- */
  /** Set product + fuel id + unit in one call (called from Home FuelGrid tap). */
  startOrder: (input: {
    product: Product;
    fuelTypeId: string;
    label?: string;
    unit: "L" | "kg";
  }) => void;
  setQty: (qty: number) => void;
  setWhen: (when: WhenChoice, scheduledAt?: string | null) => void;
  /** LPG-Swap only — set the return-trip timestamp (null = same-trip). */
  setReturnSwapAt: (iso: string | null) => void;
  setNote: (note: string) => void;
  setServiceType: (s: ServiceType) => void;
  setCylinderPhotos: (urls: string[]) => void;
  setSelectedAddress: (input: {
    id: string;
    label?: string;
    coords?: { lat: number; lng: number };
  }) => void;
  /** Lock the price at the Stations screen. Computes totalKobo from qty × perUnitKobo. */
  lockStation: (input: Omit<LockedStation, "totalKobo" | "lockedAt">) => void;
  setPaymentMethod: (id: string) => void;
  /** Set after server returns orderId on Payment success. */
  setOrderId: (id: string) => void;
  /**
   * Receive a rider:assigned-style payload (from order:update socket
   * or the GET /api/orders/:id fallback). Idempotent.
   */
  setRider: (rider: {
    firstName: string;
    lastName?: string;
    plate?: string;
    rating?: number;
    phone?: string;
    initials?: string;
  }) => void;
  /** Stash the values that arrive on the delivery-confirm socket event. */
  setDeliveryConfirmation: (input: {
    deliveredAt?: string;
    totalCharged?: number;
    pointsEarned?: number;
  }) => void;
  /** Persist the user's rating + tip locally so Complete can reflect it. */
  setRating: (rating: {
    stars: number;
    tags: string[];
    tip: number;
    note?: string;
  }) => void;
  /** Persist the LPG weigh-in payload from the rider app. */
  setWeighIn: (weighIn: { emptyKg: number; fullKg: number; netKg: number }) => void;
  /** LPG-Swap cylinder details (Cylinder screen → order create body). */
  setCylinderDetails: (details: {
    brand?: string;
    valve?: string;
    age?: string;
    test?: string;
  }) => void;
  /** Wipe the draft (called from Complete screen + after server confirms close). */
  resetOrder: () => void;
}

/** ---------------- HELPERS ---------------- */
const isGasFuel = (fuel: FuelType | null) =>
  !!fuel && fuel.name.toLowerCase().includes("gas");

const emptyOrder: OrderDraft = {
  fuel: null,
  quantity: 0,
  cylinderImages: [],
};

/** ---------------- STORE ---------------- */
export const useOrderStore = create<OrderState>()(
  persist(
    (set, get) => ({
      fuelTypes: [],
      isFetchingFuelTypes: false,
      order: emptyOrder,
      progressStep: 0,
      hasHydrated: false,

      // ── legacy actions (preserved verbatim) ─────────────────────────
      fetchFuelTypes: async () => {
        if (get().fuelTypes.length || get().isFetchingFuelTypes) return;
        set({ isFetchingFuelTypes: true });
        try {
          const data = await api.get<FuelType[]>("/api/fuel-types");
          set({ fuelTypes: data });
        } catch {
          // fuelTypes stays empty — FuelGrid will show empty state
        } finally {
          set({ isFetchingFuelTypes: false });
        }
      },

      setFuel: (fuel) => {
        const gas = isGasFuel(fuel);
        set((state) => ({
          order: {
            ...state.order,
            fuel,
            ...(gas
              ? {}
              : {
                  cylinderType: undefined,
                  deliveryType: undefined,
                  cylinderImages: [],
                }),
          },
        }));
      },

      setQuantity: (quantity) =>
        set((state) => ({ order: { ...state.order, quantity, qty: quantity } })),

      setCylinderType: (type) => {
        if (!isGasFuel(get().order.fuel)) return;
        set((state) => ({ order: { ...state.order, cylinderType: type } }));
      },
      setDeliveryType: (type) => {
        if (!isGasFuel(get().order.fuel)) return;
        set((state) => ({
          order: {
            ...state.order,
            deliveryType: type,
            cylinderImages:
              type === "cylinder_swap" ? state.order.cylinderImages : [],
          },
        }));
      },
      addCylinderImage: (uri) => {
        const { order } = get();
        if (order.deliveryType !== "cylinder_swap") return;
        if (order.cylinderImages.length >= 3) return;
        set((state) => ({
          order: {
            ...state.order,
            cylinderImages: [...state.order.cylinderImages, uri],
          },
        }));
      },
      removeCylinderImage: (uri) =>
        set((state) => ({
          order: {
            ...state.order,
            cylinderImages: state.order.cylinderImages.filter((i) => i !== uri),
          },
        })),
      setDeliveryAddress: (
        id: string,
        label?: string,
        coords?: { lat: number; lng: number }
      ) =>
        set((state) => ({
          order: {
            ...state.order,
            deliveryAddressId: id,
            deliveryLabel: label,
            deliveryCoords: coords,
          },
        })),
      setStation: (station: { id: string; label: string }) =>
        set((state) => ({
          order: {
            ...state.order,
            stationId: station.id,
            stationLabel: station.label,
          },
        })),
      setProgressStep: (step: number) =>
        set({ progressStep: Math.max(0, Math.min(step, 2)) }),
      advanceStep: () =>
        set((state) => ({ progressStep: Math.min(state.progressStep + 1, 2) })),
      goBackStep: () =>
        set((state) => ({ progressStep: Math.max(state.progressStep - 1, 0) })),

      canContinue: () => {
        const { hasHydrated, order } = get();
        if (!hasHydrated) return false;
        const { fuel, quantity, cylinderType, deliveryType, cylinderImages } = order;
        if (!fuel) return false;
        if (!quantity || quantity <= 0) return false;
        const minQty = MIN_QUANTITY[fuel.name.toLowerCase()];
        if (minQty && quantity < minQty) return false;
        if (isGasFuel(fuel)) {
          if (!cylinderType) return false;
          if (!deliveryType) return false;
          if (deliveryType === "cylinder_swap" && cylinderImages.length === 0)
            return false;
        }
        return true;
      },
      canEditOrder: () => get().progressStep === 0,

      // ── new spec actions (Phase 3+) ──────────────────────────────────
      startOrder: ({ product, fuelTypeId, label, unit }) =>
        set((state) => ({
          order: {
            ...state.order,
            product,
            fuelTypeId,
            unit,
            // Mirror to legacy fields when possible to keep mid-migration
            // screens functional. fuel object is server-shaped; we don't
            // synthesize it here — the screens that need it will fetch.
            stationLabel: label ?? state.order.stationLabel,
            // Reset pipeline state so a fresh fuel choice doesn't carry over.
            station: undefined,
            paymentMethodId: undefined,
            orderId: undefined,
          },
        })),

      setQty: (qty) =>
        set((state) => ({
          order: { ...state.order, qty, quantity: qty },
        })),

      setReturnSwapAt: (iso) =>
        set((state) => ({
          order: { ...state.order, returnSwapAt: iso },
        })),

      setWhen: (when, scheduledAt = null) =>
        set((state) => ({
          order: {
            ...state.order,
            when,
            scheduledAt: when === "schedule" ? scheduledAt ?? null : null,
          },
        })),

      setNote: (note) =>
        set((state) => ({ order: { ...state.order, note } })),

      setServiceType: (s) =>
        set((state) => ({ order: { ...state.order, serviceType: s } })),

      setCylinderPhotos: (urls) =>
        set((state) => ({
          order: {
            ...state.order,
            cylinderPhotos: urls,
            cylinderImages: urls, // mirror to legacy field
          },
        })),

      setSelectedAddress: ({ id, label, coords }) =>
        set((state) => ({
          order: {
            ...state.order,
            deliveryAddressId: id,
            deliveryLabel: label,
            deliveryCoords: coords,
          },
        })),

      lockStation: (input) => {
        const qty = get().order.qty ?? get().order.quantity ?? 0;
        const totalKobo = Math.round(qty * input.perUnitKobo);
        set((state) => ({
          order: {
            ...state.order,
            station: { ...input, totalKobo, lockedAt: Date.now() },
            // Mirror to legacy fields for any transitional reads.
            stationId: input.id,
            stationLabel: input.shortName ?? input.name,
          },
        }));
      },

      setPaymentMethod: (id) =>
        set((state) => ({ order: { ...state.order, paymentMethodId: id } })),

      setOrderId: (id) =>
        set((state) => ({ order: { ...state.order, orderId: id } })),

      setRider: (rider) =>
        set((state) => ({ order: { ...state.order, rider } })),

      setDeliveryConfirmation: ({ deliveredAt, totalCharged, pointsEarned }) =>
        set((state) => ({
          order: {
            ...state.order,
            ...(deliveredAt ? { deliveredAt } : {}),
            ...(totalCharged != null ? { totalCharged } : {}),
            ...(pointsEarned != null ? { pointsEarned } : {}),
          },
        })),

      setRating: (rating) =>
        set((state) => ({ order: { ...state.order, rating } })),

      setWeighIn: (weighIn) =>
        set((state) => ({ order: { ...state.order, weighIn } })),

      setCylinderDetails: (details) =>
        set((state) => ({
          order: {
            ...state.order,
            cylinderDetails: { ...state.order.cylinderDetails, ...details },
          },
        })),

      resetOrder: () => set({ order: emptyOrder, progressStep: 0 }),
    }),
    {
      name: "order-store",
      version: 2,
      storage: zustandAsyncStorage,
      // Bumped to v2 — drops any in-flight legacy drafts (24h expiry anyway).
      migrate: (_persistedState, version) => {
        if (version < 2) {
          return { order: emptyOrder, progressStep: 0, fuelTypes: [] };
        }
        return _persistedState as Partial<OrderState>;
      },
      partialize: (state) => ({
        fuelTypes: state.fuelTypes,
        order: state.order,
        progressStep: state.progressStep,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          useOrderStore.setState({
            hasHydrated: true,
            isFetchingFuelTypes: false,
          });
        }
      },
    }
  )
);
