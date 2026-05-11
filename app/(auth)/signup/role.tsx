import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Theme, useTheme } from "@/constants/theme";
import { AuthScreenContainer, RoleSelectCard, type Role } from "@/components/ui/auth";
import { Button } from "@/components/ui/primitives";
import { usePendingSignupStore } from "@/store/usePendingSignupStore";

const ROLES: Role[] = ["customer", "rider", "vendor"];

/**
 * Role select — collected after OTP per the design's no-dead-end
 * policy (a wrong-number user can still flip to login without the
 * role choice trapping them in a partial signup). Picking customer
 * leads straight to the customer profile form; rider + vendor get
 * verification kickoff after their profile + PIN + permissions.
 *
 * Default selection is `customer` so a user who taps Continue without
 * touching the cards still moves forward (matches the design's
 * pre-selected radio).
 */
export default function RoleSelectScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const stored = usePendingSignupStore((s) => s.role);
  const setRole = usePendingSignupStore((s) => s.setRole);
  const setLastStep = usePendingSignupStore((s) => s.setLastStep);
  const [active, setActive] = useState<Role>(stored ?? "customer");

  const handleContinue = useCallback(() => {
    setRole(active);
    setLastStep(`/(auth)/signup/profile-${active}`);
    router.push(`/(auth)/signup/profile-${active}` as never);
  }, [active, router, setRole, setLastStep]);

  return (
    <AuthScreenContainer
      contentStyle={{ paddingTop: theme.space.s4, gap: theme.space.s4 }}
      footer={
        <Button
          variant="primary"
          size="lg"
          full
          onPress={handleContinue}
          accessibilityLabel="Continue with selected role"
        >
          Continue
        </Button>
      }
    >
      <View style={styles.headerWrap}>
        <Text style={styles.title}>How will you use Gaznger?</Text>
        <Text style={styles.sub}>Pick one — you can add more later.</Text>
      </View>

      <View style={styles.cards}>
        {ROLES.map((r) => (
          <RoleSelectCard
            key={r}
            role={r}
            selected={active === r}
            onPress={() => setActive(r)}
          />
        ))}
      </View>

      <Text style={styles.note}>
        Riders and Station Owners go through a quick verification before they
        can take orders. Customers can order right away.
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
    cards: {
      gap: theme.space.s3,
    },
    note: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      lineHeight: 19,
    },
  });
