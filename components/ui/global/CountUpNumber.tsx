import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  StyleProp,
  Text,
  TextStyle,
} from "react-native";

/**
 * Animates a numeric value from its previous render to the new one.
 *
 * Used by the Profile + Wallet hero amounts so a balance change reads
 * as a kinetic count rather than a discontinuous swap. Respects
 * reduced-motion preferences (instant snap when enabled).
 *
 * Implementation notes:
 *   - We use `requestAnimationFrame` directly rather than Reanimated
 *     because the displayed value is a string (formatted), not a
 *     style — Reanimated's worklets can't drive `Text` children.
 *   - Cancels mid-flight on next change so rapid balance updates don't
 *     queue up + snap.
 */
interface CountUpNumberProps {
  value: number;
  /** Format the numeric tick into the string Text renders. */
  format: (n: number) => string;
  /** Animation duration in ms. Default 600. */
  durationMs?: number;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  accessibilityLabel?: string;
}

export default function CountUpNumber({
  value,
  format,
  durationMs = 600,
  style,
  numberOfLines,
  accessibilityLabel,
}: CountUpNumberProps) {
  const [display, setDisplay] = useState(value);
  const reducedMotionRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!cancelled) reducedMotionRef.current = reduced;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const from = display;
    const to = value;
    if (from === to) return;

    if (reducedMotionRef.current || durationMs <= 0) {
      setDisplay(to);
      return;
    }

    const startedAt = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / durationMs);
      // Ease-out cubic — fast initial movement, gentle landing.
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (to - from) * eased;
      setDisplay(t < 1 ? next : to);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    // We intentionally don't depend on `display` — that would restart
    // the animation every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs]);

  return (
    <Text
      style={style}
      numberOfLines={numberOfLines}
      accessibilityLabel={accessibilityLabel ?? format(value)}
      // Snap the displayed value rather than rounding mid-tween — for
      // Naira amounts a non-integer mid-tween would read as a glitch.
      allowFontScaling
    >
      {format(Math.round(display))}
    </Text>
  );
}
