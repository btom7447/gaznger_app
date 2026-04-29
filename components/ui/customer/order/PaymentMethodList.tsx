import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme, formatCurrency } from "@/constants/theme";

// Cash on delivery is intentionally excluded — Gaznger handles all
// payments via Paystack so we have an audit trail and escrow on every
// order.
export type PaymentMethodKind = "card" | "wallet" | "transfer";

export interface PaymentMethod {
  id: string;
  kind: PaymentMethodKind;
  label: string;
  sublabel: string;
  /** For wallets — current balance in Naira (whole). */
  balance?: number;
  /** For wallet, true when balance < total. */
  insufficient?: boolean;
  /**
   * Optional — when the method's icon should be a brand mark (e.g. "GTB"
   * monogram on the card row), pass the short tag here.
   */
  brandTag?: string;
}

interface PaymentMethodListProps {
  methods: PaymentMethod[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /**
   * Optional handler — when present, an inline "Top up" link replaces
   * the right-side check on the wallet row when its balance is
   * insufficient for the current order. Lets the user fix the
   * shortfall without leaving the Payment screen via the back stack.
   */
  onTopUp?: () => void;
}

const ICON_BY_KIND: Record<
  PaymentMethodKind,
  React.ComponentProps<typeof Ionicons>["name"]
> = {
  card: "card-outline",
  wallet: "wallet-outline",
  transfer: "swap-horizontal-outline",
};

export default function PaymentMethodList({
  methods,
  selectedId,
  onSelect,
  onTopUp,
}: PaymentMethodListProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.list}>
      {methods.map((m) => {
        const isSel = m.id === selectedId;
        const sub = m.insufficient
          ? `${m.sublabel} — top up needed`
          : m.sublabel;
        const subColor = m.insufficient ? theme.warning : theme.fgMuted;
        return (
          <Pressable
            key={m.id}
            onPress={() => onSelect(m.id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSel }}
            accessibilityLabel={`${m.label}, ${sub}`}
            style={({ pressed }) => [
              styles.card,
              isSel && styles.cardSelected,
              pressed && { opacity: 0.92 },
            ]}
          >
            <View
              style={[
                styles.iconTile,
                isSel && { backgroundColor: theme.surface },
                m.brandTag && styles.iconTileBrand,
              ]}
            >
              {m.brandTag ? (
                <Text style={styles.brandText}>{m.brandTag}</Text>
              ) : (
                <Ionicons
                  name={ICON_BY_KIND[m.kind]}
                  size={20}
                  color={isSel ? theme.primary : theme.fgMuted}
                />
              )}
            </View>
            <View style={styles.body}>
              <Text style={styles.label}>{m.label}</Text>
              <Text style={[styles.sub, { color: subColor }]} numberOfLines={1}>
                {sub}
              </Text>
            </View>
            {/* Inline "Top up" affordance — replaces the check/outline on
                the wallet row when the wallet is short. Tapping it does
                NOT also trigger the outer Pressable's onSelect (we stop
                propagation via separate Pressable + accessibilityRole). */}
            {m.kind === "wallet" && m.insufficient && onTopUp ? (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  onTopUp();
                }}
                accessibilityRole="button"
                accessibilityLabel="Top up your wallet"
                hitSlop={8}
                style={({ pressed }) => [
                  styles.topUpPill,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Ionicons name="add" size={14} color={theme.primary} />
                <Text style={styles.topUpPillText}>Top up</Text>
              </Pressable>
            ) : isSel ? (
              <View style={styles.checkBadge}>
                <Ionicons name="checkmark" size={14} color="#fff" />
              </View>
            ) : (
              <View style={styles.checkOutline} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Default static methods until /api/payment-methods lands. */
export function defaultPaymentMethods(walletBalance = 0, total = 0): PaymentMethod[] {
  return [
    {
      id: "card-default",
      kind: "card",
      label: "GTBank",
      sublabel: "•••• 4892 · default",
      brandTag: "GTB",
    },
    {
      id: "wallet",
      kind: "wallet",
      label: "Gaznger wallet",
      sublabel: `Balance ${formatCurrency(walletBalance)}`,
      balance: walletBalance,
      insufficient: walletBalance < total,
    },
    {
      id: "transfer",
      kind: "transfer",
      label: "Bank transfer",
      sublabel: "Pay to a one-time account",
    },
  ];
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    list: {
      gap: theme.space.s2,
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s3,
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: theme.radius.lg,
      paddingHorizontal: theme.space.s3 + 2,
      paddingVertical: theme.space.s3,
    },
    cardSelected: {
      backgroundColor: theme.primaryTint,
      borderColor: theme.primary,
      borderWidth: 1.5,
    },
    iconTile: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.md,
      backgroundColor: theme.bgMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    iconTileBrand: {
      // Bank brand tag — black bg with white monogram (e.g. "GTB").
      backgroundColor: theme.palette.neutral900,
    },
    brandText: {
      ...theme.type.micro,
      color: "#fff",
      fontWeight: "800",
      letterSpacing: 0.4,
    },
    body: { flex: 1, gap: 2 },
    label: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "800",
    },
    sub: {
      ...theme.type.caption,
    },
    checkBadge: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    checkOutline: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: theme.borderStrong,
    },
    topUpPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      paddingHorizontal: theme.space.s2 + 2,
      paddingVertical: 4,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.primaryTint,
    },
    topUpPillText: {
      ...theme.type.caption,
      color: theme.primary,
      fontWeight: "800",
    },
  });
