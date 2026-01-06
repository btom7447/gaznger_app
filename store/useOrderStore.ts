import { create } from "zustand";
import { persist } from "zustand/middleware";
import { zustandAsyncStorage } from "./ZustandAsyncStorage";
import { MIN_QUANTITY } from "@/constants/orderOptions";

/** ---------------- TYPES ---------------- */
export interface FuelType {
  _id: string;
  name: string;
  unit: string;
  icon?: string;
}

export type DeliveryType = "cylinder_swap" | "home_refill";

export interface OrderDraft {
  fuel: FuelType | null;
  quantity: number;

  // gas-only
  cylinderType?: string;
  deliveryType?: DeliveryType;
  cylinderImages: string[];

  // common
  deliveryAddressId?: string;
  deliveryLabel?: string;
}

interface OrderState {
  fuelTypes: FuelType[];
  isFetchingFuelTypes: boolean;
  order: OrderDraft;

  // step: 0 = order, 1 = payment, 2 = tracking
  progressStep: number;
  hasHydrated: boolean;

  /** ---------------- ACTIONS ---------------- */
  fetchFuelTypes: () => Promise<void>;
  setFuel: (fuel: FuelType) => void;
  setQuantity: (qty: number) => void;
  setCylinderType: (type: string) => void;
  setDeliveryType: (type: DeliveryType) => void;
  addCylinderImage: (uri: string) => void;
  removeCylinderImage: (uri: string) => void;
  setDeliveryAddress: (id: string, label?: string) => void;
  resetOrder: () => void;

  /** ---------------- STEP ACTIONS ---------------- */
  setProgressStep: (step: number) => void;
  advanceStep: () => void;
  goBackStep: () => void;

  /** ---------------- COMPUTED ---------------- */
  canContinue: () => boolean;
  canEditOrder: () => boolean;
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

      fetchFuelTypes: async () => {
        if (get().fuelTypes.length || get().isFetchingFuelTypes) return;
        set({ isFetchingFuelTypes: true });
        try {
          const res = await fetch(
            `${process.env.EXPO_PUBLIC_BASE_URL}/api/fuel-types`
          );
          if (!res.ok) throw new Error("Failed to fetch fuel types");
          const data: FuelType[] = await res.json();
          set({ fuelTypes: data });
        } catch (err) {
          console.error("fetchFuelTypes error:", err);
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
        set((state) => ({ order: { ...state.order, quantity } })),
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
      setDeliveryAddress: (id: string, label?: string) =>
        set((state) => ({
          order: {
            ...state.order,
            deliveryAddressId: id,
            deliveryLabel: label,
          },
        })),
      resetOrder: () => set({ order: emptyOrder, progressStep: 0 }),
      setProgressStep: (step: number) =>
        set({ progressStep: Math.max(0, Math.min(step, 2)) }),
      advanceStep: () =>
        set((state) => ({ progressStep: Math.min(state.progressStep + 1, 2) })),
      goBackStep: () =>
        set((state) => ({ progressStep: Math.max(state.progressStep - 1, 0) })),

      /** ---------------- COMPUTED ---------------- */
      canContinue: () => {
        const { hasHydrated, order } = get();

        if (!hasHydrated) return false;

        const {
          fuel,
          quantity,
          deliveryAddressId,
          cylinderType,
          deliveryType,
          cylinderImages,
        } = order;

        if (!fuel) return false;
        if (!quantity || quantity <= 0) return false;

        // ✅ Business rule: minimum quantity per fuel
        const minQty = MIN_QUANTITY[fuel.name.toLowerCase()];
        if (minQty && quantity < minQty) {
          console.log(`canContinue ❌: quantity below minimum (${minQty})`);
          return false;
        }

        if (!deliveryAddressId) return false;

        if (isGasFuel(fuel)) {
          if (!cylinderType) return false;
          if (!deliveryType) return false;
          if (deliveryType === "cylinder_swap" && cylinderImages.length === 0)
            return false;
        }

        return true;
      },

      canEditOrder: () => get().progressStep === 0,
    }),
    {
      name: "order-store",
      storage: zustandAsyncStorage,
      onRehydrateStorage: () => (state) => {
        if (state) {
          // ❗ IMPORTANT: must update via set, not mutation
          useOrderStore.setState({ hasHydrated: true });
          console.log("Order store hydrated ✅");
        }
      },
    }
  )
);
