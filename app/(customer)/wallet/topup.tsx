import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { usePaystack } from "react-native-paystack-webview";
import { Theme, useTheme, formatCurrency } from "@/constants/theme";
import { api } from "@/lib/api";
import { useSessionStore } from "@/store/useSessionStore";
import { useWalletStore } from "@/store/useWalletStore";
import { setPaystackPublicKey } from "@/lib/paystackKey";
import { newIdempotencyKey } from "@/lib/idempotency";
import {
  FloatingCTA,
  ScreenContainer,
} from "@/components/ui/primitives";
import CountUpNumber from "@/components/ui/global/CountUpNumber";

const PRESETS = [1000, 2500, 5000, 10000, 20000, 50000];
const MIN_TOPUP = 100;
const MAX_TOPUP = 500_000;

interface InitializeResponse {
  authorizationUrl: string;
  reference: string;
  publicKey?: string;
}

/**
 * Wallet top-up — v3.
 *
 * Layout:
 *   - Modal-style header (close button on left, title centered).
 *   - Big centered amount with ₦ prefix at 30px and a pulsing caret.
 *   - "Quick amounts" 3-col preset grid; selected preset gets primary
 *     tint background + primary border.
 *   - Trust strip card: shield icon + "Powered by Paystack · Your card
 *     stays with them, never us."
 *   - FloatingCTA: "Top up ₦X" / "Enter at least ₦100" disabled when
 *     below the min.
 *
 * Query params:
 *   - prefill: starting amount (used when Payment computes the
 *     wallet shortfall and routes here pre-filled).
 *   - returnTo: 'payment' tells the success handler to pop back to the
 *     payment screen with `?select=wallet` so it auto-selects wallet
 *     and skips the methods picker.
 */
