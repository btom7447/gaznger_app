import { create } from "zustand";
import { persist } from "zustand/middleware";
import { zustandAsyncStorage } from "./ZustandAsyncStorage";

export type ColorSchemeOverride = "light" | "dark" | "system";

interface ThemeState {
  colorScheme: ColorSchemeOverride;
  setColorScheme: (scheme: ColorSchemeOverride) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      colorScheme: "system",
      setColorScheme: (colorScheme) => set({ colorScheme }),
    }),
    {
      name: "theme-store",
      storage: zustandAsyncStorage,
    }
  )
);
