import React from "react";
import KYCScreen, { type KYCDoc } from "@/components/ui/auth/KYCScreen";

const VENDOR_DOCS: KYCDoc[] = [
  {
    id: "owner-id-front",
    label: "Owner ID — front",
    sub: "NIN or driver's licence",
    hint: "Photo of the front",
  },
  {
    id: "owner-id-back",
    label: "Owner ID — back",
    sub: "Same document as above",
    hint: "Photo of the back",
  },
  {
    id: "nmdpra",
    label: "NMDPRA certificate",
    sub: "Required for fuel retail",
    hint: "PDF or clear photo",
  },
  {
    id: "cac",
    label: "CAC / business registration",
    sub: "Form CO2 or CO7",
    hint: "PDF or clear photo",
  },
];

/**
 * Vendor KYC — 4 document slots. Reached from the pending screen's
 * "Complete verification" CTA. Submits to /auth/verification/submit
 * with kind = doc.id.
 */
export default function VerificationVendorScreen() {
  return <KYCScreen role="vendor" docs={VENDOR_DOCS} />;
}
