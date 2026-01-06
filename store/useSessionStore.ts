import { create } from "zustand";
import { persist } from "zustand/middleware";
import { zustandAsyncStorage } from "./ZustandAsyncStorage";

export interface SessionUser {
  id: string;
  email: string;
  phone?: string;
  displayName: string;
  gender?: "male" | "female";
  profileImage?: string;
  points?: number;
  defaultAddress?: string | null;
}

interface SessionState {
  user: SessionUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoggedIn: boolean;
  hasHydrated: boolean;

  login: (data: {
    user: SessionUser;
    accessToken: string;
    refreshToken: string;
  }) => void;

  logout: () => void;
  updateUser: (fields: Partial<SessionUser>) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoggedIn: false,
      hasHydrated: false,

      login: ({ user, accessToken, refreshToken }) =>
        set({
          user,
          accessToken,
          refreshToken,
          isLoggedIn: true,
        }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isLoggedIn: false,
        }),

      updateUser: (fields) => {
        const current = get().user;
        if (!current) return;
        set({ user: { ...current, ...fields } });
      },
    }),
    {
      name: "session-store",
      storage: zustandAsyncStorage,
      onRehydrateStorage: () => (state) => {
        state?.hasHydrated && state.hasHydrated;
        state && (state.hasHydrated = true);
      },
    }
  )
);