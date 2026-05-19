import { create } from "zustand";
import { persist } from "zustand/middleware";
import { secureStorage } from "./secureStorage";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import { resetAuthGates } from "@/lib/api";

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
  /**
   * Vendor-only public business name (e.g. "Abkon Oil Ltd"). Set in
   * the v7 vendor onboarding wizard's Step 1. Empty/missing on a fresh
   * vendor signup → bootstrap routes the user to the wizard rather
   * than the vendor home.
   */
  vendorBusinessName?: string;
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
    /** Sub-toggle for order/rider/delivery push (gated by pushEnabled). */
    orderUpdates?: boolean;
    /** Sub-toggle for marketing/referral push (gated by pushEnabled). */
    promotions?: boolean;
    notificationsFilter?: string;
  };

  /** Whether the user has a 4-digit PIN configured server-side. */
  hasPin?: boolean;

  /**
   * Rider/vendor verification status. Set on signup and updated by
   * the server when verification clears (push event + /auth/me).
   * Customers don't carry this field.
   */
  verificationStatus?: "pending" | "approved" | "rejected";

  /**
   * Saved address ids. Mirrored from the server's User.addressBook so
   * the Profile row badge can show the count without an extra fetch.
   */
  addressBook?: string[];
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
        // LOGIC P0-3 — clear session-expired + intentional-signout
        // gates BEFORE setting tokens. Without this, a rapid
        // logout→login cycle can leave the gates raised and any 401
        // during the window is silently swallowed.
        resetAuthGates();
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
