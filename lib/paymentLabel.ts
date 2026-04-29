import type { SessionUser } from "@/store/useSessionStore";

/**
 * Render the human-readable "Paid with" label given the order's
 * `paymentMethodId` and the user's saved card metadata.
 *
 * Method ids come from `PaymentMethodList.tsx`:
 *   - "card-saved" — Paystack saved-card path (last4 from lastPaystackAuth)
 *   - "card-new"   — fresh card via Paystack webview
 *   - "wallet"     — Gaznger wallet
 *   - "transfer"   — Bank transfer
 *
 * Anything else returns a generic fallback so the receipt never reads "—".
 */
export function paymentMethodLabel(
  paymentMethodId: string | undefined,
  user: Pick<SessionUser, "lastPaystackAuth"> | null | undefined
): string {
  if (!paymentMethodId) return "Card";

  if (paymentMethodId === "card-saved") {
    const last4 = user?.lastPaystackAuth?.last4;
    const brand = user?.lastPaystackAuth?.brand;
    if (last4) {
      const brandTag = brand
        ? brand.toLowerCase().includes("visa")
          ? "VISA"
          : brand.toLowerCase().includes("master")
          ? "MASTERCARD"
          : brand.toLowerCase().includes("verve")
          ? "VERVE"
          : brand.toUpperCase()
        : "CARD";
      return `${brandTag} •••• ${last4}`;
    }
    return "Saved card";
  }

  if (paymentMethodId === "card-new") return "Card";
  if (paymentMethodId === "wallet") return "Gaznger wallet";
  if (paymentMethodId === "transfer") return "Bank transfer";

  return "Card";
}
