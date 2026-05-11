import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Theme, useTheme } from "@/constants/theme";
import { AuthScreenContainer, TrustStrip } from "@/components/ui/auth";
import { Button, Input } from "@/components/ui/primitives";
import { usePendingSignupStore } from "@/store/usePendingSignupStore";

/**
 * Customer profile setup — name + optional email. Used on receipts and
 * delivery labels per the design copy. Email is for account recovery
 * only (mirrors the trust strip wording from the source design).
 */
export default function ProfileCustomerScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const stored = usePendingSignupStore((s) => s.profile.customer);
  const patchProfile = usePendingSignupStore((s) => s.patchProfile);
  const setLastStep = usePendingSignupStore((s) => s.setLastStep);

  const [firstName, setFirstName] = useState(stored?.firstName ?? "");
  const [lastName, setLastName] = useState(stored?.lastName ?? "");
  const [email, setEmail] = useState(stored?.email ?? "");
  const [emailErr, setEmailErr] = useState<string | null>(null);

  const valid =
    firstName.trim().length >= 2 &&
    lastName.trim().length >= 2 &&
    (!email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

  const handleContinue = useCallback(() => {
    if (!valid) {
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setEmailErr("That doesn't look like a valid email.");
      }
      return;
    }
    patchProfile("customer", {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim() || undefined,
    });
    setLastStep("/(auth)/signup/pin-create");
    router.push("/(auth)/signup/pin-create" as never);
  }, [valid, email, firstName, lastName, patchProfile, setLastStep, router]);

  return (
    <AuthScreenContainer
      contentStyle={{ paddingTop: theme.space.s4, gap: theme.space.s4 }}
      footer={
        <Button
          variant="primary"
          size="lg"
          full
          onPress={handleContinue}
          disabled={!valid}
          accessibilityLabel="Continue to PIN setup"
        >
          Continue
        </Button>
      }
    >
      <View style={styles.headerWrap}>
        <Text style={styles.title}>Your name</Text>
        <Text style={styles.sub}>Used on receipts and delivery labels.</Text>
      </View>

      <Input
        label="FIRST NAME"
        value={firstName}
        onChangeText={setFirstName}
        placeholder="Enter first name"
        autoComplete="name-given"
        textContentType="givenName"
        autoCapitalize="words"
        returnKeyType="next"
      />
      <Input
        label="LAST NAME"
        value={lastName}
        onChangeText={setLastName}
        placeholder="Enter last name"
        autoComplete="name-family"
        textContentType="familyName"
        autoCapitalize="words"
        returnKeyType="next"
      />
      <Input
        label="EMAIL ADDRESS (OPTIONAL)"
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          if (emailErr) setEmailErr(null);
        }}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        autoCapitalize="none"
        returnKeyType="done"
        error={emailErr ?? undefined}
      />

      <TrustStrip
        icon="mail"
        text="Your email is only used for account recovery. We don't spam."
      />
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
  });
