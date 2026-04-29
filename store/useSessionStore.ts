import { create } from "zustand";
import { persist } from "zustand/middleware";
import { secureStorage } from "./secureStorage";
import { connectSocket, disconnectSocket } from "@/lib/socket";

export type UserRole = "customer" | "vendor" | "rider" | "admin";

/**
 * Saved Paystack card metadata. Populated by the server on first
 * successful charge — do NOT mutate from the client. Treated as
 * "is the user able to pay with one tap" gate in payment.tsx.
 */
export interface SavedCard {
  authorizationCode?: string;
  last4: string;
  brand?: string;
  bank?: string;
  expMonth?: string;
  expYear?: string;
}

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
  /** Server-managed. Surfaces the "Use saved card" path in checkout. */
  lastPaystackAuth?: SavedCard;
  /** "pending" | "active" | "suspended". Gated UI when not active. */
  accountStatus?: "pending" | "active" | "suspended";
  /** Vendor + rider only — gates the withdraw button when active. */
  withdrawalHold?: { active: boolean; reason?: string };
  /**
   * Number of delivered LPG orders. Drives the saved-cylinder card on
   * Cylinder.tsx + the "Skip — use last photos" link on Photo.tsx.
   */
  lpgOrderCount?: number;
  /**
   * LPG-Swap saved cylinder profile. Populated on the first successful
   * swap when the customer accepts the "save cylinder" prompt.
   */
  savedCylinder?: {
    brand?: string;
    valve?: string;
    age?: string;
    test?: string;
    photos?: string[];
    savedAt?: string;
  };

  /**
   * Customer preferences. Server-mirrored — every Settings toggle PATCHes
   * the matching key via PUT /auth/me. Defaults at the server layer:
   *   autoRedeemPoints     → false
   *   priceAlertsEnabled   → false
   *   pushEnabled          → true
   *   notificationsFilter  → undefined (client treats as "all")
   *
   * See docs/handoff/_server-asks/auth-me-preferences.md for the full
   * contract.
   */
  preferences?: {
    autoRedeemPoints?: boolean;
    priceAlertsEnabled?: boolean;
    pushEnabled?: boolean;
    notificationsFilter?: string;
  };
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
