import { create } from "zustand";
import { persist } from "zustand/middleware";
import { secureStorage } from "./secureStorage";
import { connectSocket, disconnectSocket } from "@/lib/socket";

export type UserRole = "customer" | "vendor" | "rider" | "admin";

export interface SessionUser {
  id: string;
  email: string;
  phone?: string;
  displayName: string;
  gender?: "male" | "female";
  profileImage?: string;
  points?: number;
  defaultAddress?: string | null;
  role: UserRole;
  isOnboarded: boolean;
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
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoggedIn: false,
      hasHydrated: false,

      login: ({ user, accessToken, refreshToken }) => {
        set({ user, accessToken, refreshToken, isLoggedIn: true });
        // Connect socket after tokens are flushed to store
        setTimeout(() => connectSocket(accessToken), 0);
      },

      logout: () => {
        disconnectSocket();
        set({ user: null, accessToken: null, refreshToken: null, isLoggedIn: false });
      },

      updateUser: (fields) => {
        const current = get().user;
        if (!current) return;
        set({ user: { ...current, ...fields } });
      },

      setTokens: ({ accessToken, refreshToken }) =>
        set({ accessToken, refreshToken }),
    }),
    {
      name: "session-store",
      storage: secureStorage,
      onRehydrateStorage: () => (state) => {
        state && (state.hasHydrated = true);
      },
    }
  )
);
