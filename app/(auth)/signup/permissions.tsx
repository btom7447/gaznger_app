import React, { useCallback, useMemo, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { toast } from "sonner-native";
import { Theme, useTheme } from "@/constants/theme";
import { AuthScreenContainer, PermissionRow } from "@/components/ui/auth";
import { Button } from "@/components/ui/primitives";
import {
  requestBackgroundLocation,
  requestCamera,
  requestLocation,
  requestNotifications,
} from "@/lib/permissions";
import { api } from "@/lib/api";
import { newIdempotencyKey } from "@/lib/idempotency";
import { getDeviceLabel, getOrCreateDeviceId } from "@/lib/auth";
import { usePendingSignupStore } from "@/store/usePendingSignupStore";
import { useSessionStore, type SessionUser } from "@/store/useSessionStore";

interface Item {
  icon: "location" | "notifications" | "camera" | "phone-portrait";
  label: string;
  sub: string;
  required: boolean;
}

const PERMS: Record<"customer" | "rider" | "vendor", Item[]> = {
  customer: [
    {
      icon: "location",
      label: "Location",
      sub: "Find nearby stations and track your delivery.",
      required: true,
    },
    {
      icon: "notifications",
      label: "Notifications",
      sub: "Delivery updates, price alerts, receipts.",
      required: true,
    },
    {
      icon: "camera",
      label: "Camera",
      sub: "LPG cylinder photo verification.",
      required: false,
    },
  ],
  rider: [
    {
      icon: "location",
      label: "Location (always)",
      sub: "Required so customers can track your route live.",
      required: true,
    },
    {
      icon: "notifications",
      label: "Notifications",
      sub: "New delivery requests, status updates.",
      required: true,
    },
    {
      icon: "camera",
      label: "Camera",
      sub: "Delivery confirmation photos.",
      required: true,
    },
    {
      icon: "phone-portrait",
      label: "Background app refresh",
      sub: "Keeps your status live while riding.",
      required: true,
    },
  ],
  vendor: [
    {
      icon: "notifications",
      label: "Notifications",
      sub: "Incoming orders and rider arrivals.",
      required: true,
    },
    {
      icon: "camera",
      label: "Camera",
      sub: "Upload station photos and documents.",
      required: true,
    },
    {
      icon: "location",
      label: "Location",
      sub: "Confirm station coordinates.",
      required: false,
    },
  ],
};

interface SignupResponse {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
}

/**
 * Permissions priming + final signup commit. Layout is read-only (no
 * toggles) per the design — the actual OS prompts fire when the user
 * taps "Allow and continue". For riders we run a two-step location
 * grant: foreground first, then background with disclosure.
 *
 * After every permission resolves (granted OR denied — denials are
 * non-blocking and the user can change their mind in Settings later),
 * we fire `/auth/signup` with everything `usePendingSignupStore` has
 * accumulated, log the user in via `useSessionStore.login()`, clear
 * the pending draft, and route to welcome-done.
 *
 * If signup fails, the screen stays mounted with the error toast and
 * the user can retry — no data is lost from the pending store.
 */
export default function PermissionsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const role = usePendingSignupStore((s) => s.role) ?? "customer";
  const items = PERMS[role];

  const verificationToken = usePendingSignupStore((s) => s.verificationToken);
  const profile = usePendingSignupStore((s) => s.profile);
  const preparedPin = usePendingSignupStore((s) => s.preparedPin);
  const securityChoice = usePendingSignupStore((s) => s.securityChoice);
  const reset = usePendingSignupStore((s) => s.reset);

  const login = useSessionStore((s) => s.login);

  const [submitting, setSubmitting] = useState(false);

  const runPermissions = useCallback(async () => {
    // Fire prompts in a fixed order so the OS dialogs don't pile up
    // unpredictably. Notifications first (one prompt, fast), then
    // location, then camera. Rider gets background location after
    // foreground is granted.
    //
    // Each call is wrapped so a single OS-level failure (missing plist
    // key on an old build, unsupported device, etc.) never blocks the
    // signup commit that follows. Users can grant from Settings later.
    const wantsLocation = items.some((i) => i.icon === "location");
    const wantsNotifications = items.some((i) => i.icon === "notifications");
    const wantsCamera = items.some((i) => i.icon === "camera");

    const safe = async <T,>(label: string, fn: () => Promise<T>): Promise<T | null> => {
      try {
        return await fn();
      } catch (err) {
        console.warn(`[permissions] ${label} failed:`, err);
        return null;
      }
    };

    if (wantsNotifications) await safe("notifications", requestNotifications);
    if (wantsLocation) {
      const fg = await safe("location", requestLocation);
      if (role === "rider" && fg === "granted") {
        const bg = await safe("background-location", requestBackgroundLocation);
        if (bg !== "granted") {
          toast.info("Background location off", {
            description:
              "You can still ride, but customers won't see live tracking. Update in Settings later.",
          });
        }
      }
    }
    if (wantsCamera) await safe("camera", requestCamera);
  }, [items, role]);

  const handleContinue = useCallback(async () => {
    if (submitting) return;
    if (!verificationToken || !preparedPin || !role) {
      toast.error("Couldn't continue", {
        description: "Verification expired. Restart from your phone number.",
      });
      router.replace("/(auth)/welcome" as never);
      return;
    }
    setSubmitting(true);
    try {
      // 1. Run OS permission prompts in order. Failures are non-blocking
      //    so users can decide later in Settings.
      await runPermissions();

      // 2. Commit the signup. Idempotency-Key protects against double-
      //    POSTs if the user backgrounds the app mid-request.
      const deviceId = await getOrCreateDeviceId();
      const res = await api.post<SignupResponse>(
        "/auth/signup",
        {
          verificationToken,
          role,
          pin: preparedPin,
          biometricPreference: securityChoice ?? "pin",
          // v7 unified wizard creates a lean user — profile fields are
          // filled in by the onboarding screens after signup. Legacy
          // signup paths still pass the per-role profile when present.
          profile: profile?.[role] ?? {},
        },
        {
          headers: {
            "X-Device-Id": deviceId,
            "X-Device-Label": getDeviceLabel(),
            "Idempotency-Key": newIdempotencyKey(),
          },
        }
      );

      // 3. Persist session, clear the signup draft.
      login({
        user: res.user,
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
      });
      reset();

      // 4. Route into the v7 onboarding wizard for the chosen role.
      //    Customer = single-page details (name/email/address); vendor
      //    and rider get a 3-step wizard. After onboarding finishes
      //    the user lands either on the role home (customer) or the
      //    pending-verification screen (vendor/rider).
      if (role === "customer") {
        router.replace(
          "/(auth)/onboarding/customer/details" as never,
        );
      } else if (role === "vendor") {
        router.replace(
          "/(auth)/onboarding/vendor/wizard" as never,
        );
      } else {
        router.replace(
          "/(auth)/onboarding/rider/wizard" as never,
        );
      }
    } catch (err: any) {
      toast.error("Couldn't finish signup", {
        description: err?.message ?? "Try again in a moment.",
      });
      setSubmitting(false);
    }
  }, [
    submitting,
    verificationToken,
    preparedPin,
    role,
    runPermissions,
    profile,
    securityChoice,
    login,
    reset,
    router,
  ]);

  return (
    <AuthScreenContainer
      contentStyle={{ paddingTop: theme.space.s4, gap: theme.space.s3 }}
      footer={
        <Button
          variant="primary"
          size="lg"
          full
          onPress={handleContinue}
          loading={submitting}
          disabled={submitting}
          accessibilityLabel="Allow permissions and finish signup"
        >
          {submitting ? "Setting up your account…" : "Allow and continue"}
        </Button>
      }
    >
      <View style={styles.headerWrap}>
        <Text style={styles.title}>Allow access</Text>
        <Text style={styles.sub}>Gaznger needs these to work properly.</Text>
      </View>

      <View style={styles.list}>
        {items.map((p) => (
          <PermissionRow
            key={p.label}
            icon={p.icon}
            label={p.label}
            sub={p.sub}
            required={p.required}
          />
        ))}
      </View>

      <Text style={styles.footer}>
        You can change these in Settings at any time.
        {role === "rider" && Platform.OS === "android"
          ? ' Background location may require switching to "Always" in Settings.'
          : ""}
      </Text>

    </AuthScreenContainer>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    headerWrap: {
      gap: theme.space.s2,
    },
    title: {
      fontSize: 26,
      lineHeight: 30,
      fontWeight: "800",
      letterSpacing: -0.6,
      color: theme.fg,
    },
    sub: {
      ...theme.type.body,
      color: theme.fgMuted,
    },
    list: {
      gap: theme.space.s2 + 2,
    },
    footer: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      lineHeight: 19,
      marginTop: theme.space.s2,
    },
  });
