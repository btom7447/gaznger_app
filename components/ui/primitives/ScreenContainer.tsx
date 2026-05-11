import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ScrollViewProps,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { Edge, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "@/constants/theme";

interface ScreenContainerProps {
  /** SafeArea edges to respect. Default: ['top','bottom']. */
  edges?: Edge[];
  /** Background; defaults to theme.bg. */
  bg?: string;
  /** Status bar style; defaults to theme.mode-derived. */
  statusBar?: "auto" | "light" | "dark";
  /** If true, renders without ScrollView (for map/full-bleed screens). */
  noScroll?: boolean;
  /** Forwarded to the inner ScrollView when noScroll is false. */
  scrollViewProps?: Omit<ScrollViewProps, "children" | "style">;
  /** Style on the outer SafeAreaView. */
  style?: ViewStyle;
  /** Style on the inner content wrapper (or ScrollView's contentContainerStyle). */
  contentStyle?: ViewStyle;
  /**
   * Sticky header slot — renders ABOVE the scroll area, pinned to the top.
   * Useful when you want the title/back chip to stay visible while content
   * scrolls. Pass `<ScreenHeader>` here instead of inline.
   */
  header?: React.ReactNode;
  /**
   * Fixed footer slot — renders BELOW the scroll area, pinned to the bottom.
   * Use this for sticky CTAs so they stay visible while content scrolls.
   * Pair with `avoidKeyboard` to keep the footer visible when the keyboard
   * is up.
   */
  footer?: React.ReactNode;
  /**
   * When true, wraps the body+footer in KeyboardAvoidingView so the
   * fixed footer (e.g. a FloatingCTA) stays above the keyboard
   * instead of being obscured. Audit D.4 — required by any screen
   * with a text input above a sticky CTA (delivery note, wallet
   * top-up, etc.). Default false to avoid breaking layouts that
   * weren't built for it.
   */
  avoidKeyboard?: boolean;
  children: React.ReactNode;
}

/**
 * Single source of truth for safe-area + screen background + status bar.
 * Replaces ad-hoc inset handling across screens.
 */
export default function ScreenContainer({
  edges = ["top", "bottom"],
  bg,
  statusBar,
  noScroll = false,
  scrollViewProps,
  style,
  contentStyle,
  header,
  footer,
  avoidKeyboard = false,
  children,
}: ScreenContainerProps) {
  const theme = useTheme();
  const backgroundColor = bg ?? theme.bg;
  const statusBarStyle =
    statusBar ?? (theme.mode === "dark" ? "light" : "dark");

  const body = noScroll ? (
    <View style={[styles.flex, contentStyle]}>{children}</View>
  ) : (
    <ScrollView
      {...scrollViewProps}
      style={styles.flex}
      contentContainerStyle={contentStyle}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );

  // Body + footer live inside the KAV when avoidKeyboard is on, so a
  // pinned FloatingCTA gets pushed above the keyboard. Header sits
  // outside — it's already padded by the safe-area inset and never
  // wants to move when the keyboard appears.
  const bodyAndFooter = (
    <>
      {body}
      {footer ? <View>{footer}</View> : null}
    </>
  );

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.root, { backgroundColor }, style]}
    >
      <StatusBar style={statusBarStyle} />
      {header ? <View>{header}</View> : null}
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          {bodyAndFooter}
        </KeyboardAvoidingView>
      ) : (
        bodyAndFooter
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  footer: {
    // Sits below the scroll area in the column layout, no absolute positioning.
  },
});
