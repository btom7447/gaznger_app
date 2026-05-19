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

/**
 * EDGE P3-2 — NFC normalise + strip zero-width / control chars from
 * every string field in a profile patch. Run at the boundary
 * (setter) instead of N times at consumers.
 *
 * Strips:
 *   - U+200B..U+200D ZWSP / ZWNJ / ZWJ
 *   - U+FEFF BOM
 *   - C0 / C1 control chars (0x00-0x1F, 0x7F-0x9F)
 *
 * Doesn't trim — leading/trailing whitespace is meaningful for some
 * fields (multi-name "Mary Jane "), and consumers already `.trim()`
 * before submit.
 */
function sanitiseStringFields<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") {
      out[k] = v
        .normalize("NFC")
        // Strip zero-widths
        .replace(/[​-‍﻿]/g, "")
        // Strip C0/C1 control chars (keep \n \t \r in case any field
        // legitimately needs them — none do today, but cheap insurance)
        .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, "");
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

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
            // EDGE P3-2 — NFC normalize string fields + strip
            // zero-width + control chars before persisting. Catches
            // paste-bombs from iOS Notes, malicious clipboard
            // injections, and accidental ZWJ that bounces from
            // server-side validators that don't NFC-normalize first.
            [role]: {
              ...(s.profile[role] ?? {}),
              ...sanitiseStringFields(patch),
            },
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
        if (!state) return;
        state.hasHydrated = true;
        // EDGE P1-4 — 24h TTL on pending signup drafts. If the user
        // abandoned signup more than a day ago, drop the stale state
        // so they don't resume from a half-completed flow whose
        // verification token expired hours ago. Defer reset() to
        // after rehydration since we can't call set() during the
        // callback.
        const TTL_MS = 24 * 60 * 60 * 1000;
        if (state.startedAt && Date.now() - state.startedAt > TTL_MS) {
          setTimeout(() => {
            usePendingSignupStore.getState().reset();
          }, 0);
        }
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
