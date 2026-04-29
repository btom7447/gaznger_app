import React, { useCallback, useMemo } from "react";
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
import { Theme, useTheme } from "@/constants/theme";
import { useOrderStore } from "@/store/useOrderStore";
import {
  FloatingCTA,
  LiveBadge,
  StatusBadge,
} from "@/components/ui/primitives";

interface Step {
  label: string;
  state: "done" | "active" | "pending";
  meta?: string;
}

export default function HandoffScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const draft = useOrderStore((s) => s.order);
  const isSwap = draft.serviceType === "swap";

  // Demo state — derive from server `order:update` events when wired.
  const steps: Step[] = isSwap
    ? [
        { label: "Empty cylinder collected", state: "done" },
        { label: "Weighed & verified at station", state: "done" },
        { label: "Full cylinder en route back", state: "active", meta: "~6 min" },
        { label: "Delivered & connected (you confirm)", state: "pending" },
      ]
    : [
        // Refill flow has no station weighing.
        { label: "Heading to your address", state: "done" },
        { label: "Delivered & connected (you confirm)", state: "active" },
      ];

  const riderFirstName = draft.rider?.firstName ?? "Your rider";

  const handleConfirm = useCallback(() => {
    router.replace("/(customer)/(track)/delivered" as never);
  }, [router]);

  const handleCall = useCallback(() => {
    if (draft.rider?.phone) Linking.openURL(`tel:${draft.rider.phone}`);
  }, [draft.rider?.phone]);

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
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
        <View style={styles.pulseLg} />
        <View style={styles.pulseMd} />
        <View style={styles.pulseSm}>
          <Ionicons name="checkmark" size={20} color="#fff" />
        </View>

        <View
          style={[
            styles.topRow,
            { paddingTop: insets.top + 8 },
          ]}
        >
          <Pressable
            onPress={() => router.replace("/(customer)/(home)" as never)}
            accessibilityRole="button"
            accessibilityLabel="Cancel swap"
            style={({ pressed }) => [
              styles.roundBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons name="close" size={20} color={theme.fg} />
          </Pressable>
          <View style={styles.liveWrap}>
            <LiveBadge status="onSite" />
          </View>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <View style={styles.body}>
        <StatusBadge kind="info" pulse withDot>
          {isSwap ? "SWAP IN PROGRESS" : "DELIVERY IN PROGRESS"}
        </StatusBadge>

        <Text style={styles.h1}>
          {isSwap ? "Hand it over" : "Cylinder arriving"}
        </Text>
        <Text style={styles.body1}>
          {isSwap
            ? `${riderFirstName} is at your address. Pass them your empty ${draft.cylinderType ?? "cylinder"} — they'll leave the full one in its place.`
            : `${riderFirstName} is at your address with your refilled ${draft.cylinderType ?? "cylinder"}.`}
        </Text>

        {/* 4-step checklist */}
        <View style={styles.checklistCard}>
          {steps.map((s, i) => (
            <View
              key={s.label}
              style={[
                styles.stepRow,
                i < steps.length - 1 && styles.stepRowDivider,
              ]}
            >
              <View
                style={[
                  styles.stepDot,
                  s.state === "done" && styles.stepDotDone,
                  s.state === "active" && styles.stepDotActive,
                ]}
              >
                {s.state === "done" ? (
                  <Ionicons name="checkmark" size={12} color="#fff" />
                ) : s.state === "active" ? (
                  <View style={styles.stepDotInner} />
                ) : null}
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  s.state === "done" && styles.stepLabelDone,
                  s.state === "active" && styles.stepLabelActive,
                ]}
                numberOfLines={1}
              >
                {s.label}
              </Text>
              {s.meta ? (
                <Text style={styles.stepMeta}>{s.meta}</Text>
              ) : null}
            </View>
          ))}
        </View>

        {/* Weight verification card — swap only. Rendered only once
            the rider app has emitted a `weighIn` payload via order:update.
            Until then, the swap checklist's "Weighed at station" step
            stays at "active" and this card is hidden. */}
        {isSwap && draft.weighIn ? (
          <View style={styles.weightCard}>
            <Text style={styles.weightEyebrow}>WEIGHED AT STATION</Text>
            <View style={styles.weightRow}>
              <View style={styles.weightCol}>
                <Text style={styles.weightLabel}>Empty:</Text>
                <Text style={styles.weightValue}>
                  {draft.weighIn.emptyKg.toFixed(1)}kg
                </Text>
              </View>
              <View style={styles.weightCol}>
                <Text style={styles.weightLabel}>Full:</Text>
                <Text style={styles.weightValue}>
                  {draft.weighIn.fullKg.toFixed(1)}kg
                </Text>
              </View>
              <View style={[styles.weightCol, { alignItems: "flex-end" }]}>
                <Text
                  style={[
                    styles.weightValue,
                    { color: theme.primary },
                  ]}
                >
                  = {draft.weighIn.netKg.toFixed(1)}kg gas
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.riderCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(draft.rider?.initials ??
                draft.rider?.firstName?.charAt(0) ??
                "R").toUpperCase()}
            </Text>
          </View>
          <View style={styles.riderInfo}>
            <Text style={styles.riderName}>
              {[draft.rider?.firstName, draft.rider?.lastName]
                .filter(Boolean)
                .join(" ") || "Your rider"}
            </Text>
            <Text style={styles.riderMeta}>at your address now</Text>
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
      </View>

      <FloatingCTA
        label={isSwap ? "Cylinder back · all good" : "Cylinder received"}
        subtitle="Confirms delivery · final step"
        onPress={handleConfirm}
      />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1 },
    ribbon: {
      height: 200,
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
    checklistCard: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: theme.radius.lg,
      padding: theme.space.s3 + 2,
    },
    stepRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s3,
      paddingVertical: theme.space.s2,
    },
    stepRowDivider: {
      borderBottomColor: theme.divider,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    stepDot: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: theme.bgMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    stepDotDone: { backgroundColor: theme.success },
    stepDotActive: { backgroundColor: theme.primary },
    stepDotInner: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: "#fff",
    },
    stepLabel: {
      ...theme.type.body,
      color: theme.fg,
      flex: 1,
    },
    stepLabelDone: {
      color: theme.fgMuted,
      textDecorationLine: "line-through",
    },
    stepLabelActive: {
      fontWeight: "800",
    },
    stepMeta: {
      ...theme.type.caption,
      color: theme.primary,
      ...theme.type.money,
      fontWeight: "700",
    },
    weightCard: {
      backgroundColor: theme.primaryTint,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.space.s3 + 2,
      paddingVertical: theme.space.s3,
      gap: 6,
    },
    weightEyebrow: {
      ...theme.type.micro,
      color: theme.fgMuted,
    },
    weightRow: {
      flexDirection: "row",
      gap: theme.space.s3,
    },
    weightCol: { flex: 1, gap: 2 },
    weightLabel: {
      ...theme.type.caption,
      color: theme.fgMuted,
    },
    weightValue: {
      ...theme.type.body,
      ...theme.type.money,
      color: theme.fg,
      fontWeight: "800",
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
  });
