import React, { useCallback } from "react";
import { useRouter } from "expo-router";
import RoleWelcomeCarousel, {
  type RoleWelcomeSlide,
} from "@/components/ui/auth/RoleWelcomeCarousel";

const SLIDES: RoleWelcomeSlide[] = [
  {
    illustration: "vendor-1",
    title: "One screen, every station",
    sub: "Run pricing, fuels, and hours across all your stations.",
  },
  {
    illustration: "vendor-2",
    title: "Get paid daily, automatically",
    sub: "Settled balances hit your bank in under 60 seconds.",
  },
  {
    illustration: "vendor-3",
    title: "Grow your team in a tap",
    sub: "Invite riders, assign them to stations, pay them right.",
  },
];

/**
 * Vendor-tailored welcome carousel. Reached from the role picker.
 * 3 pitch slides + CTA slide → phone (signup, role=vendor).
 */
export default function VendorWelcomeScreen() {
  const router = useRouter();

  const onCta = useCallback(() => {
    router.push({
      pathname: "/(auth)/phone" as never,
      params: { mode: "signup", role: "vendor" },
    } as never);
  }, [router]);

  const onBack = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <RoleWelcomeCarousel
      eyebrow="For vendors"
      slides={SLIDES}
      ctaTitle="Ready to set up?"
      ctaSub="A 3-step setup gets your first station live. Verification follows automatically — usually 12–24 hours."
      ctaLabel="Get started"
      onCta={onCta}
      onBack={onBack}
    />
  );
}
