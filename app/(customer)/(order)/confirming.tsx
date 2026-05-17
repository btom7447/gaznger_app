import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Theme, useTheme } from "@/constants/theme";
import { Button, ScreenContainer } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { newIdempotencyKey } from "@/lib/idempotency";
import { devLog } from "@/lib/log";

/**
 * EDGE P0-3 / LOGIC P0-4 — payment-verify recovery screen.
 *
 * Reached when Paystack's onSuccess fires (card is charged) but our
 * `/api/payments/verify` call throws — historically a hard dead-end:
 * the user saw an Alert "we couldn't verify" with no retry path,
 * card was charged, no recourse.
 *
 * This screen polls verify with the SAME reference (so server dedup
 * caches the eventual success). We retry on a 3/5/8/10s backoff up
 * to ~30s. On success → receipt. On exhaustion → support CTA.
 *
 * The Idempotency-Key is stable across retries for the same
 * reference so the server's `withIdempotency` cache returns the
 * recorded response, not a fresh attempt.
 */
type Status = "verifying" | "verified" | "failed";

const RETRY_DELAYS_MS = [3000, 5000, 8000, 10000];

export default function ConfirmingPaymentScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string; reference?: string }>();
  const styles = makeStyles(theme);
  const orderId = params.orderId ?? "";
  const reference = params.reference ?? "";

  const [status, setStatus] = useState<Status>("verifying");
  const [attempt, setAttempt] = useState(0);
  const idemKeyRef = useRef<string>(newIdempotencyKey());
  const cancelledRef = useRef(false);

  const verify = useCallback(async () => {
    if (cancelledRef.current) return;
    try {
      await api.post(
        "/api/payments/verify",
        { reference },
        { headers: { "Idempotency-Key": idemKeyRef.current } as any },
      );
      if (cancelledRef.current) return;
      setStatus("verified");
      // Brief pause so the success state is visible, then route.
      setTimeout(() => {
        if (cancelledRef.current) return;
        router.replace("/(customer)/(order)/receipt" as never);
      }, 800);
    } catch (err: any) {
      if (cancelledRef.current) return;
      devLog("[confirming] verify attempt failed:", err?.message ?? err);
      setAttempt((a) => a + 1);
    }
  }, [reference, router]);

  useEffect(() => {
    cancelledRef.current = false;
    verify();
    return () => {
      cancelledRef.current = true;
    };
  }, [verify]);

  useEffect(() => {
    if (status !== "verifying") return;
    if (attempt === 0) return;
    if (attempt > RETRY_DELAYS_MS.length) {
      setStatus("failed");
      return;
    }
    const delay = RETRY_DELAYS_MS[attempt - 1];
    const id = setTimeout(verify, delay);
    return () => clearTimeout(id);
  }, [attempt, status, verify]);

  const handleManualRetry = useCallback(() => {
    setStatus("verifying");
    setAttempt(0);
    verify();
  }, [verify]);

  const handleContactSupport = useCallback(() => {
    router.replace({
      pathname: "/(screens)/help-support" as never,
      params: { context: "payment-verify-failed", orderId, reference },
    } as never);
  }, [router, orderId, reference]);

  return (
    <ScreenContainer>
      <View style={styles.body}>
        {status === "verifying" ? (
          <>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.headline}>Confirming your payment…</Text>
            <Text style={styles.sub}>
              Your card was charged. We're confirming with the bank — this
              usually takes a few seconds. Don't close the app.
            </Text>
            {attempt > 0 ? (
              <Text style={styles.attemptText}>
                Retry {attempt} of {RETRY_DELAYS_MS.length}
              </Text>
            ) : null}
          </>
        ) : status === "verified" ? (
          <>
            <Ionicons
              name="checkmark-circle"
              size={56}
              color={theme.success}
            />
            <Text style={styles.headline}>Payment confirmed</Text>
            <Text style={styles.sub}>Loading your receipt…</Text>
          </>
        ) : (
          <>
            <Ionicons name="alert-circle" size={56} color={theme.warning} />
            <Text style={styles.headline}>Still confirming…</Text>
            <Text style={styles.sub}>
              We couldn't confirm your payment automatically. Your card was
              charged — if this stays stuck, our support team can sort it.
              Reference: {reference || "(missing)"}
            </Text>
            <View style={styles.ctaRow}>
              <Button
                variant="primary"
                size="lg"
                full
                onPress={handleManualRetry}
                accessibilityLabel="Try confirming again"
              >
                Try again
              </Button>
              <Button
                variant="secondary"
                size="lg"
                full
                onPress={handleContactSupport}
                accessibilityLabel="Contact support"
              >
                Contact support
              </Button>
            </View>
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    body: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
      gap: 16,
    },
    headline: {
      fontSize: 22,
      fontWeight: "800",
      color: theme.fg,
      textAlign: "center",
      marginTop: 8,
    },
    sub: {
      fontSize: 14,
      lineHeight: 22,
      color: theme.fgMuted,
      textAlign: "center",
    },
    attemptText: {
      fontSize: 12,
      color: theme.fgMuted,
      fontWeight: "700",
      marginTop: 4,
    },
    ctaRow: {
      width: "100%",
      gap: 10,
      marginTop: 12,
    },
  });
