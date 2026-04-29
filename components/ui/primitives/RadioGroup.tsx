import React, { createContext, useContext, useMemo } from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Theme, useTheme } from "@/constants/theme";

type Orientation = "stack" | "row";

interface RadioGroupContextValue {
  value: string;
  onChange: (v: string) => void;
  orientation: Orientation;
}

const RadioGroupCtx = createContext<RadioGroupContextValue | null>(null);

interface RadioGroupProps {
  value: string;
  onChange: (value: string) => void;
  /** 'stack' (full-width rows) or 'row' (side-by-side cards). */
  orientation?: Orientation;
  style?: ViewStyle;
  children: React.ReactNode;
}

export default function RadioGroup({
  value,
  onChange,
  orientation = "stack",
  style,
  children,
}: RadioGroupProps) {
  const ctx = useMemo(
    () => ({ value, onChange, orientation }),
    [value, onChange, orientation]
  );
  return (
    <RadioGroupCtx.Provider value={ctx}>
      <View
        style={[
          orientation === "row" ? styles.row : styles.stack,
          style,
        ]}
        accessibilityRole="radiogroup"
      >
        {children}
      </View>
    </RadioGroupCtx.Provider>
  );
}

interface RadioOptionProps {
  value: string;
  label: string;
  sublabel?: string;
  /** Optional Ionicons name on the left. */
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  /** Trailing affordance — chevron or custom node. */
  trailing?: "chevron" | React.ReactNode;
  disabled?: boolean;
  accessibilityLabel?: string;
}

export function RadioOption({
  value,
  label,
  sublabel,
  icon,
  trailing,
  disabled = false,
  accessibilityLabel,
}: RadioOptionProps) {
  const ctx = useContext(RadioGroupCtx);
  const theme = useTheme();
  const styles = useMemo(() => makeOptionStyles(theme), [theme]);

  if (!ctx) {
    throw new Error("RadioOption must be a descendant of RadioGroup");
  }

  const selected = ctx.value === value;

  return (
    <Pressable
      onPress={() => !disabled && ctx.onChange(value)}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={accessibilityLabel ?? `${label}${sublabel ? `. ${sublabel}` : ""}`}
      style={({ pressed }) => [
        styles.option,
        ctx.orientation === "row" && styles.optionRow,
        selected && styles.optionSelected,
        pressed && !disabled && styles.optionPressed,
        disabled && styles.optionDisabled,
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={20}
          color={selected ? theme.primary : theme.fgMuted}
          style={styles.iconLeft}
        />
      ) : null}

      <View style={styles.body}>
        <Text style={[styles.label, { color: disabled ? theme.fgMuted : theme.fg }]}>
          {label}
        </Text>
        {sublabel ? (
          <Text style={[styles.sublabel, { color: theme.fgMuted }]}>
            {sublabel}
          </Text>
        ) : null}
      </View>

      <View style={styles.trailing}>
        {trailing === "chevron" ? (
          <Ionicons
            name="chevron-forward"
            size={18}
            color={theme.fgMuted}
          />
        ) : trailing ? (
          trailing
        ) : (
          <View
            style={[
              styles.dot,
              { borderColor: selected ? theme.primary : theme.borderStrong },
              selected && { backgroundColor: theme.primary },
            ]}
          >
            {selected ? (
              <View style={styles.dotInner} />
            ) : null}
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 8 },
  row: { flexDirection: "row", gap: 8 },
});

const makeOptionStyles = (theme: Theme) =>
  StyleSheet.create({
    option: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: theme.radius.md,
      paddingVertical: theme.space.s3,
      paddingHorizontal: theme.space.s4,
      gap: theme.space.s3,
    },
    optionRow: { flex: 1 },
    optionSelected: {
      backgroundColor: theme.primaryTint,
      borderColor: theme.primary,
      borderWidth: 1.5,
    },
    optionPressed: { opacity: 0.85 },
    optionDisabled: { opacity: 0.5 },
    iconLeft: {},
    body: { flex: 1 },
    label: { ...theme.type.body, fontWeight: "800" },
    sublabel: { ...theme.type.caption, marginTop: 2 },
    trailing: { marginLeft: theme.space.s2 },
    dot: {
      width: 22,
      height: 22,
      borderRadius: theme.radius.pill,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    dotInner: {
      width: 8,
      height: 8,
      borderRadius: theme.radius.pill,
      backgroundColor: "#fff",
    },
  });
