import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Theme, useTheme, formatCurrency } from "@/constants/theme";
import { useOrderStore } from "@/store/useOrderStore";
import { getSocket } from "@/lib/socket";
import {
  FloatingCTA,
  LiveBadge,
  StatusBadge,
} from "@/components/ui/primitives";
import DispenseRing from "@/components/ui/customer/track/DispenseRing";

/**
 * Arrival screen — liquid only. Replaces Track once status === 'arrived'.
 * Shows the dispense ring as fuel pumps; CTA "I have my fuel" confirms.
 */
export default function ArrivalScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const draft = useOrderStore((s) => s.order);

  const [filled, setFilled] = useState(0);
  const total = draft.qty ?? 15;

  // Dispense progress driven by real socket events from the rider app.
  // No client-side demo timer — that caused haunted-state bugs
  // (auto-completion firing on a screen left mounted in the navigation
  // stack). Once the rider starts pumping, `dispense:progress` events
  // fire with `litres` and the ring fills.
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !draft.orderId) return;

    const handler = (data: { orderId?: string; litres?: number }) => {
      // Filter by order id when present so a stale event from a prior
      // order can't update this screen.
      if (data.orderId && data.orderId !== draft.orderId) return;
      if (typeof data.litres === "number") {
        setFilled(Math.max(0, Math.min(total, data.litres)));
      }
    };
    socket.on("dispense:progress", handler);
    return () => {
      socket.off("dispense:progress", handler);
    };
  }, [draft.orderId, total]);

  const progress = total > 0 ? filled / total : 0;
  const remainingMin = Math.max(0, Math.round((1 - progress) * 3));

  const riderFirstName = draft.rider?.firstName ?? "Your rider";
  const riderFullName = useMemo(() => {
    return (
      [draft.rider?.firstName, draft.rider?.lastName].filter(Boolean).join(" ") ||
      "Your rider"
    );
  }, [draft.rider?.firstName, draft.rider?.lastName]);

  const handleConfirm = useCallback(() => {
    router.replace("/(customer)/(track)/delivered" as never);
  }, [router]);

  const handleCall = useCallback(() => {
    if (draft.rider?.phone) Linking.openURL(`tel:${draft.rider.phone}`);
  }, [draft.rider?.phone]);

  const totalNaira = (draft.station?.totalKobo ?? 0) / 100;

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      {/* Map ribbon — illustrative, not a real MapView for perf */}
      <View
        style={[
          styles.ribbon,
          { paddingTop: insets.top + 16 },
        ]}
      >
        <LinearGradient
          colors={
            theme.mode === "dark"
              ? [theme.palette.green900, theme.palette.green700]
              : [theme.palette.green50, theme.primaryTint]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Pulse rings around the rider's "here" marker */}
        <View style={styles.pulseLg} />
        <View style={styles.pulseMd} />
        <View style={styles.pulseSm}>
          <Ionicons name="checkmark" size={20} color="#fff" />
        </View>

        {/* Top overlay buttons */}
        <View
          style={[
            styles.topRow,
            { paddingTop: insets.top + 8 },
          ]}
        >
          <Pressable
            onPress={() => router.replace("/(customer)/(home)" as never)}
            accessibilityRole="button"
            accessibilityLabel="Cancel dispensing"
            style={({ pressed }) => [
              styles.roundBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons name="close" size={20} color={theme.fg} />
          </Pressable>
          <View style={styles.liveWrap}>
            <LiveBadge />
          </View>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <View style={styles.body}>
        <StatusBadge kind="success" pulse withDot>
          RIDER ARRIVED
        </StatusBadge>

        <Text style={styles.h1}>Dispensing now</Text>
        <Text style={styles.body1}>
          {riderFirstName} is filling your tank. Stay close — you'll confirm in a sec.
        </Text>

        <View style={styles.dispenseCard}>
          <DispenseRing progress={progress} />
          <View style={styles.dispenseBody}>
            <Text style={styles.dispenseTitle}>
              {filled.toFixed(1)} L of {total} L
            </Text>
            <Text style={styles.dispenseSub}>
              {remainingMin < 1
                ? "Almost done"
                : `~${remainingMin} min remaining`}
            </Text>
          </View>
        </View>

        <View style={styles.riderCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(draft.rider?.initials ?? riderFirstName.charAt(0)).toUpperCase()}
            </Text>
          </View>
          <View style={styles.riderInfo}>
            <Text style={styles.riderName}>{riderFullName}</Text>
            <Text style={styles.riderMeta}>
              {[
                draft.rider?.plate,
                draft.rider?.rating != null
                  ? `★ ${draft.rider.rating.toFixed(1)}`
                  : null,
                "here now",
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
          <Pressable
            onPress={handleCall}
            accessibilityRole="button"
            accessibilityLabel={`Call ${riderFirstName}`}
            style={({ pressed }) => [
              styles.callBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons name="call" size={18} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Order</Text>
            <Text style={styles.summaryValue}>
              #{draft.orderId ?? "—"}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              {total} L {draft.fuelTypeId ?? ""}
            </Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(totalNaira)}
            </Text>
          </View>
        </View>
      </View>

      <FloatingCTA
        label="I have my fuel"
        subtitle="Confirms delivery · final step"
        onPress={handleConfirm}
        accessibilityLabel="I have my fuel — confirms delivery"
      />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1 },
    ribbon: {
      height: 220,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    topRow: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.space.s4,
    },
    roundBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
      ...theme.elevation.card,
    },
    liveWrap: {
      backgroundColor: theme.surface,
      borderRadius: theme.radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 4,
      ...theme.elevation.card,
    },
    pulseLg: {
      position: "absolute",
      width: 130,
      height: 130,
      borderRadius: 65,
      backgroundColor: "rgba(255,255,255,0.18)",
    },
    pulseMd: {
      position: "absolute",
      width: 86,
      height: 86,
      borderRadius: 43,
      backgroundColor: "rgba(255,255,255,0.32)",
    },
    pulseSm: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.success,
      alignItems: "center",
      justifyContent: "center",
      ...theme.elevation.card,
    },
    body: {
      flex: 1,
      paddingHorizontal: theme.space.s4,
      paddingTop: theme.space.s4,
      gap: theme.space.s3,
    },
    h1: {
      ...theme.type.h1,
      color: theme.fg,
    },
    body1: {
      ...theme.type.body,
      color: theme.fgMuted,
    },
    dispenseCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s3,
      backgroundColor: theme.primaryTint,
      borderRadius: theme.radius.lg,
      padding: theme.space.s4,
    },
    dispenseBody: { flex: 1, gap: 2 },
    dispenseTitle: {
      ...theme.type.h2,
      color: theme.fg,
      ...theme.type.money,
    },
    dispenseSub: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    riderCard: {
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
      fontWeight: "800",
    },
    riderMeta: {
      ...theme.type.caption,
      color: theme.fgMuted,
    },
    callBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    summaryCard: {
      backgroundColor: theme.bgMuted,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.space.s3 + 2,
      paddingVertical: theme.space.s3,
      gap: 6,
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    summaryLabel: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
    },
    summaryValue: {
      ...theme.type.body,
      ...theme.type.money,
      color: theme.fg,
      fontWeight: "700",
    },
  });
