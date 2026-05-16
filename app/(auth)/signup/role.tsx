import React, { useCallback, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import { useRouter } from "expo-router";
import { Theme, useTheme } from "@/constants/theme";
import { AuthScreenContainer } from "@/components/ui/auth";
import { usePendingSignupStore } from "@/store/usePendingSignupStore";

type Role = "customer" | "vendor" | "rider";

interface RoleConfig {
  id: Role;
  name: string;
  line: string;
  hint: string;
  hintTone: "primary" | "info" | "warning";
}

const ROLES: RoleConfig[] = [
  {
    id: "customer",
    name: "Customer",
    line: "Order fuel to your door",
    hint: "Start ordering in under a minute",
    hintTone: "primary",
  },
  {
    id: "vendor",
    name: "Vendor",
    line: "Run your station on Gaznger",
    hint: "Verification required · 12–24 h",
    hintTone: "info",
  },
  {
    id: "rider",
    name: "Rider",
    line: "Earn delivering fuel",
    hint: "Verification required · 12–24 h",
    hintTone: "warning",
  },
];

/**
 * Role picker — v7 unified auth. Reached from welcome slide 4's "Sign
 * up" CTA. Three big stacked cards; tapping a card routes:
 *   - customer → phone (no role-tailored welcome; the default welcome
 *     is already customer-facing)
 *   - vendor   → /(auth)/welcome/vendor (3-slide role welcome → phone)
 *   - rider    → /(auth)/welcome/rider  (3-slide role welcome → phone)
 *
 * The pendingSignupStore caches the picked role so later steps (phone,
 * OTP, set-pin, onboarding wizard) know which path to take.
 */
export default function RolePickerScreen() {
  const theme = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const setRole = usePendingSignupStore((s) => s.setRole);
  const setLastStep = usePendingSignupStore((s) => s.setLastStep);

  const handlePick = useCallback(
    (role: Role) => {
      setRole(role);
      if (role === "customer") {
        const path = "/(auth)/phone";
        setLastStep(path);
        router.push({
          pathname: path as never,
          params: { mode: "signup", role: "customer" },
        } as never);
        return;
      }
      const path = `/(auth)/welcome/${role}`;
      setLastStep(path);
      router.push(path as never);
    },
    [router, setRole, setLastStep],
  );

  return (
    <AuthScreenContainer
      contentStyle={{ paddingTop: 0, paddingHorizontal: 0 }}
    >
      <View style={styles.headerBlock}>
        <Text style={styles.eyebrow}>Sign up</Text>
        <Text style={styles.title}>What brings you here?</Text>
        <Text style={styles.sub}>
          Pick the role that fits you best. You can't change this later
          from the app.
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {ROLES.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => handlePick(r.id)}
            accessibilityRole="button"
            accessibilityLabel={`${r.name}: ${r.line}`}
            style={({ pressed }) => [
              styles.card,
              pressed && { opacity: 0.94 },
            ]}
          >
            <View style={styles.row}>
              <RoleTile kind={r.id} theme={theme} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.cardName}>{r.name}</Text>
                <Text style={styles.cardLine}>{r.line}</Text>
                <View style={styles.pillRow}>
                  <Pill tone={r.hintTone} theme={theme}>
                    {r.hint}
                  </Pill>
                </View>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.fgMuted}
              />
            </View>
          </Pressable>
        ))}

        <View style={styles.footnote}>
          <Ionicons
            name="information-circle"
            size={18}
            color={theme.palette.green700}
          />
          <Text style={styles.footnoteText}>
            Customers can start ordering right away. Vendors and riders
            go through a quick verification before going live.
          </Text>
        </View>
      </ScrollView>
    </AuthScreenContainer>
  );
}

function RoleTile({ kind, theme }: { kind: Role; theme: Theme }) {
  const tint = {
    customer: theme.primaryTint,
    vendor: theme.infoTint,
    rider: theme.warningTint,
  }[kind];
  const fg = {
    customer: theme.palette.green700,
    vendor: theme.info,
    rider: theme.warning,
  }[kind];
  return (
    <View
      style={{
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: tint,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg
        width={32}
        height={32}
        viewBox="0 0 32 32"
        fill="none"
        stroke={fg}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {kind === "customer" && (
          <>
            <Circle cx={16} cy={11} r={4} />
            <Path d="M6 26 c 2 -6 6 -8 10 -8 s 8 2 10 8" />
          </>
        )}
        {kind === "vendor" && (
          <>
            <Path d="M6 26 L 6 12 L 18 12 L 18 26" />
            <Path d="M18 16 L 24 16 L 24 26 L 18 26" />
            <Line x1={6} y1={26} x2={26} y2={26} />
            <Line x1={9} y1={16} x2={15} y2={16} />
          </>
        )}
        {kind === "rider" && (
          <>
            <Circle cx={9} cy={22} r={4} />
            <Circle cx={23} cy={22} r={4} />
            <Path d="M9 22 L 16 12 L 22 12 L 23 22" />
            <Line x1={16} y1={8} x2={20} y2={8} />
          </>
        )}
      </Svg>
    </View>
  );
}

function Pill({
  tone,
  theme,
  children,
}: {
  tone: "primary" | "info" | "warning";
  theme: Theme;
  children: React.ReactNode;
}) {
  const bg = {
    primary: theme.primaryTint,
    info: theme.infoTint,
    warning: theme.warningTint,
  }[tone];
  const fg = {
    primary: theme.palette.green700,
    info: theme.info,
    warning: theme.warning,
  }[tone];
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: bg,
        alignSelf: "flex-start",
      }}
    >
      <Text
        style={{
          color: fg,
          fontSize: 11,
          fontWeight: "800",
          letterSpacing: 0.2,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    headerBlock: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 12,
      gap: 6,
    },
    eyebrow: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: theme.palette.green700,
    },
    title: {
      ...theme.type.h1,
      color: theme.fg,
      fontWeight: "800",
      letterSpacing: -0.3,
      marginTop: 2,
    },
    sub: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      lineHeight: 20,
      marginTop: 4,
    },
    scroll: {
      paddingHorizontal: 16,
      paddingBottom: 40,
      gap: 12,
    },
    card: {
      padding: 14,
      borderRadius: 18,
      backgroundColor: theme.surface,
      borderWidth: 1.5,
      borderColor: theme.divider,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    cardName: {
      ...theme.type.h2,
      color: theme.fg,
      fontWeight: "800",
      letterSpacing: -0.2,
      fontSize: 17,
    },
    cardLine: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      marginTop: 2,
    },
    pillRow: {
      marginTop: 8,
      flexDirection: "row",
    },
    footnote: {
      flexDirection: "row",
      gap: 10,
      alignItems: "flex-start",
      marginTop: 4,
      padding: 14,
      borderRadius: 14,
      backgroundColor: theme.primaryTint,
      borderWidth: 1,
      borderColor: theme.palette.green100,
    },
    footnoteText: {
      flex: 1,
      ...theme.type.bodySm,
      color: theme.palette.green700,
      lineHeight: 20,
    },
  });
