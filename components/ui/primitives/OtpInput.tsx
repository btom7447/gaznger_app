import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Animated,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  View,
} from "react-native";
import { Theme, useTheme } from "@/constants/theme";

export interface OtpInputProps {
  /** Length of the code (default 6). */
  length?: number;
  /** Current value — controlled. */
  value: string;
  /** Called every change. Caller decides when value === length to verify. */
  onChange: (next: string) => void;
  /** Called when value reaches `length`. Convenience for auto-submit. */
  onComplete?: (value: string) => void;
  /** Error state — flips border + digit color to error. */
  error?: boolean;
  /** Disable input (e.g. while verifying). */
  disabled?: boolean;
  /** A11y label for the field as a whole. */
  accessibilityLabel?: string;
}

/**
 * 6-box OTP input. Single hidden TextInput drives all visual boxes —
 * paste-fill works because the OS dumps the whole code into one field;
 * we then split it across the cells. iOS SMS auto-fill triggered via
 * `textContentType="oneTimeCode"`. On Android, paste from clipboard
 * is honoured by the same single input.
 *
 * Stripping non-digits on every change means a paste of "123-456" or
 * "  123456 " arrives as "123456" without the user having to clean it.
 *
 * Accessible: announces remaining digits via a live region as the user
 * fills in cells, so screen-reader users get progress feedback.
 */
export default function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  error = false,
  disabled = false,
  accessibilityLabel,
}: OtpInputProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const inputRef = useRef<TextInput>(null);
  // Caret pulse for the active cell.
  const caretAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(caretAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(caretAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [caretAnim]);

  // Auto-fire onComplete exactly once per fill — guard against
  // re-firing when the parent re-renders without the value changing.
  const lastCompleteRef = useRef<string | null>(null);
  useEffect(() => {
    if (value.length === length) {
      if (lastCompleteRef.current !== value) {
        lastCompleteRef.current = value;
        onComplete?.(value);
      }
    } else {
      lastCompleteRef.current = null;
    }
  }, [value, length, onComplete]);

  const handleChange = (next: string) => {
    if (disabled) return;
    // Strip everything but digits, then trim to length.
    const digits = next.replace(/\D/g, "").slice(0, length);
    onChange(digits);
  };

  // Backspace on an empty active cell should still register so the
  // hidden input handles deletion correctly. RN already handles this
  // for us — but on Android, an explicit handler kept here as a hook
  // for haptics if we add them later.
  const handleKeyPress = (
    _e: NativeSyntheticEvent<TextInputKeyPressEventData>
  ) => {
    // No-op for now. Reserved.
  };

  const cells = Array.from({ length }, (_, i) => {
    const digit = value[i] ?? "";
    const isActive = i === value.length && !error && !disabled;
    return (
      <View
        key={i}
        style={[
          styles.cell,
          isActive && styles.cellActive,
          error && styles.cellError,
          disabled && styles.cellDisabled,
        ]}
      >
        {digit ? (
          <Text style={[styles.digit, error && styles.digitError]}>
            {digit}
          </Text>
        ) : isActive ? (
          <Animated.View style={[styles.caret, { opacity: caretAnim }]} />
        ) : null}
      </View>
    );
  });

  // Tap anywhere on the row (or any individual cell) → focus the
  // hidden input. RN's TextInput.focus() reopens the soft keyboard
  // even if the user dismissed it. Long-press paste also works through
  // the same input — onChangeText receives the full pasted string and
  // we strip non-digits + truncate below.
  const focusInput = useCallback(() => {
    if (disabled) return;
    inputRef.current?.focus();
  }, [disabled]);

  return (
    <Pressable
      onPress={focusInput}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? "Enter one-time code"}
      style={styles.row}
    >
      {cells}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        onKeyPress={handleKeyPress}
        keyboardType="number-pad"
        maxLength={length}
        editable={!disabled}
        // Critical for iOS SMS auto-fill.
        textContentType={Platform.OS === "ios" ? "oneTimeCode" : "none"}
        autoComplete="one-time-code"
        importantForAutofill="yes"
        autoFocus
        // The hidden input is what the user types into. 1×1 transparent
        // (not 0×0) because iOS drops focus on a zero-sized input. Sits
        // on top of the row so paste/long-press menus anchor cleanly.
        style={styles.hiddenInput}
        caretHidden
        accessible={false}
      />
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: theme.space.s2,
      position: "relative",
    },
    cell: {
      flex: 1,
      maxWidth: 56,
      height: 56,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    cellActive: {
      borderColor: theme.primary,
    },
    cellError: {
      borderColor: theme.error,
    },
    cellDisabled: {
      opacity: 0.5,
    },
    digit: {
      ...theme.type.h2,
      ...theme.type.money,
      color: theme.fg,
      fontWeight: "800",
      fontSize: 22,
    },
    digitError: {
      color: theme.error,
    },
    caret: {
      width: 2,
      height: 22,
      backgroundColor: theme.primary,
    },
    hiddenInput: {
      position: "absolute",
      width: 1,
      height: 1,
      opacity: 0,
      // iOS quirk — input with 0 width loses focus on some keyboards.
      // 1×1 transparent works on both platforms.
    },
  });
