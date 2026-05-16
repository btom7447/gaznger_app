import React from "react";
import KYCScreen, { type KYCDoc } from "@/components/ui/auth/KYCScreen";

const RIDER_DOCS: KYCDoc[] = [
  {
    id: "nin",
    label: "National ID",
    sub: "NIN slip or card",
    hint: "Photo of the front",
  },
  {
    id: "licence",
    label: "Driver's licence",
    sub: "Must not be expired",
    hint: "Photo of the front",
  },
  {
    id: "vehicle-papers",
    label: "Vehicle papers",
    sub: "Roadworthiness or insurance",
    hint: "PDF or clear photo",
  },
  {
    id: "vehicle-photo",
    label: "Vehicle photo",
    sub: "Full-side with plate visible",
    hint: "Bright daylight photo",
  },
  {
    id: "plate-photo",
    label: "Plate close-up",
    sub: "Confirms your plate number",
    hint: "Sharp close-up photo",
  },
];

/**
 * Rider KYC — 5 document slots. Reached from the pending screen's
 * "Complete verification" CTA. Submits to /auth/verification/submit
 * with kind = doc.id.
 */
export default function VerificationRiderScreen() {
  return <KYCScreen role="rider" docs={RIDER_DOCS} />;
}
