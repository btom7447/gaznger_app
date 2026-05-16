import React, { useCallback } from "react";
import { useRouter } from "expo-router";
import RoleWelcomeCarousel, {
  type RoleWelcomeSlide,
} from "@/components/ui/auth/RoleWelcomeCarousel";

const SLIDES: RoleWelcomeSlide[] = [
  {
    illustration: "rider-1",
    title: "Pick the orders that suit you",
    sub: "Smart matches near your route, fewer empty miles.",
  },
  {
    illustration: "rider-2",
    title: "Earnings hit instantly",
    sub: "Daily payouts straight to your bank, no waiting.",
  },
  {
    illustration: "rider-3",
    title: "Affiliated or freelance",
    sub: "Join a vendor, or ride solo — your call.",
  },
];

/**
 * Rider-tailored welcome carousel. Reached from the role picker.
 * 3 pitch slides + CTA slide → phone (signup, role=rider).
 */
export default function RiderWelcomeScreen() {
  const router = useRouter();

  const onCta = useCallback(() => {
    router.push({
      pathname: "/(auth)/phone" as never,
      params: { mode: "signup", role: "rider" },
    } as never);
  }, [router]);

  const onBack = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <RoleWelcomeCarousel
      eyebrow="For riders"
      slides={SLIDES}
      ctaTitle="Ready to ride?"
      ctaSub="Set up takes about 3 minutes. We'll verify your ID and bike papers — usually within a day."
      ctaLabel="Get started"
      onCta={onCta}
      onBack={onBack}
    />
  );
}
