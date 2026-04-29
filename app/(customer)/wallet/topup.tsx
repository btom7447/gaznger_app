import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
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
  ScreenHeader,
} from "@/components/ui/primitives";

const PRESETS = [1000, 2500, 5000, 10000, 20000];
const MIN_TOPUP = 100;

interface InitializeResponse {
  authorizationUrl: string;
  reference: string;
  publicKey?: string;
}

export default function WalletTopUp() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const userEmail = useSessionStore((s) => s.user?.email);
  const refreshWallet = useWalletStore((s) => s.refresh);
  const { popup } = usePaystack();

  const [amountText, setAmountText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const amount = Math.max(0, parseInt(amountText, 10) || 0);
  const tooSmall = amount > 0 && amount < MIN_TOPUP;

  const onPreset = useCallback((value: number) => {
    setAmountText(String(value));
  }, []);

  const handleTopUp = useCallback(async () => {
    if (!userEmail) {
      Alert.alert("Email required", "We need your email to start the top-up.");
      return;
    }
    if (amount < MIN_TOPUP) return;

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
          Alert.alert("Top-up successful", `${formatCurrency(amount)} credited to your wallet.`);
          router.back();
        },
        onCancel: () => {
          // user closed without completing — nothing to clean up server-side.
        },
        onError: (err: unknown) => {
          Alert.alert("Top-up failed", String((err as any)?.message ?? "Please try again."));
        },
      });
    } catch (err: any) {
      Alert.alert("Couldn't start top-up", err?.message ?? "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [amount, userEmail, popup, refreshWallet, router]);

  return (
    <ScreenContainer
      edges={["top", "bottom"]}
      header={<ScreenHeader title="Top up wallet" onBack={() => router.back()} />}
      footer={
        <FloatingCTA
          label={amount > 0 ? `Top up ${formatCurrency(amount)}` : "Enter amount"}
          disabled={amount < MIN_TOPUP}
          loading={submitting}
          onPress={handleTopUp}
          floating={false}
        />
      }
    >
      <View style={styles.body}>
        <Text style={styles.lead}>
          Add funds to your Gaznger wallet. Pay later in one tap, or get refunds
          back into your balance.
        </Text>

        <View style={styles.amountWrap}>
          <Text style={styles.currencyMark}>₦</Text>
          <TextInput
            value={amountText}
            onChangeText={(v) => setAmountText(v.replace(/[^0-9]/g, ""))}
            placeholder="0"
            placeholderTextColor={theme.fgSubtle}
            keyboardType="number-pad"
            style={styles.amountInput}
            autoFocus
          />
        </View>
        {tooSmall ? (
          <Text style={styles.helper}>
            Minimum top-up is {formatCurrency(MIN_TOPUP)}.
          </Text>
        ) : (
          <Text style={[styles.helper, { color: theme.fgMuted }]}>
            Powered by Paystack — your card stays with them, never us.
          </Text>
        )}

        <Text style={styles.sectionLabel}>QUICK AMOUNTS</Text>
        <View style={styles.presetRow}>
          {PRESETS.map((p) => {
            const isSel = p === amount;
            return (
              <Pressable
                key={p}
                onPress={() => onPreset(p)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSel }}
                style={({ pressed }) => [
                  styles.preset,
                  isSel && styles.presetSelected,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text
                  style={[
                    styles.presetText,
                    { color: isSel ? "#fff" : theme.fg },
                  ]}
                >
                  {formatCurrency(p)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </ScreenContainer>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    body: {
      paddingHorizontal: theme.space.s4,
      paddingTop: theme.space.s2,
      gap: theme.space.s3,
    },
    lead: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    amountWrap: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 4,
      paddingVertical: theme.space.s4,
      borderBottomWidth: 1,
      borderColor: theme.border,
    },
    currencyMark: {
      ...theme.type.h2,
      color: theme.fgMuted,
      paddingBottom: 4,
    },
    amountInput: {
      flex: 1,
      ...theme.type.h1,
      color: theme.fg,
      fontSize: 40,
      fontWeight: "800",
      padding: 0,
    },
    helper: {
      ...theme.type.caption,
      color: theme.warning,
    },
    sectionLabel: {
      ...theme.type.micro,
      fontSize: 13,
      letterSpacing: 0.6,
      color: theme.fgMuted,
      marginTop: theme.space.s3,
    },
    presetRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.space.s2,
    },
    preset: {
      paddingHorizontal: theme.space.s3,
      paddingVertical: theme.space.s2 + 2,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      minWidth: 80,
      alignItems: "center",
    },
    presetSelected: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    presetText: {
      ...theme.type.caption,
      ...theme.type.money,
      fontWeight: "800",
    },
  });