export default function WalletTopUp() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const { prefill, returnTo } = useLocalSearchParams<{
    prefill?: string;
    returnTo?: string;
  }>();

  const userEmail = useSessionStore((s) => s.user?.email);
  const refreshWallet = useWalletStore((s) => s.refresh);
  const { popup } = usePaystack();

  const [amountText, setAmountText] = useState(() => {
    const initial = parseInt(prefill ?? "", 10);
    return Number.isFinite(initial) && initial > 0 ? String(initial) : "";
  });
  const [submitting, setSubmitting] = useState(false);
  // Tracks whether the most recent value change came from a preset tap
  // (vs. the keyboard). Preset taps tween over a longer window for the
  // satisfying count-up; typing animates over a shorter window so it
  // feels responsive rather than laggy.
  const [animDuration, setAnimDuration] = useState(180);

  const amount = Math.max(0, parseInt(amountText, 10) || 0);
  const aboveMin = amount >= MIN_TOPUP;
  const aboveMax = amount > MAX_TOPUP;
  const valid = aboveMin && !aboveMax;

  // Hidden TextInput captures the system keyboard. The visible amount
  // is rendered via CountUpNumber so preset taps tween smoothly. Tapping
  // the visible amount focuses the hidden input.
  const hiddenInputRef = useRef<TextInput>(null);
  const focusKeyboard = useCallback(() => {
    hiddenInputRef.current?.focus();
  }, []);

  // Auto-focus on first mount so the keyboard pops up immediately —
  // matches the legacy autoFocus behaviour. Skipped when prefilled
  // (the user is reviewing a top-up amount, not entering one).
  useEffect(() => {
    if (!prefill) {
      const t = setTimeout(focusKeyboard, 200);
      return () => clearTimeout(t);
    }
  }, [prefill, focusKeyboard]);

  const onPreset = useCallback((value: number) => {
    setAnimDuration(700);
    setAmountText(String(value));
    Keyboard.dismiss();
  }, []);

  const onTypeDigits = useCallback((v: string) => {
    setAnimDuration(160);
    setAmountText(v.replace(/[^0-9]/g, "").slice(0, 7));
  }, []);

  const handleTopUp = useCallback(async () => {
    if (!userEmail) {
      Alert.alert("Email required", "We need your email to start the top-up.");
      return;
    }
    if (!valid) return;

    setSubmitting(true);
    try {
      const init = await api.post<InitializeResponse>(
        "/api/payments/topup/initialize",
        { amount },
        { headers: { "Idempotency-Key": newIdempotencyKey() } as any }
      );
      setPaystackPublicKey(init.publicKey);

      popup.checkout({
        email: userEmail,
        amount,
        reference: init.reference,
        metadata: { kind: "wallet_topup", amountNgn: amount },
        onSuccess: async () => {
          try {
            await api.post(
              "/api/payments/topup/verify",
              { reference: init.reference },
              { headers: { "Idempotency-Key": newIdempotencyKey() } as any }
            );
          } catch {
            // Webhook will catch it; just refresh.
          }
          await refreshWallet();
          if (returnTo === "payment") {
            // Hand back to the order Payment step with wallet pre-selected.
            router.replace({
              pathname: "/(customer)/(order)/payment" as never,
              params: { select: "wallet" },
            } as never);
          } else {
            Alert.alert(
              "Top-up successful",
              `${formatCurrency(amount)} credited to your wallet.`
            );
            router.back();
          }
        },
        onCancel: () => {
          // user closed without completing — nothing to clean up server-side.
        },
        onError: (err: unknown) => {
          Alert.alert(
            "Top-up failed",
            String((err as any)?.message ?? "Please try again.")
          );
        },
      });
    } catch (err: any) {
      Alert.alert(
        "Couldn't start top-up",
        err?.message ?? "Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }, [amount, valid, userEmail, popup, refreshWallet, router, returnTo]);

  const helperText = !amount
    ? "Min ₦100 · max ₦500,000 per top-up"
    : aboveMax
    ? `Above maximum — top up at most ${formatCurrency(MAX_TOPUP)}`
    : !aboveMin
    ? "Below minimum — top up at least ₦100"
    : "Min ₦100 · max ₦500,000 per top-up";

  return (
    <ScreenContainer
      edges={["top", "bottom"]}
      header={
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={({ pressed }) => [
              styles.closeBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons name="close" size={18} color={theme.fg} />
          </Pressable>
          <Text style={styles.headerTitle}>Top up wallet</Text>
          <View style={styles.headerSpacer} />
        </View>
      }
      footer={
        <FloatingCTA
          label={
            valid
              ? `Top up ${formatCurrency(amount)}`
              : "Enter at least ₦100"
          }
          subtitle={valid ? "Card · transfer · USSD" : undefined}
          disabled={!valid}
          loading={submitting}
          onPress={handleTopUp}
          floating={false}
        />
      }
    >
      <View style={styles.body}>
        {/* Big amount — rendered as an animated CountUpNumber so preset
            taps tween smoothly. A hidden TextInput sits behind the
            visible amount to capture keyboard input; tapping the
            visible amount focuses it. */}
        <Pressable
          onPress={focusKeyboard}
          accessibilityRole="adjustable"
          accessibilityLabel="Top-up amount"
          accessibilityHint="Tap to edit. Or pick a quick amount below."
          style={styles.amountWrap}
        >
          <Text style={styles.amountEyebrow}>YOU'RE ADDING</Text>
          <View style={styles.amountRow}>
            <Text style={[styles.amountCurrency, !valid && styles.amountMuted]}>
              ₦
            </Text>
            {amount > 0 ? (
              <CountUpNumber
                value={amount}
                durationMs={animDuration}
                format={(n) => n.toLocaleString("en-NG")}
                style={[styles.amountInput, !valid && styles.amountMuted]}
                accessibilityLabel={`${amount.toLocaleString("en-NG")} naira`}
              />
            ) : (
              <Text
                style={[
                  styles.amountInput,
                  styles.amountMuted,
                ]}
              >
                0
              </Text>
            )}
          </View>
          <Text
            style={[
              styles.amountHelper,
              !valid && amount > 0 && { color: theme.error, fontWeight: "700" },
            ]}
          >
            {helperText}
          </Text>

          {/* Hidden input — system keyboard popups but no on-screen
              text rendering. Width is 1px (not 0) so iOS keeps it
              focusable; the parent absoluteFill keeps it tap-through
              to the wrap above. */}
          <TextInput
            ref={hiddenInputRef}
            value={amountText}
            onChangeText={onTypeDigits}
            keyboardType="number-pad"
            maxLength={7}
            caretHidden
            selectTextOnFocus
            style={styles.hiddenInput}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        </Pressable>

        {/* Quick amount presets */}
        <Text style={styles.sectionLabel}>QUICK AMOUNTS</Text>
        <View style={styles.presetGrid}>
          {PRESETS.map((p) => {
            const isSel = p === amount;
            return (
              <Pressable
                key={p}
                onPress={() => onPreset(p)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSel }}
                accessibilityLabel={`${formatCurrency(p)} preset`}
                style={({ pressed }) => [
                  styles.preset,
                  isSel && styles.presetSelected,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text
                  style={[
                    styles.presetText,
                    isSel && styles.presetTextSelected,
                  ]}
                >
                  {formatCurrency(p)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Trust strip */}
        <View style={styles.trust}>
          <View style={styles.trustIconWrap}>
            <Ionicons
              name="shield-checkmark"
              size={16}
              color={
                theme.mode === "dark" ? "#fff" : theme.palette.green700
              }
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.trustTitle}>Powered by Paystack</Text>
            <Text style={styles.trustBody}>
              Your card stays with them, never us.
            </Text>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    /* Modal-style header */
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.space.s4,
      paddingTop: 8,
      paddingBottom: 12,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: theme.bgMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      fontSize: 14,
      fontWeight: "800",
      color: theme.fg,
    },
    headerSpacer: { width: 36 },

    body: {
      paddingHorizontal: theme.space.s4,
      flex: 1,
    },

    /* Big amount */
    amountWrap: {
      alignItems: "center",
      paddingTop: 32,
      paddingBottom: 24,
      position: "relative",
    },
    amountEyebrow: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.fgMuted,
      letterSpacing: 0.6,
      marginBottom: 10,
    },
    amountRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 4,
    },
    amountCurrency: {
      fontSize: 30,
      fontWeight: "800",
      color: theme.fg,
      opacity: 0.5,
      paddingBottom: 6,
      ...theme.type.money,
    },
    amountInput: {
      fontSize: 56,
      fontWeight: "800",
      color: theme.fg,
      letterSpacing: -1.2,
      padding: 0,
      minWidth: 80,
      textAlign: "center",
      ...theme.type.money,
    },
    amountMuted: {
      color: theme.fgMuted,
    },
    /**
     * Off-screen but focusable. opacity:0 + width:1 so iOS still mounts
     * a real TextInput (zero-width inputs sometimes aren't focusable);
     * positioning bottom-right keeps it from intercepting taps on the
     * visible amount above it.
     */
    hiddenInput: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: 1,
      height: 1,
      opacity: 0,
    },
    amountHelper: {
      fontSize: 12,
      color: theme.fgMuted,
      marginTop: 8,
      fontWeight: "500",
    },

    /* Section label */
    sectionLabel: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.fgMuted,
      letterSpacing: 0.5,
      marginBottom: 10,
    },

    /* Preset grid */
    presetGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 24,
    },
    preset: {
      width: "31.5%", // 3 columns with 8px gaps
      height: 44,
      borderRadius: 12,
      backgroundColor: theme.bgMuted,
      borderWidth: 1.5,
      borderColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
    },
    presetSelected: {
      backgroundColor: theme.primaryTint,
      borderColor: theme.primary,
    },
    presetText: {
      fontSize: 13,
      fontWeight: "800",
      color: theme.fg,
      ...theme.type.money,
    },
    presetTextSelected: {
      color: theme.mode === "dark" ? "#fff" : theme.palette.green700,
    },

    /* Trust strip */
    trust: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: theme.bgMuted,
      borderRadius: 14,
      padding: 14,
    },
    trustIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    trustTitle: {
      fontSize: 12.5,
      fontWeight: "700",
      color: theme.fg,
    },
    trustBody: {
      fontSize: 11,
      color: theme.fgMuted,
      marginTop: 2,
      lineHeight: 16,
    },
  });
