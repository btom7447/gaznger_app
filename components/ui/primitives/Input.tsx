import React, { forwardRef, useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import { Theme, useTheme } from "@/constants/theme";

export interface InputProps extends Omit<TextInputProps, "style"> {
  /** Eyebrow label above the field (e.g. "PHONE NUMBER"). Renders uppercased. */
  label?: string;
  /** Helper copy below the field. Hidden when `error` is set. */
  helper?: string;
  /** Error text — replaces helper, flips border + label colors. */
  error?: string;
  /** Optional render slot before the input. e.g. country flag/dial code. */
  leadingSlot?: React.ReactNode;
  /** Optional render slot after the input. e.g. eye toggle. */
  trailingSlot?: React.ReactNode;
}

/**
 * Single-line text input matching the design's 52pt field with
 * uppercase eyebrow label + helper/error rail. Replaces the ad-hoc
 * `FormField` in `components/ui/auth/`.
 *
 * Forwards ref so callers can imperatively focus from a parent
 * effect (e.g. multi-field form auto-advance).
 */
const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    label,
    helper,
    error,
    leadingSlot,
    trailingSlot,
    onFocus,
    onBlur,
    accessibilityLabel,
    ...rest
  },
  ref
) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [focused, setFocused] = useState(false);
  const showError = !!error;

  return (
    <View>
      {label ? (
        <Text style={[styles.label, showError && styles.labelError]}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.field,
          focused && !showError && styles.fieldFocused,
          showError && styles.fieldError,
        ]}
      >
        {leadingSlot}
        <TextInput
          ref={ref}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={styles.input}
          placeholderTextColor={theme.fgMuted}
          accessibilityLabel={accessibilityLabel ?? label}
        />
        {trailingSlot}
      </View>
      {showError ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helper ? (
        <Text style={styles.helperText}>{helper}</Text>
      ) : null}
    </View>
  );
});

export default Input;

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    label: {
      ...theme.type.micro,
      color: theme.fgMuted,
      marginBottom: 6,
    },
    labelError: {
      color: theme.error,
    },
    field: {
      height: 52,
      borderRadius: theme.radius.md,
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.space.s3,
    },
    fieldFocused: {
      borderColor: theme.primary,
    },
    fieldError: {
      borderColor: theme.error,
    },
    input: {
      flex: 1,
      ...theme.type.bodyLg,
      color: theme.fg,
      // RN default min-height conflicts with our parent height — clamp.
      paddingVertical: 0,
    },
    helperText: {
      ...theme.type.bodySm,
      color: theme.fgMuted,
      marginTop: 5,
    },
    errorText: {
      ...theme.type.bodySm,
      color: theme.error,
      marginTop: 5,
      fontWeight: "600",
    },
  });
