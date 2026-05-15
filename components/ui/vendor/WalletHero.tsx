import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";

/**
 * Wallet hero — gradient card at the top of the Wallet screen.
 *
 * Layout matches the Today hero (visual consistency):
 *   eyebrow "Wallet"  ── headline = available
 *   thin divider
 *   3-cell breakdown row: Available · Escrow · Pending
 */
export interface WalletHeroProps {
  available: number;
  escrow: number;
  pending: number;
}

function fmtNaira(value: number): string {
  return `₦${Math.round(value).toLocaleString("en-NG")}`;
}

export default function WalletHero({
  available,
  escrow,
  pending,
}: WalletHeroProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const gradient =
    theme.mode === "dark"
      ? [theme.palette.green700, theme.palette.green900]
      : [theme.palette.green500, theme.palette.green700];

  return (
    <LinearGradient
      colors={gradient as [string, string, ...string[]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
      accessible
      accessibilityLabel={
        `Available ${fmtNaira(available)}.` +
        ` Escrow ${fmtNaira(escrow)}, pending ${fmtNaira(pending)}.`
      }
    >
      <View style={styles.eyebrowRow}>
        <Ionicons name="wallet" size={12} color="rgba(255,255,255,0.85)" />
        <Text style={styles.eyebrow}>Wallet</Text>
      </View>

      <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
        {fmtNaira(available)}
      </Text>
      <Text style={styles.amountLabel}>Available to withdraw</Text>

      <View style={styles.divider} />

      <View style={styles.row}>
        <Cell label="Escrow" value={fmtNaira(escrow)} />
        <View style={styles.cellDivider} />
        <Cell label="Pending" value={fmtNaira(pending)} />
      </View>
    </LinearGradient>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <View style={cellStyles.cell}>
      <Text style={cellStyles.value} numberOfLines={1}>
        {value}
      </Text>
      <Text style={cellStyles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      borderRadius: theme.radius.xl,
      paddingHorizontal: 20,
      paddingVertical: 18,
      gap: 2,
    },
    eyebrowRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    eyebrow: {
      fontSize: 12,
      fontWeight: "700",
      color: "rgba(255,255,255,0.85)",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    amount: {
      fontSize: 36,
      fontWeight: "800",
      letterSpacing: -0.8,
      color: "#fff",
      marginTop: 4,
    },
    amountLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: "rgba(255,255,255,0.75)",
      marginTop: -2,
    },
    divider: {
      height: 1,
      backgroundColor: "rgba(255,255,255,0.15)",
      marginVertical: 12,
    },
    row: { flexDirection: "row", alignItems: "center" },
    cellDivider: {
      width: 1,
      alignSelf: "stretch",
      backgroundColor: "rgba(255,255,255,0.15)",
    },
  });

const cellStyles = StyleSheet.create({
  cell: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  value: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.4,
    color: "rgba(255,255,255,0.75)",
    textTransform: "uppercase",
  },
});
