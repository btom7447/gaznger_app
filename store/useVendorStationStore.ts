import { create } from "zustand";
import { persist } from "zustand/middleware";
import { zustandAsyncStorage } from "./ZustandAsyncStorage";

/**
 * Vendor-only: which station is currently active in the UI.
 *
 * Every vendor screen scopes its data by this station id (Today,
 * Orders, Tanks, Supplies, Finance). The station switcher chip on
 * the vendor top bar mutates it. Persisted so the same station is
 * selected on next launch.
 *
 * The list of stations themselves lives on the server (queryable via
 * GET /vendor/stations) and is cached on the session user via
 * `user.stations`. This store only tracks the active selection.
 *
 * Customer/rider sessions never touch this store.
 */
export interface VendorStationLite {
  /** Station Mongo _id (string). */
  id: string;
  /** Display name, e.g. "Abkon Oil — Uyo". */
  name: string;
  /** Short label for the chip (eg. "Uyo"). Falls back to name first word. */
  shortLabel?: string;
}

interface VendorStationState {
  /** All stations this vendor owns. Mirrored from /vendor/stations. */
  stations: VendorStationLite[];
  /**
   * _id of the currently-active station. `null` means "all stations"
   * — Orders/Supplies/Finance render across every station and the
   * switcher chip surfaces an "All stations" pill. The user opts into
   * a single station explicitly via the switcher.
   */
  activeStationId: string | null;
  /** Hydration flag for callers that need to wait. */
  hasHydrated: boolean;

  setStations: (stations: VendorStationLite[]) => void;
  /** Pass `null` to clear the scope back to "all stations". */
  setActiveStation: (id: string | null) => void;
  /** Convenience getter. */
  activeStation: () => VendorStationLite | null;
  reset: () => void;
}

export const useVendorStationStore = create<VendorStationState>()(
  persist(
    (set, get) => ({
      stations: [],
      activeStationId: null,
      hasHydrated: false,

      setStations: (stations) =>
        set((s) => {
          // Default scope is "all stations" — keep activeStationId
          // null on first load. Preserve a prior pick if the station
          // still exists after a server refresh; otherwise clear back
          // to all-stations.
          const prior = s.activeStationId;
          const stillExists =
            prior && stations.some((st) => st.id === prior);
          return {
            stations,
            activeStationId: stillExists ? prior : null,
          };
        }),

      setActiveStation: (id) => {
        if (id === null) {
          set({ activeStationId: null });
          return;
        }
        const exists = get().stations.some((s) => s.id === id);
        if (!exists) return;
        set({ activeStationId: id });
      },

      activeStation: () => {
        const { stations, activeStationId } = get();
        return stations.find((s) => s.id === activeStationId) ?? null;
      },

      reset: () =>
        set({ stations: [], activeStationId: null }),
    }),
    {
      name: "vendor-station-store",
      storage: zustandAsyncStorage,
      onRehydrateStorage: () => (state) => {
        state && (state.hasHydrated = true);
      },
      partialize: (state) => {
        const { hasHydrated, ...rest } = state;
        return rest as VendorStationState;
      },
    },
  ),
);
