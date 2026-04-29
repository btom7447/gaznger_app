import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme, formatCurrency } from "@/constants/theme";
import { StatusBadge } from "@/components/ui/primitives";
import {
  CustomerStatus,
} from "@/utils/orderStatusLabels";

const STEP_LABELS = ["Confirmed", "Picked up", "Out", "Delivered"];

export interface RiderInfo {
  firstName: string;
  lastName: string;
  plate?: string;
  rating?: number;
  phone?: string;
  initials?: string;
}

interface TrackingSheetContentProps {
  status: CustomerStatus;
  orderId: string;
  etaMinutes?: number | null;
  arrivalTime?: string | null;
  qty: number;
  unit: string;
  fuelLabel: string;
  totalNaira: number;
  /** 0-indexed step (0..3). Use -1 for cancelled. */
  step: number;
  rider?: RiderInfo | null;
  onCall?: () => void;
  onChat?: () => void;
  /**
   * High-level phase the screen is in:
   *   "matching" — server has no rider yet; show placeholder + reassurance
   *   "active"   — rider assigned; show ETA + steps + rider card
   * Defaults to "active" when a rider is present, else "matching".
   */
  phase?: "matching" | "active";
}

export default function TrackingSheetContent({
  status,
  orderId,
  etaMinutes,
  arrivalTime,
  qty,
  unit,
  fuelLabel,
  totalNaira,
  step,
  rider,
  onCall,
  onChat,
  phase,
}: TrackingSheetContentProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const resolvedPhase = phase ?? (rider ? "active" : "matching");

  // Looping pulse for the matching-state placeholder avatar.
  const pulseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (resolvedPhase !== "matching") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [resolvedPhase, pulseAnim]);

  if (resolvedPhase === "matching") {
    return (
      <View style={styles.wrap}>
        <View style={styles.statusRow}>
          <StatusBadge kind="info" pulse>
            FINDING RIDER
          </StatusBadge>
          <Text style={styles.orderId}>#{orderId}</Text>
        </View>

        <View style={styles.matchingHero}>
          <Animated.View
            style={[
              styles.matchingPulse,
              {
                opacity: pulseAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.15, 0.45],
                }),
                transform: [
                  {
                    scale: pulseAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.9, 1.25],
                    }),
                  },
                ],
              },
            ]}
          />
          <View style={styles.matchingAvatar}>
            <Ionicons name="person" size={26} color={theme.fgMuted} />
          </View>
        </View>

        <Text style={styles.matchingTitle}>Matching you to the closest rider</Text>
        <Text style={styles.matchingSub}>
          We'll lock in a rider in a few seconds. Hang tight — your tracking
          will fill in here automatically.
        </Text>

        <Text style={styles.orderLine} numberOfLines={1}>
          {qty} {unit} {fuelLabel} · {formatCurrency(totalNaira)} · paid
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {/* Status row */}
      <View style={styles.statusRow}>
        <StatusBadge kind={status.kind} pulse={status.pulse}>
          {status.label}
        </StatusBadge>
        <Text style={styles.orderId}>#{orderId}</Text>
      </View>

      {/* ETA */}
      <View style={styles.etaRow}>
        <Text style={styles.etaNum}>{etaMinutes ?? "—"}</Text>
        <Text style={styles.etaUnit}>min</Text>
        {arrivalTime ? (
          <Text style={styles.etaSub}>· arrives {arrivalTime}</Text>
        ) : null}
      </View>

      {/* Order line */}
      <Text style={styles.orderLine} numberOfLines={1}>
        {qty} {unit} {fuelLabel} · {formatCurrency(totalNaira)} · paid
      </Text>

      {/* Progress steps */}
      <View style={styles.stepRow}>
        {STEP_LABELS.map((label, i) => {
          const past = step > i;
          const current = step === i;
          return (
            <React.Fragment key={label}>
              <View style={styles.stepCol}>
                <View
                  style={[
                    styles.stepDot,
                    past && styles.stepDotDone,
                    current && styles.stepDotCurrent,
                  ]}
                >
                  {past ? (
                    <Ionicons name="checkmark" size={10} color="#fff" />
                  ) : current ? (
                    <View style={styles.stepDotInner} />
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    (past || current) && { color: theme.fg },
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </View>
              {i < STEP_LABELS.length - 1 ? (
                <View
                  style={[
                    styles.stepLine,
                    past && { backgroundColor: theme.primary },
                  ]}
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </View>

      <View style={styles.divider} />

      {/* Rider card */}
      {rider ? (
        <View style={styles.riderRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(rider.initials ?? rider.firstName.charAt(0)).toUpperCase()}
            </Text>
          </View>
          <View style={styles.riderInfo}>
            <Text style={styles.riderName} numberOfLines={1}>
              {rider.firstName} {rider.lastName}
            </Text>
            <Text style={styles.riderMeta} numberOfLines={1}>
              {[rider.plate, rider.rating != null ? `★ ${rider.rating.toFixed(1)}` : null]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
          <View style={styles.riderActions}>
            {onCall ? (
              <Pressable
                onPress={onCall}
                accessibilityRole="button"
                accessibilityLabel={`Call ${rider.firstName}`}
                style={({ pressed }) => [
                  styles.actionBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Ionicons name="call" size={18} color={theme.primary} />
              </Pressable>
            ) : null}
            {onChat ? (
              <Pressable
                onPress={onChat}
                accessibilityRole="button"
                accessibilityLabel={`Message ${rider.firstName}`}
                style={({ pressed }) => [
                  styles.actionBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Ionicons
                  name="chatbubble-outline"
                  size={18}
                  color={theme.primary}
                />
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    wrap: {
      gap: theme.space.s3,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    orderId: {
      ...theme.type.caption,
      ...theme.type.money,
      color: theme.fgMuted,
    },
    etaRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 4,
    },
    etaNum: {
      ...theme.type.display,
      fontSize: 40,
      lineHeight: 44,
      color: theme.fg,
      ...theme.type.money,
    },
    etaUnit: {
      ...theme.type.bodyLg,
      color: theme.fgMuted,
    },
    etaSub: {
      ...theme.type.caption,
      color: theme.fgMuted,
      marginLeft: theme.space.s1,
    },
    orderLine: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    stepRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    stepCol: {
      alignItems: "center",
      gap: 4,
      width: 60,
    },
    stepDot: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: theme.bgMuted,
      borderWidth: 2,
      borderColor: theme.borderStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    stepDotDone: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    stepDotCurrent: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    stepDotInner: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#fff",
    },
    stepLabel: {
      ...theme.type.micro,
      color: theme.fgMuted,
    },
    stepLine: {
      flex: 1,
      height: 2,
      backgroundColor: theme.borderStrong,
      marginBottom: 18,
    },
    divider: {
      height: 1,
      backgroundColor: theme.divider,
      marginVertical: theme.space.s1,
    },
    riderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s3,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.primaryTint,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      ...theme.type.body,
      color: theme.primary,
      fontWeight: "800",
    },
    riderInfo: { flex: 1, gap: 2 },
    riderName: {
      ...theme.type.body,
      color: theme.fg,
      fontWeight: "700",
    },
    riderMeta: {
      ...theme.type.caption,
      color: theme.fgMuted,
    },
    riderActions: {
      flexDirection: "row",
      gap: theme.space.s2,
    },
    actionBtn: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.primaryTint,
      alignItems: "center",
      justifyContent: "center",
    },
    matchingHero: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: theme.space.s4,
    },
    matchingPulse: {
      position: "absolute",
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: theme.primary,
    },
    matchingAvatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.bgMuted,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.borderStrong,
    },
    matchingTitle: {
      ...theme.type.h2,
      color: theme.fg,
      textAlign: "center",
    },
    matchingSub: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      textAlign: "center",
    },
  });
