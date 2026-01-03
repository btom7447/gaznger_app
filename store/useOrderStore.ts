import { create } from "zustand";
import { persist } from "zustand/middleware";
import { shallow } from "zustand/shallow";
import { zustandAsyncStorage } from "./ZustandAsyncStorage";

export interface FuelType {
  _id: string;
  name: string;
  unit: string;
  icon?: string;
}

export interface OrderDraft {
  fuel: FuelType | null;
  quantity: number;
}

interface OrderState {
  fuelTypes: FuelType[];
  isFetchingFuelTypes: boolean;

  order: OrderDraft;
  hasHydrated: boolean;

  fetchFuelTypes: () => Promise<void>;
  setFuel: (fuel: FuelType) => void;
  setQuantity: (qty: number) => void;
  resetOrder: () => void;

  // computed value
  canContinue: boolean;
}

export const useOrderStore = create<OrderState>()(
  persist(
    (set, get) => ({
      fuelTypes: [],
      isFetchingFuelTypes: false,
      order: { fuel: null, quantity: 0 },
      hasHydrated: false,

      // Computed getter
      get canContinue() {
        const { fuel, quantity } = get().order;
        return !!fuel && quantity > 0;
      },

      fetchFuelTypes: async () => {
        const { fuelTypes, isFetchingFuelTypes } = get();
        if (fuelTypes.length || isFetchingFuelTypes) return;

        set({ isFetchingFuelTypes: true });
        try {
          const res = await fetch(
            `${process.env.EXPO_PUBLIC_BASE_URL}/api/fuel-types`
          );
          if (!res.ok) throw new Error("Failed to fetch fuel types");
          const data = await res.json();
          set({ fuelTypes: data });
        } catch (err) {
          console.error("fetchFuelTypes error:", err);
        } finally {
          set({ isFetchingFuelTypes: false });
        }
      },

      setFuel: (fuel) => {
        const currentFuelId = get().order.fuel?._id;
        if (currentFuelId === fuel._id) return;
        set((state) => ({ order: { ...state.order, fuel } }));
      },

      setQuantity: (quantity) =>
        set((state) => ({ order: { ...state.order, quantity } })),

      resetOrder: () => set({ order: { fuel: null, quantity: 0 } }),
    }),
    {
      name: "order-store",
      storage: zustandAsyncStorage,
      onRehydrateStorage: () => (state) => {
        if (state) state.hasHydrated = true;
      },
    }
  )
);