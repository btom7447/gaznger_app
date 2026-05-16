import React, { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
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
import { getDeviceLabel, getOrCreateDeviceId } from "@/lib/auth";
import { usePendingSignupStore } from "@/store/usePendingSignupStore";

type Mode = "signup" | "login";
type Role = "customer" | "vendor" | "rider";

interface CheckPhoneResponse {
  exists: boolean;
  hasPin: boolean;
  knownDevice: boolean;
  accountStatus?: "active" | "suspended" | "pending";
}

const NIGERIA: Country = {
  code: "NG",
  name: "Nigeria",
  dialCode: "+234",
  flag: "🇳🇬",
};

/**
 * Phone-entry screen — shared by signup + login. Mode parameter only
 * shifts copy ("What's your number?" vs "Welcome back") and a small
 * branch decision after `/auth/check-phone`:
 *
 *   mode=signup, exists=true   → toast + flip to login
 *   mode=login, exists=false   → toast + flip to signup
 *   accountStatus=suspended    → /(auth)/states/suspended
 *   otherwise                  → send OTP, route to /(auth)/otp
 *
 * The number input strips non-digits as the user types (a paste of
 * "(080) 123-4567" arrives as "08012345678"). We strip a leading "0"
 * before concatenating with the dial code so a Nigerian local format
 * "08012345678" becomes E.164 "+2348012345678".
 */
export default function PhoneEntryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    mode?: Mode | "signin";
    role?: Role;
  }>();
  // "signin" is the v7 unified-auth alias for the existing "login" mode
  // — accept both so callers from welcome (signin) and the legacy
  // login flow keep working.
  const mode: Mode =
    params.mode === "login" || params.mode === "signin" ? "login" : "signup";
  const role: Role | undefined =
    params.role === "customer" ||
    params.role === "vendor" ||
    params.role === "rider"
      ? (params.role as Role)
      : undefined;
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [country, setCountry] = useState<Country>(NIGERIA);
  const [local, setLocal] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused] = useState(false);
  const sheetRef = useRef<CountryPickerSheetRef>(null);

  const setPhone = usePendingSignupStore((s) => s.setPhone);

  const isLogin = mode === "login";
  const headerTitle = isLogin ? "Welcome back" : "What's your number?";
  const headerSub = isLogin
    ? "Enter your number to log in."
    : "We'll send a code to verify it's you.";

  const e164 = useMemo(() => {
    // Strip leading zero from local-format numbers (Nigerian "080...").
    const stripped = local.replace(/^0+/, "");
    if (!stripped) return null;
    return `${country.dialCode}${stripped}`;
  }, [country.dialCode, local]);

  const validE164 = e164 ? /^\+\d{8,15}$/.test(e164) : false;

  const handleChange = useCallback(
    (next: string) => {
      // Strip non-digits, allow user-friendly grouping during input.
      let digits = next.replace(/\D/g, "");

      // Auto-fill / paste smarts. iOS + Android often deliver the
      // number with the dial code already on it (autofill from
      // contacts, paste of "+2348012345678" or "2348012345678",
      // SMS-recall predictive). After we strip the "+" above, that
      // arrives as "234..." which the user perceives as their dial
      // code already being typed. If the input starts with the
      // current country's digits-only dial code, peel it off so the
      // composed E.164 doesn't double-prepend "+234234...".
      const dialDigits = country.dialCode.replace(/^\+/, "");
      if (dialDigits && digits.startsWith(dialDigits)) {
        digits = digits.slice(dialDigits.length);
      }
      // Same for a leading 0 (Nigerian local format "08012...").
      // Single leading zero only — don't strip "00" which can be
      // someone typing a prefix.
      if (digits.startsWith("0") && !digits.startsWith("00")) {
        digits = digits.slice(1);
      }

      setLocal(digits);
    },
    [country.dialCode]
  );

  const handleContinue = useCallback(async () => {
    if (!validE164 || !e164 || submitting) return;
    setSubmitting(true);
    try {
      const deviceId = await getOrCreateDeviceId();
      const check = await api.post<CheckPhoneResponse>(
        "/auth/check-phone",
        { phone: e164 },
        {
          headers: {
            "X-Device-Id": deviceId,
            "X-Device-Label": getDeviceLabel(),
          },
        }
      );

      if (check.accountStatus === "suspended") {
        router.push("/(auth)/states/suspended" as never);
        return;
      }

      if (mode === "signup" && check.exists) {
        toast.info("Account already exists", {
          description: "Logging you in instead.",
        });
        router.replace({
          pathname: "/(auth)/phone" as never,
          params: { mode: "login" },
        });
        return;
      }

      if (mode === "login" && !check.exists) {
        toast.info("No account yet", {
          description: "Let's create one.",
        });
        router.replace({
          pathname: "/(auth)/phone" as never,
          params: { mode: "signup" },
        });
        return;
      }

      // Persist the phone for the OTP step + signup tail resume +
      // PIN unlock screen (which reads `pendingSignup.phone` when no
      // session is around yet — typical login from welcome path).
      setPhone(e164);

      // Login + known device — skip OTP entirely, jump to PIN unlock.
      // (See _server-asks/auth-device-binding.md for the contract.)
      if (mode === "login" && check.knownDevice) {
        router.push({
          pathname: "/(auth)/unlock/pin" as never,
          params: { phone: e164 },
        });
        return;
      }

      router.push({
        pathname: "/(auth)/otp" as never,
        params: {
          phone: e164,
          purpose: mode,
          ...(role ? { role } : {}),
        },
      } as never);
    } catch (err: any) {
      // Surface the server message verbatim — no generic strings.
      toast.error("Couldn't continue", {
        description: err?.message ?? "Try again in a moment.",
      });
    } finally {
      setSubmitting(false);
    }
  }, [validE164, e164, submitting, mode, router, setPhone]);

  return (
    <AuthScreenContainer
      contentStyle={{ paddingTop: theme.space.s4, gap: theme.space.s4 }}
      footer={
        <Button
          variant="primary"
          size="lg"
          full
          onPress={handleContinue}
          disabled={!validE164 || submitting}
          loading={submitting}
          accessibilityLabel="Continue to verification code step"
        >
          Continue
        </Button>
      }
    >
      <View style={styles.headerWrap}>
        {!isLogin ? (
          <View style={styles.eyebrowRow}>
            <Text style={styles.eyebrow}>Step 1 of 3</Text>
            {role ? <RoleChip role={role} theme={theme} /> : null}
          </View>
        ) : null}
        <Text style={styles.title}>{headerTitle}</Text>
        <Text style={styles.sub}>{headerSub}</Text>
      </View>

      <View>
        <Text style={styles.label}>PHONE NUMBER</Text>
        <View
          style={[
            styles.field,
            focused && !validE164 && local.length > 0
              ? null
              : focused
              ? styles.fieldFocused
              : null,
          ]}
        >
          <Pressable
            onPress={() => sheetRef.current?.open()}
            accessibilityRole="button"
            accessibilityLabel={`Dial code ${country.dialCode}, ${country.name}. Tap to change country.`}
            style={({ pressed }) => [
              styles.dialBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.flag}>{country.flag}</Text>
            <Text style={styles.dial}>{country.dialCode}</Text>
            <Ionicons
              name="chevron-down"
              size={14}
              color={theme.fgMuted}
            />
          </Pressable>
          <TextInput
            value={local}
            onChangeText={handleChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            keyboardType="phone-pad"
            placeholder="80 1234 5678"
            placeholderTextColor={theme.fgMuted}
            style={styles.input}
            autoComplete="tel"
            textContentType="telephoneNumber"
            accessibilityLabel="Phone number"
            maxLength={15}
            returnKeyType="done"
            onSubmitEditing={handleContinue}
          />
        </View>
        <Text style={styles.helper}>Standard SMS rates apply.</Text>
      </View>

      <TrustStrip text="Your number is never shared. Used only for delivery and account updates." />

      <CountryPickerSheet
        ref={sheetRef}
        selected={country}
        onSelect={setCountry}
      />
    </AuthScreenContainer>
  );
}

function RoleChip({ role, theme }: { role: Role; theme: Theme }) {
  const cfg = {
    customer: { bg: theme.primaryTint, fg: theme.palette.green700, label: "Customer" },
    vendor: { bg: theme.infoTint, fg: theme.info, label: "Vendor" },
    rider: { bg: theme.warningTint, fg: theme.warning, label: "Rider" },
  }[role];
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: cfg.bg,
      }}
    >
      <Text
        style={{
          color: cfg.fg,
          fontSize: 11,
          fontWeight: "800",
          letterSpacing: 0.2,
        }}
      >
        {cfg.label} · Sign up
      </Text>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    headerWrap: {
      gap: theme.space.s2,
    },
    eyebrowRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      marginBottom: 4,
    },
    eyebrow: {
      ...theme.type.micro,
      color: theme.palette.green700,
      fontWeight: "800",
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
    label: {
      ...theme.type.micro,
      color: theme.fgMuted,
      marginBottom: 8,
    },
    field: {
      height: 56,
      borderRadius: theme.radius.md + 2,
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      flexDirection: "row",
      alignItems: "center",
      overflow: "hidden",
    },
    fieldFocused: {
      borderColor: theme.primary,
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
    flag: {
      fontSize: 20,
    },
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
    helper: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      marginTop: 6,
    },
  });
