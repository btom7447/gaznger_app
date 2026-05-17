import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Pending-signup state — persisted to SecureStore so a user who kills
 * the app mid-signup can resume at the last completed step on next
 * launch. Cleared on successful signup or explicit "Start over" tap.
 *
 * The shape mirrors the signup tail roughly 1:1: phone → otp →
 * verificationToken → role → role-specific profile → pin → security.
 * Each setter is independent so screens can patch without re-supplying
 * earlier fields.
 *
 * IMPORTANT: never persist the raw PIN here — only the prepared form
 * after `preparePinForTransmission` (currently a no-op normalisation;
 * if the PIN-hashing decision lands in favour of client hashing, this
 * will hold the hash). The raw plaintext stays in component state for
 * the few seconds the user spends on the keypad.
 */

export type PendingRole = "customer" | "rider" | "vendor";

export interface PendingCustomerProfile {
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface PendingRiderProfile {
  fullName?: string;
  email?: string;
  plate?: string;
  vehicleType?: "motorcycle" | "tricycle" | "van";
}

export interface PendingVendorProfile {
  stationName?: string;
  licence?: string;
  contact?: string;
  address?: string;
  /** Canonical state code (e.g. "lagos") — see constants/nigeriaStates.ts. */
  state?: string;
  /** Local Government Area, derived from reverse-geocode. */
  lga?: string;
  /** Geocoded coordinates. Required for the Station document. */
  latitude?: number;
  longitude?: number;
  products?: string[];
}

export interface PendingProfile {
  customer?: PendingCustomerProfile;
  rider?: PendingRiderProfile;
  vendor?: PendingVendorProfile;
}

export type SecurityChoice = "face" | "touch" | "pin";

interface PendingSignupState {
  /** E.164-normalised phone (e.g. +2348012345678). */
  phone?: string;
  /** Timestamp of successful OTP verification. */
  phoneVerifiedAt?: number;
  /**
   * Server-issued verification token from /auth/verify-otp, scoped to
   * signup. Has a 15-minute TTL on the server; we re-check before use.
   */
  verificationToken?: string;
  /** Absolute ms timestamp at which `verificationToken` becomes invalid. */
  verificationTokenExpiresAt?: number;
  /** Selected role. */
  role?: PendingRole;
  /**
   * Role-specific profile fields. Stored under all role keys so a user
   * who role-switches doesn't lose half-typed data on the previous form.
   */
  profile: PendingProfile;
  /**
   * PIN prepared for transmission (currently the digits as-typed; if
   * client-side hashing lands, the hash). Cleared on signup success.
   */
  preparedPin?: string;
  /** Face / Touch / PIN-only choice. */
  securityChoice?: SecurityChoice;
  /**
   * Last route the user reached in the signup tail. Bootstrap reads
   * this to resume mid-flow on cold launch.
   */
  lastStep?: string;
  /** When the signup session started — used to expire stale drafts. */
  startedAt?: number;
  /** Hydration flag mirrors the customer order store pattern. */
  hasHydrated: boolean;

  // ── Actions ──
  setPhone: (phone: string) => void;
  setPhoneVerified: () => void;
  setVerificationToken: (token: string, ttlSeconds: number) => void;
  setRole: (role: PendingRole) => void;
  patchProfile: <R extends PendingRole>(
    role: R,
    patch: R extends "customer"
      ? Partial<PendingCustomerProfile>
      : R extends "rider"
      ? Partial<PendingRiderProfile>
      : Partial<PendingVendorProfile>
  ) => void;
  setPreparedPin: (pin: string | undefined) => void;
  setSecurityChoice: (c: SecurityChoice) => void;
  setLastStep: (path: string) => void;

  /** Clear everything — called on signup success or Start-over. */
  reset: () => void;

  /**
   * True iff the verificationToken exists AND hasn't expired. Drives
   * the resume vs restart decision in the bootstrap router.
   */
  isVerificationValid: () => boolean;
}

const emptyState: Pick<
  PendingSignupState,
  "profile" | "phone" | "phoneVerifiedAt" | "verificationToken" |
  "verificationTokenExpiresAt" | "role" | "preparedPin" | "securityChoice" |
  "lastStep" | "startedAt"
> = {
  phone: undefined,
  phoneVerifiedAt: undefined,
  verificationToken: undefined,
  verificationTokenExpiresAt: undefined,
  role: undefined,
  profile: {},
  preparedPin: undefined,
  securityChoice: undefined,
  lastStep: undefined,
  startedAt: undefined,
};

export const usePendingSignupStore = create<PendingSignupState>()(
  persist(
    (set, get) => ({
      ...emptyState,
      hasHydrated: false,

      setPhone: (phone) =>
        set((s) => ({
          phone,
          startedAt: s.startedAt ?? Date.now(),
        })),

      setPhoneVerified: () => set({ phoneVerifiedAt: Date.now() }),

      setVerificationToken: (token, ttlSeconds) =>
        set({
          verificationToken: token,
          verificationTokenExpiresAt: Date.now() + ttlSeconds * 1000,
        }),

      setRole: (role) => set({ role }),

      patchProfile: (role, patch) =>
        set((s) => ({
          profile: {
            ...s.profile,
            [role]: { ...(s.profile[role] ?? {}), ...patch },
          },
        })),

      setPreparedPin: (pin) => set({ preparedPin: pin }),

      setSecurityChoice: (c) => set({ securityChoice: c }),

      setLastStep: (path) => set({ lastStep: path }),

      reset: () => set({ ...emptyState }),

      isVerificationValid: () => {
        const { verificationToken, verificationTokenExpiresAt } = get();
        if (!verificationToken || !verificationTokenExpiresAt) return false;
        return Date.now() < verificationTokenExpiresAt;
      },
    }),
    {
      name: "pending-signup-store",
      // AsyncStorage on Android, not SecureStore. expo-secure-store
      // writes were causing the JS surface to tear down post-OTP on
      // some Android builds — the encryption-backed keystore can throw
      // an unhandled rejection that crashes the React surface. Pending
      // signup data is non-sensitive (no PIN, no auth tokens at rest);
      // AsyncStorage is plenty for resume-after-kill semantics.
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        state && (state.hasHydrated = true);
      },
      // SECURITY A2 / EDGE P1-3 — strip `preparedPin` from the
      // persisted blob. The PIN must never sit in AsyncStorage at
      // rest; it's held in memory only between pin-create and
      // signup-submit. If the user kills the app mid-signup they
      // re-enter the PIN. Also strip the runtime-only `hasHydrated`.
      partialize: (state) => {
        const { hasHydrated, preparedPin, ...rest } = state;
        return rest as PendingSignupState;
      },
    }
  )
);
