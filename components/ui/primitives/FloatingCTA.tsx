import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Theme, useTheme } from "@/constants/theme";
import Button, { ButtonProps, ButtonVariant } from "./Button";

interface FloatingCTAProps {
  label: string;
  /** Smaller subtitle echo (e.g. "GTB •••• 4892"). */
  subtitle?: string;
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
  variant?: ButtonVariant;
  /** Optional leading/trailing icon on the inner Button. */
  iconLeft?: ButtonProps["iconLeft"];
  iconRight?: ButtonProps["iconRight"];
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /**
   * When true (default), positioned absolute floating above scroll content.
   * When false, renders inline (use as a static footer below a ScrollView so
   * the CTA stays visible while content scrolls — pair with
   * `<ScreenContainer footer={<FloatingCTA floating={false} ... />}>`).
   */
  floating?: boolean;
}

/**
 * Bottom-pinned CTA. Always uses `<Button size="lg" full>` internally.
 *
 * - Default (floating=true): positioned absolute, sits above scroll content
 *   and respects safe-area insets. Use when content shouldn't scroll past it
 *   visually.
 * - floating=false: renders inline. Pair with ScreenContainer's `footer`
 *   slot to make a sticky footer with scrollable content above.
 */
export default function FloatingCTA({
  label,
  subtitle,
  disabled = false,
  loading = false,
  onPress,
  variant = "primary",
  iconLeft,
  iconRight,
  accessibilityLabel,
  accessibilityHint,
  floating = true,
}: FloatingCTAProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const button = (
    <Button
      variant={variant}
      size="lg"
      full
      onPress={onPress}
      disabled={disabled}
      loading={loading}
      subtitle={subtitle}
      iconLeft={iconLeft}
      iconRight={iconRight}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
    >
      {label}
    </Button>
  );

  if (!floating) {
    // Static footer mode — the parent (e.g. ScreenContainer with bottom
    // SafeArea edge) already accounts for the bottom inset, so we only add
    // a small breathing gap, NOT another insets.bottom worth of padding.
    return (
      <View
        style={[
          styles.staticWrap,
          {
            paddingHorizontal: theme.space.s4,
            paddingTop: theme.space.s2,
            paddingBottom: theme.space.s2,
            backgroundColor: theme.bg,
          },
        ]}
      >
        {button}
      </View>
    );
  }

  const bottom = Math.max(insets.bottom + theme.space.s2, 18);

  return (
    <View
      style={[
        styles.wrap,
        {
          bottom,
          paddingHorizontal: theme.space.s4,
        },
      ]}
      pointerEvents="box-none"
    >
      {button}
    </View>
  );
}

const makeStyles = (_theme: Theme) =>
  StyleSheet.create({
    wrap: {
      position: "absolute",
      left: 0,
      right: 0,
    },
    staticWrap: {
      // Inline footer — parent provides the column layout below the scroll.
    },
  });
