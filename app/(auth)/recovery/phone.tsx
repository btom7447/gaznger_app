import React, { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { toast } from "sonner-native";
import { Theme, useTheme } from "@/constants/theme";
import {
  AuthScreenContainer,
  TrustStrip,
} from "@/components/ui/auth";
import {
  Button,
  CountryPickerSheet,
  type Country,
  type CountryPickerSheetRef,
} from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { newIdempotencyKey } from "@/lib/idempotency";
import { useSessionStore } from "@/store/useSessionStore";
import { usePendingSignupStore } from "@/store/usePendingSignupStore";

const NIGERIA: Country = {
  code: "NG",
  name: "Nigeria",
  dialCode: "+234",
  flag: "🇳🇬",
};

/**
 * Forgot-PIN — step 1 of 3. Confirms the phone, fires
 * /auth/forgot-pin/start, hands off to the OTP screen with
 * purpose=recovery. Trust principle (per
 * _server-asks/auth-recovery.md): even if a session exists, recovery
 * forces a fresh phone+OTP handshake. We auto-fill the phone from the
 * session for convenience but the server still validates the OTP.
 */
export default function ForgotPinPhoneScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const sessionPhone = useSessionStore((s) => s.user?.phone);
  const setPhone = usePendingSignupStore((s) => s.setPhone);
  const sheetRef = useRef<CountryPickerSheetRef>(null);

  // Pre-fill from session phone if E.164 — split into dial + local.
  const initial = useMemo(() => {
    if (!sessionPhone || !sessionPhone.startsWith("+")) {
      return { country: NIGERIA, local: "" };
    }
    const dialMatch = sessionPhone.match(/^\+(\d{1,4})/);
    if (!dialMatch) return { country: NIGERIA, local: "" };
    const dial = `+${dialMatch[1]}`;
    return {
      country: dial === NIGERIA.dialCode ? NIGERIA : { ...NIGERIA, dialCode: dial, name: dial, flag: "🌐", code: "??" },
      local: sessionPhone.slice(dial.length),
    };
  }, [sessionPhone]);

  const [country, setCountry] = useState<Country>(initial.country);
  const [local, setLocal] = useState(initial.local);
  const [submitting, setSubmitting] = useState(false);

  const e164 = useMemo(() => {
    const stripped = local.replace(/^0+/, "");
    if (!stripped) return null;
    return `${country.dialCode}${stripped}`;
  }, [country.dialCode, local]);

  const valid = e164 ? /^\+\d{8,15}$/.test(e164) : false;

  /**
   * Smart-strip on input. Auto-fill / paste often delivers the dial
   * code prefix; after we strip "+" and non-digits we get e.g.
   * "2348012345678" which would compose to "+2342348..." (double
   * prefix). Detect + peel the leading dial-code digits, plus a
   * single leading 0 from local-format Nigerian numbers.
   */
  const handlePhoneChange = useCallback(
    (next: string) => {
      let digits = next.replace(/\D/g, "");
      const dialDigits = country.dialCode.replace(/^\+/, "");
      if (dialDigits && digits.startsWith(dialDigits)) {
        digits = digits.slice(dialDigits.length);
      }
      if (digits.startsWith("0") && !digits.startsWith("00")) {
        digits = digits.slice(1);
      }
      setLocal(digits);
    },
    [country.dialCode]
  );

  const handleContinue = useCallback(async () => {
    if (!valid || !e164 || submitting) return;
    setSubmitting(true);
    try {
      await api.post(
        "/auth/forgot-pin/start",
        { phone: e164 },
        { headers: { "Idempotency-Key": newIdempotencyKey() } }
      );
      setPhone(e164);
      router.push({
        pathname: "/(auth)/otp" as never,
        params: { phone: e164, purpose: "recovery" },
      });
    } catch (err: any) {
      toast.error("Couldn't send reset code", {
        description: err?.message ?? "Try again in a moment.",
      });
    } finally {
      setSubmitting(false);
    }
  }, [valid, e164, submitting, router, setPhone]);

  return (
    <AuthScreenContainer
      contentStyle={{ paddingTop: theme.space.s4, gap: theme.space.s4 }}
      footer={
        <Button
          variant="primary"
          size="lg"
          full
          onPress={handleContinue}
          disabled={!valid || submitting}
          loading={submitting}
          accessibilityLabel="Send reset code"
        >
          {submitting ? "Sending…" : "Send reset code"}
        </Button>
      }
    >
      <View style={styles.headerWrap}>
        <Text style={styles.title}>Reset PIN</Text>
        <Text style={styles.sub}>
          We'll send a code to your registered number.
        </Text>
      </View>

      <View>
        <Text style={styles.label}>YOUR NUMBER</Text>
        <View style={styles.field}>
          <Pressable
            onPress={() => sheetRef.current?.open()}
            accessibilityRole="button"
            accessibilityLabel={`Dial code ${country.dialCode}`}
            style={({ pressed }) => [
              styles.dialBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.flag}>{country.flag}</Text>
            <Text style={styles.dial}>{country.dialCode}</Text>
            <Ionicons name="chevron-down" size={14} color={theme.fgMuted} />
          </Pressable>
          <TextInput
            value={local}
            onChangeText={handlePhoneChange}
            keyboardType="phone-pad"
            placeholder="80 1234 5678"
            placeholderTextColor={theme.fgMuted}
            style={styles.input}
            autoComplete="tel"
            textContentType="telephoneNumber"
            maxLength={15}
            returnKeyType="done"
            onSubmitEditing={handleContinue}
            accessibilityLabel="Phone number"
          />
        </View>
      </View>

      <TrustStrip
        icon="shield-checkmark"
        text="Reset codes expire in 10 minutes. We'll never ask for your PIN by phone or email."
      />

      <CountryPickerSheet
        ref={sheetRef}
        selected={country}
        onSelect={setCountry}
      />
    </AuthScreenContainer>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    headerWrap: { gap: theme.space.s2 },
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
    label: {
      ...theme.type.micro,
      color: theme.fgMuted,
      marginBottom: 8,
    },
    field: {
      height: 56,
      borderRadius: theme.radius.md + 2,
      borderWidth: 1.5,
      borderColor: theme.primary,
      backgroundColor: theme.surface,
      flexDirection: "row",
      alignItems: "center",
      overflow: "hidden",
    },
    dialBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: theme.space.s3,
      height: "100%",
      borderRightWidth: 1,
      borderRightColor: theme.border,
    },
    flag: { fontSize: 20 },
    dial: {
      ...theme.type.body,
      ...theme.type.money,
      color: theme.fg,
      fontWeight: "700",
    },
    input: {
      flex: 1,
      paddingHorizontal: theme.space.s3 + 2,
      ...theme.type.bodyLg,
      color: theme.fg,
      letterSpacing: 0.4,
      fontWeight: "600",
      paddingVertical: 0,
    },
  });
