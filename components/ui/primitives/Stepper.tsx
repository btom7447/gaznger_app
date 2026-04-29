import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Theme, useTheme } from "@/constants/theme";

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Unit label rendered after the number (e.g. 'L', 'kg'). */
  unit?: string;
  /** Helper line below — "Min 5 L · Max 200 L". Renders inside the card. */
  helper?: string;
  /** When set, helper renders in warning color (validation hint). */
  helperWarning?: boolean;
  /** Long-press to accelerate. Default true. */
  acceleratable?: boolean;
}

const HOLD_INITIAL_DELAY = 400;
const HOLD_TICK_FAST = 80;
const HOLD_TICK_TURBO = 30;
const HOLD_TURBO_AT = 1500;
const TWEEN_THRESHOLD = 2; // jumps of >=2 animate; +/-1 ticks snap.

/**
 * Numeric stepper with long-press accelerator + haptics.
 * Helper renders inside the card. The big number tweens smoothly when the
 * external `value` jumps (e.g. from chip taps), but snaps for -/+ ticks.
 */
export default function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  helper,
  helperWarning = false,
  acceleratable = true,
}: StepperProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdStartRef = useRef<number>(0);
  const valueRef = useRef(value);

  // Animated displayed value (tweens between snapshots).
  const display = useSharedValue(value);
  const [displayInt, setDisplayInt] = useState(value);

  useEffect(() => {
    valueRef.current = value;
    const diff = Math.abs(value - display.value);
    if (diff >= TWEEN_THRESHOLD) {
      cancelAnimation(display);
      display.value = withTiming(value, {
        duration: 320,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      // Snap on small ticks (no animation jitter for +/-1).
      cancelAnimation(display);
      display.value = value;
      setDisplayInt(value);
    }
  }, [value, display]);

  // Mirror the shared value back to React state for rendering.
  useAnimatedReaction(
    () => Math.round(display.value),
    (next, prev) => {
      if (next !== prev) {
        runOnJS(setDisplayInt)(next);
      }
    },
    []
  );

  const clamp = useCallback(
    (v: number) => Math.max(min, Math.min(max, v)),
    [min, max]
  );

  const tick = useCallback(
    (dir: 1 | -1) => {
      const next = clamp(valueRef.current + step * dir);
      if (next === valueRef.current) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        return;
      }
      onChange(next);
      Haptics.selectionAsync().catch(() => {});
    },
    [clamp, step, onChange]
  );

  const startHold = useCallback(
    (dir: 1 | -1) => {
      if (!acceleratable) return;
      holdStartRef.current = Date.now();
      const schedule = () => {
        const elapsed = Date.now() - holdStartRef.current;
        const interval = elapsed > HOLD_TURBO_AT ? HOLD_TICK_TURBO : HOLD_TICK_FAST;
        holdTimerRef.current = setTimeout(() => {
          tick(dir);
          schedule();
        }, interval);
      };
      holdTimerRef.current = setTimeout(() => {
        tick(dir);
        schedule();
      }, HOLD_INITIAL_DELAY);
    },
    [acceleratable, tick]
  );

  const stopHold = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  useEffect(() => stopHold, [stopHold]);

  const minusDisabled = value <= min;
  const plusDisabled = value >= max;

  return (
    <View style={styles.card}>
      <View style={styles.controlRow}>
        <Pressable
          onPress={() => tick(-1)}
          onLongPress={() => startHold(-1)}
          onPressOut={stopHold}
          disabled={minusDisabled}
          accessibilityRole="button"
          accessibilityLabel="Decrease quantity"
          accessibilityState={{ disabled: minusDisabled }}
          style={({ pressed }) => [
            styles.btn,
            styles.btnMuted,
            minusDisabled && styles.btnDisabled,
            pressed && !minusDisabled && styles.btnPressed,
          ]}
        >
          <Ionicons name="remove" size={20} color={theme.fg} />
        </Pressable>

        <View style={styles.center}>
          <Text style={styles.value}>
            <Text style={styles.valueNum}>{displayInt}</Text>
            {unit ? <Text style={styles.valueUnit}>{` ${unit}`}</Text> : null}
          </Text>
          {helper ? (
            <Text
              style={[
                styles.helper,
                { color: helperWarning ? theme.warning : theme.fgMuted },
              ]}
              numberOfLines={1}
            >
              {helper}
            </Text>
          ) : null}
        </View>

        <Pressable
          onPress={() => tick(1)}
          onLongPress={() => startHold(1)}
          onPressOut={stopHold}
          disabled={plusDisabled}
          accessibilityRole="button"
          accessibilityLabel="Increase quantity"
          accessibilityState={{ disabled: plusDisabled }}
          style={({ pressed }) => [
            styles.btn,
            styles.btnPrimary,
            plusDisabled && styles.btnDisabled,
            pressed && !plusDisabled && styles.btnPressed,
          ]}
        >
          <Ionicons name="add" size={20} color={theme.fgOnPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: theme.radius.xl,
      paddingVertical: theme.space.s4,
      paddingHorizontal: theme.space.s4,
      alignSelf: "stretch",
    },
    controlRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.s3,
    },
    btn: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    btnMuted: { backgroundColor: theme.bgMuted },
    btnPrimary: { backgroundColor: theme.primary },
    btnPressed: { opacity: 0.85, transform: [{ scale: 0.95 }] },
    btnDisabled: { opacity: 0.4 },
    center: { flex: 1, alignItems: "center", gap: 4 },
    value: { color: theme.fg },
    valueNum: {
      fontFamily: theme.type.display.fontFamily,
      fontSize: 32,
      lineHeight: 36,
      fontWeight: "800",
      ...theme.type.money,
      color: theme.fg,
    },
    valueUnit: {
      ...theme.type.bodyLg,
      color: theme.fgMuted,
      fontWeight: "600",
    },
    helper: {
      ...theme.type.caption,
    },
  });
