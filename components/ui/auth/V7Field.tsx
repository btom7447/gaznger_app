import React, { useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, type Theme } from "@/constants/theme";

/**
 * V7Field — the canonical onboarding-wizard input.
 *
 * Matches the v7 design: uppercase label, 52h pill (12r) with 1.5px
 * divider border, brand-green focus border + soft green glow, optional
 * leading icon, optional suffix slot, error state with warn icon, hint
 * below.
 *
 * IMPORTANT: the stylesheet is built once per theme (memoised) — focus
 * + error states are applied as additional style objects on top. An
 * earlier version rebuilt the whole stylesheet on every focus/blur,
 * which made the TextInput's `style` prop reference-unequal each
 * render. RN's underlying NativeViewHierarchyManager treats that as a
 * style change that can drop the soft keyboard. Keep the stylesheet
 * stable to keep focus stable.
 */
export interface V7FieldProps {
  label: string;
  value: string;
  onChangeText?: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  leadingIcon?: React.ComponentProps<typeof Ionicons>["name"];
  suffix?: React.ReactNode;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  autoCorrect?: boolean;
  maxLength?: number;
  editable?: boolean;
  secureTextEntry?: boolean;
}

export default function V7Field({
  label,
  value,
  onChangeText,
  placeholder,
  required,
  hint,
  error,
  leadingIcon,
  suffix,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  maxLength,
  editable = true,
  secureTextEntry,
}: V7FieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const s = useMemo(() => makeStyles(theme), [theme]);
  const hasError = !!error;

  // Build the wrapper's dynamic style overlay outside the stylesheet
  // so the TextInput's `style` reference stays stable across renders.
  const fieldOverlay = hasError
    ? s.fieldError
    : focused
      ? s.fieldFocused
      : null;

  return (
    <View>
      <View style={s.labelRow}>
        <Text style={s.label}>{label}</Text>
        {required ? <Text style={s.required}> ·</Text> : null}
      </View>
      <View style={[s.field, fieldOverlay]}>
        {leadingIcon ? (
          <Ionicons
            name={leadingIcon}
            size={18}
            color={theme.fgMuted}
            style={s.leadingIcon}
          />
        ) : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor={theme.fgMuted}
          style={s.input}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect ?? autoCapitalize !== "none"}
          maxLength={maxLength}
          editable={editable}
          secureTextEntry={secureTextEntry}
          selectionColor={theme.primary}
        />
        {suffix}
      </View>
      {error ? (
        <View style={s.errorRow}>
          <Ionicons name="warning" size={14} color={theme.error} />
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : hint ? (
        <Text style={s.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    labelRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 6,
      marginHorizontal: 2,
    },
    label: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: theme.fgMuted,
    },
    required: {
      fontSize: 11,
      fontWeight: "800",
      color: theme.palette.green700,
    },
    field: {
      height: 52,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: theme.surface,
      borderWidth: 1.5,
      borderColor: theme.divider,
      flexDirection: "row",
      alignItems: "center",
    },
    fieldFocused: {
      borderColor: theme.primary,
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.18,
      shadowRadius: 6,
    },
    fieldError: {
      borderColor: theme.error,
    },
    leadingIcon: {
      marginRight: 8,
    },
    input: {
      flex: 1,
      fontSize: 15,
      fontWeight: "700",
      color: theme.fg,
      paddingVertical: 0,
    },
    hint: {
      marginTop: 6,
      fontSize: 11.5,
      color: theme.fgMuted,
      marginHorizontal: 2,
    },
    errorRow: {
      marginTop: 6,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginHorizontal: 2,
    },
    errorText: {
      fontSize: 12,
      color: theme.error,
      fontWeight: "700",
      flex: 1,
    },
  });
