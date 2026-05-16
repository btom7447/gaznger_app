import type { SessionUser } from "@/store/useSessionStore";

/**
 * Post-auth routing helpers — shared between the bootstrap (app/index.tsx)
 * and the PIN/biometric unlock screens. Single source of truth for
 * "where does this user belong right now?" so all entry points behave
 * identically.
 */

/**
 * True when the user is signed in but their role-specific onboarding
 * wizard hasn't finished yet (force-quit between PIN-set and the
 * wizard's Finish, etc.). Heuristics:
 *
 *   customer → no defaultAddress yet OR displayName is the "Guest" stub
 *   vendor   → no vendorBusinessName yet (Step 1 of wizard sets it)
 *   rider    → user.isOnboarded === false (rider /setup flips it)
 */
export function needsOnboarding(user: SessionUser): boolean {
  if (user.role === "customer") {
    const noAddress = !user.defaultAddress;
    const stubName =
      !user.displayName ||
      user.displayName === "Guest" ||
      user.displayName === "Customer";
    return noAddress || stubName;
  }
  if (user.role === "vendor") {
    return !user.vendorBusinessName;
  }
  if (user.role === "rider") {
    return !user.isOnboarded;
  }
  return false;
}

export function onboardingPathFor(role: SessionUser["role"]): string {
  if (role === "vendor") return "/(auth)/onboarding/vendor/wizard";
  if (role === "rider") return "/(auth)/onboarding/rider/wizard";
  return "/(auth)/onboarding/customer/details";
}

/**
 * Compute the right landing route for a signed-in user. Order:
 *   1. Suspended → suspended state screen
 *   2. Onboarding incomplete → wizard
 *   3. Vendor/rider not yet verified → pending screen
 *   4. Verified → role home
 */
export function postAuthPathFor(user: SessionUser): string {
  if (user.accountStatus === "suspended") {
    return "/(auth)/states/suspended";
  }
  if (needsOnboarding(user)) {
    return onboardingPathFor(user.role);
  }
  if (user.role === "rider") {
    return user.verificationStatus === "approved"
      ? "/(rider)/(queue)"
      : "/(auth)/verification/pending?role=rider";
  }
  if (user.role === "vendor") {
    return user.verificationStatus === "approved"
      ? "/(vendor)/(today)"
      : "/(auth)/verification/pending?role=vendor";
  }
  return "/(customer)/(home)";
}
