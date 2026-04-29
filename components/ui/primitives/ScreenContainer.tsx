import React from "react";
import {
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
   * Doesn't move with the keyboard automatically; if you need that, wrap in
   * KeyboardAvoidingView at the screen level.
   */
  footer?: React.ReactNode;
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

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.root, { backgroundColor }, style]}
    >
      <StatusBar style={statusBarStyle} />
      {header ? <View>{header}</View> : null}
      {body}
      {footer ? <View>{footer}</View> : null}
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
